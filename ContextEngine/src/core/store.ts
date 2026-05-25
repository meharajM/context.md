import { create } from 'zustand';

import { AppStateStatus } from 'react-native';

import { ContextSection, ContextManager } from '../modules/ContextManager';
import { AudioEngineImpl } from '../modules/AudioEngine/AudioEngineImpl';
import type { AudioReadiness } from '../modules/AudioEngine';
import {
  downloadSynthesisModel,
  getSynthesisModels,
  removeSynthesisModel,
  resolveModelViews,
  type SynthesisModelView,
} from '../modules/SynthesisEngine/modelManager';
import { SynthesisService } from '../modules/SynthesisEngine/SynthesisService';
import { ProcessingQueueManager, QueueEvent, QueueState } from '../modules/SynthesisEngine/ProcessingQueueManager';
import { getDefaultSynthesisModel, toLiteRtModelConfig } from '../modules/SynthesisEngine/models';

interface AppState {
  sections: ContextSection[];
  isRecording: boolean;
  status: string;
  queueSize: number;
  pendingCount: number;
  isProcessing: boolean;
  currentThoughtId: string | null;
  lastQueueError: string | null;
  isInitialized: boolean;
  appIsActive: boolean;
  audioReadiness: AudioReadiness;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  liteRtEnabled: boolean;
  models: SynthesisModelView[];
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelDownloading: boolean;
  selectedModelProgress: number;
  selectedModelError: string | null;
  loadContext: () => Promise<void>;
  addThought: (text: string) => Promise<void>;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  initializeEngine: () => Promise<void>;
  refreshModels: () => Promise<void>;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  setStatus: (status: string) => void;
  setAppLifecycleState: (nextState: AppStateStatus) => Promise<void>;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => void;
  updateQueueSize: () => void;
}

const audioEngine = new AudioEngineImpl();
let queueSubscription: (() => void) | null = null;

const EMPTY_AUDIO_READINESS: AudioReadiness = {
  transcriptionReady: false,
  wakeWordReady: false,
  missingModels: [],
  errors: [],
};

const syncQueueStateToStore = (state: QueueState, event: QueueEvent) => {
  useAppStore.setState({
    queueSize: state.pendingCount,
    pendingCount: state.pendingCount,
    isProcessing: state.isProcessing,
    currentThoughtId: state.currentThoughtId,
    lastQueueError: state.lastError,
  });

  if (event.type === 'completed' || event.type === 'fallback') {
    useAppStore.getState().loadContext().catch(error => {
      console.error('Failed to reload context after queue completion:', error);
    });
  }
};

const ensureQueueSubscription = () => {
  if (queueSubscription) {
    return;
  }

  queueSubscription = ProcessingQueueManager.subscribe(syncQueueStateToStore);
};

const syncModelConfig = () => {
  const state = useAppStore.getState();
  const selected = state.models.find(model => model.id === state.selectedModelId) ?? getDefaultSynthesisModel();
  SynthesisService.configure({
    liteRtEnabled: state.liteRtEnabled,
    modelConfig: toLiteRtModelConfig(selected),
  });
  return selected;
};

const updateModelFlags = (models: SynthesisModelView[], selectedModelId: string) => {
  const selected = models.find(model => model.id === selectedModelId);
  return {
    selectedModelInstalled: selected?.installed ?? false,
    selectedModelDownloading: selected?.downloading ?? false,
    selectedModelProgress: selected?.progress ?? 0,
    selectedModelError: selected?.error ?? null,
  };
};

export const useAppStore = create<AppState>((set, get) => {
  const initialModels = getSynthesisModels();
  const defaultModel = initialModels.find(model => model.recommended) ?? initialModels[0];

  return {
    sections: [],
    isRecording: false,
    status: 'Booting...',
    queueSize: 0,
    pendingCount: 0,
    isProcessing: false,
    currentThoughtId: null,
    lastQueueError: null,
    isInitialized: false,
    appIsActive: true,
    audioReadiness: EMPTY_AUDIO_READINESS,
    manualCaptureEnabled: true,
    pushToRecordEnabled: true,
    wakeWordEnabled: false,
    liteRtEnabled: true,
    models: initialModels,
    selectedModelId: defaultModel.id,
    selectedModelInstalled: defaultModel.installed,
    selectedModelDownloading: defaultModel.downloading,
    selectedModelProgress: defaultModel.progress,
    selectedModelError: defaultModel.error,

    setStatus: status => set({ status }),

    setAppLifecycleState: async nextState => {
      const appIsActive = nextState === 'active';
      set({ appIsActive });

      if (!appIsActive) {
        await audioEngine.stopWakeWordDetection();
        return;
      }

      const state = get();
      if (state.wakeWordEnabled && state.audioReadiness.wakeWordReady && !state.isRecording) {
        await audioEngine.startWakeWordDetection(async () => {
          if (get().isRecording) {
            return;
          }

          set({ status: 'Wake word detected' });
          await get().startCapture();
        });
      }
    },

    setCaptureSetting: (key, value) => {
      if (key === 'liteRtEnabled') {
        SynthesisService.configure({ liteRtEnabled: value, modelConfig: toLiteRtModelConfig(get().models.find(model => model.id === get().selectedModelId) ?? defaultModel) });
      }

      if (key === 'wakeWordEnabled') {
        const readiness = get().audioReadiness;
        if (value && !readiness.wakeWordReady) {
          set({
            wakeWordEnabled: false,
            status: 'Wake word unavailable',
          });
          return;
        }

        if (!value) {
          audioEngine.stopWakeWordDetection().catch(error => {
            console.error('Failed to stop wake-word detection:', error);
          });
        } else if (get().appIsActive && !get().isRecording) {
          audioEngine.startWakeWordDetection(async () => {
            if (get().isRecording) {
              return;
            }

            set({ status: 'Wake word detected' });
            await get().startCapture();
          }).catch(error => {
            console.error('Failed to start wake-word detection:', error);
          });
        }
      }

      set({ [key]: value });
    },

    updateQueueSize: () => {
      const state = ProcessingQueueManager.getState();
      set({
        queueSize: state.pendingCount,
        pendingCount: state.pendingCount,
        isProcessing: state.isProcessing,
        currentThoughtId: state.currentThoughtId,
        lastQueueError: state.lastError,
      });
    },

    refreshModels: async () => {
      const refreshed = await resolveModelViews(get().models);
      const selectedModel = refreshed.find(model => model.id === get().selectedModelId) ?? defaultModel;
      set({
        models: refreshed,
        ...updateModelFlags(refreshed, selectedModel.id),
      });
      SynthesisService.configure({
        liteRtEnabled: get().liteRtEnabled,
        modelConfig: toLiteRtModelConfig(selectedModel),
      });
    },

    selectModel: async modelId => {
      const models = get().models;
      const selected = models.find(model => model.id === modelId) ?? defaultModel;
      set({
        models,
        selectedModelId: selected.id,
        ...updateModelFlags(models, selected.id),
        status: selected.installed ? `Selected ${selected.name}` : `Selected ${selected.name}; download required`,
      });
      SynthesisService.configure({
        liteRtEnabled: get().liteRtEnabled,
        modelConfig: toLiteRtModelConfig(selected),
      });
    },

    downloadModel: async modelId => {
      const target = get().models.find(model => model.id === modelId);
      if (!target) return;

      set({
        models: get().models.map(model =>
          model.id === modelId
            ? { ...model, downloading: true, progress: 0, error: null }
            : model,
        ),
        selectedModelId: modelId,
        selectedModelDownloading: true,
        selectedModelProgress: 0,
        selectedModelError: null,
        status: `Downloading ${target.name}...`,
      });

      try {
        const downloaded = await downloadSynthesisModel(target, progress => {
          set({
            selectedModelId: modelId,
            selectedModelDownloading: true,
            selectedModelProgress: progress,
            models: get().models.map(model =>
              model.id === modelId
                ? { ...model, downloading: true, progress, error: null }
                : model,
            ),
          });
        });

        const updatedModels = get().models.map(model => (model.id === modelId ? downloaded : model));
        set({
          models: updatedModels,
          selectedModelId: modelId,
          ...updateModelFlags(updatedModels, modelId),
          status: `Downloaded ${target.name}`,
        });

        SynthesisService.configure({
          liteRtEnabled: get().liteRtEnabled,
          modelConfig: toLiteRtModelConfig(downloaded),
        });
        await SynthesisService.initialize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({
          models: get().models.map(model =>
            model.id === modelId
              ? { ...model, downloading: false, error: message }
              : model,
          ),
          selectedModelDownloading: false,
          selectedModelError: message,
          status: `Model download failed: ${message}`,
        });
      }
    },

    removeModel: async modelId => {
      const target = get().models.find(model => model.id === modelId);
      if (!target) return;

      const updated = await removeSynthesisModel(target);
      const models = get().models.map(model => (model.id === modelId ? updated : model));
      set({
        models,
        ...updateModelFlags(models, get().selectedModelId),
        status: `Removed ${target.name}`,
      });
    },

    initializeEngine: async () => {
      let audioReady = false;
      let audioReadiness = EMPTY_AUDIO_READINESS;
      await get().refreshModels();
      syncModelConfig();
      const modelInstalled = get().models.find(model => model.id === get().selectedModelId)?.installed ?? false;

      try {
        audioReadiness = await audioEngine.initializeModels();
        audioReady = audioReadiness.transcriptionReady;
        set({
          isInitialized: audioReady,
          audioReadiness,
          status: audioReady ? 'Capture Ready' : 'Audio Unavailable',
        });
      } catch {
        set({ isInitialized: false, audioReadiness, status: 'Audio Unavailable' });
      }

      ensureQueueSubscription();

      try {
        const readiness = await SynthesisService.initialize();
        set({
          isInitialized: audioReady,
          audioReadiness,
          status: readiness.available
            ? audioReady
              ? 'Idle'
              : 'Audio Unavailable'
            : audioReady
              ? modelInstalled
                ? 'AI Offline'
                : 'Model missing'
              : 'Audio Unavailable',
        });
      } catch {
        set({
          isInitialized: audioReady,
          audioReadiness,
          status: audioReady ? (modelInstalled ? 'AI Offline' : 'Model missing') : 'Audio Unavailable',
        });
      }
    },

    loadContext: async () => {
      const data = await ContextManager.readContext();
      set({ sections: data });
    },

    addThought: async text => {
      const trimmed = text.trim();
      if (!trimmed) return;

      ProcessingQueueManager.addToQueue(trimmed);
      const queueState = ProcessingQueueManager.getState();
      set({
        queueSize: queueState.pendingCount,
        pendingCount: queueState.pendingCount,
        isProcessing: queueState.isProcessing,
        currentThoughtId: queueState.currentThoughtId,
        lastQueueError: queueState.lastError,
        status: 'Stored for later',
      });
    },

    startCapture: async () => {
      if (!get().audioReadiness.transcriptionReady || !get().pushToRecordEnabled) {
        set({ status: 'Recording unavailable' });
        return;
      }
      try {
        set({ isRecording: true, status: 'Listening...' });
        await audioEngine.startRecording();
      } catch {
        set({ isRecording: false, status: 'Mic Error' });
      }
    },

    stopCapture: async () => {
      if (!get().isRecording) return;
      try {
        set({ status: 'Processing...' });
        const result = await audioEngine.stopRecording();
        set({ isRecording: false });

        if (result.text) {
          await get().addThought(result.text);
        } else {
          set({ status: 'No speech' });
          setTimeout(() => set({ status: 'Idle' }), 2000);
        }
      } catch {
        set({ isRecording: false, status: 'Process Error' });
      }
    },
  };
});
