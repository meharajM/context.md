import { create } from 'zustand';

import { AppStateStatus } from 'react-native';

import { ContextSection, ContextManager } from '../modules/ContextManager';
import { AudioEngineImpl } from '../modules/AudioEngine/AudioEngineImpl';
import type { AudioReadiness } from '../modules/AudioEngine';
import type { RecordingState } from '../features/capture/captureTypes';
import {
  downloadSynthesisModel,
  getSynthesisModels,
  removeSynthesisModel,
  resolveModelViews,
  type SynthesisModelView,
} from '../modules/SynthesisEngine/modelManager';
import { SynthesisService } from '../modules/SynthesisEngine/SynthesisService';
import { ProcessingQueueManager, QueueEvent, QueueState, PendingThought } from '../modules/SynthesisEngine/ProcessingQueueManager';
import { getDefaultSynthesisModel, toLiteRtModelConfig } from '../modules/SynthesisEngine/models';
import { QA_SAMPLE_WAV } from '../shared/audio/sampleAudio';
import { requestAudioPermissions } from '../shared/utils/permissions';

interface AppState {
  sections: ContextSection[];
  isRecording: boolean;
  recordingState: RecordingState;
  status: string;
  queueSize: number;
  pendingCount: number;
  isProcessing: boolean;
  currentThoughtId: string | null;
  lastQueueError: string | null;
  queueBlockedReason: string | null;
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
  queueJobs: PendingThought[];
  loadContext: () => Promise<void>;
  addThought: (text: string, kind?: PendingThought['kind']) => Promise<void>;
  removeQueuedThought: (thoughtId: string) => void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
  runTranscriptionProbe: () => Promise<void>;
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

const STOP_CAPTURE_TIMEOUT_MS = 30000;
const ACTIVE_RECORDING_STATES: RecordingState[] = ['starting', 'recording', 'stopping', 'transcribing'];

const isRecordingActive = (recordingState: RecordingState) => ACTIVE_RECORDING_STATES.includes(recordingState);

const recordingStatePatch = (recordingState: RecordingState, status?: string) => ({
  recordingState,
  isRecording: isRecordingActive(recordingState),
  ...(status ? { status } : {}),
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const syncQueueStateToStore = (state: QueueState, event: QueueEvent) => {
  const isCompletedEvent = event.type === 'completed' || event.type === 'fallback';
  const currentStatus = useAppStore.getState().status;
  const staleQueuedStatus = currentStatus === 'Stored for later' || currentStatus === 'Voice note queued';
  const completedStatus =
    state.pendingCount > 0
      ? `Processing ${state.pendingCount} thought${state.pendingCount === 1 ? '' : 's'}`
      : 'Stored in context';
  const statusPatch =
    isCompletedEvent
      ? { status: completedStatus }
      : event.type === 'blocked' && state.blockedReason
        ? { status: state.blockedReason }
      : event.type === 'idle' && state.pendingCount === 0 && staleQueuedStatus
        ? { status: 'Idle' }
        : {};

  useAppStore.setState({
    queueSize: state.pendingCount,
    pendingCount: state.pendingCount,
    isProcessing: state.isProcessing,
    currentThoughtId: state.currentThoughtId,
    lastQueueError: state.lastError,
    queueBlockedReason: state.blockedReason,
    queueJobs: ProcessingQueueManager.getQueueSnapshot(),
    ...statusPatch,
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

const getSelectedModel = (state: Pick<AppState, 'models' | 'selectedModelId'>): SynthesisModelView =>
  state.models.find(model => model.id === state.selectedModelId) ?? getDefaultSynthesisModel();

const getModelBlockedReason = (
  state: Pick<
    AppState,
    'liteRtEnabled' | 'models' | 'selectedModelId' | 'selectedModelDownloading' | 'selectedModelProgress'
  >,
): string | null => {
  if (!state.liteRtEnabled) {
    return null;
  }

  const selected = getSelectedModel(state);

  if (selected.downloading || state.selectedModelDownloading) {
    const progress = selected.progress || state.selectedModelProgress;
    return `Downloading ${selected.name} (${progress}%) before queued thoughts can be categorized`;
  }

  if (!selected.installed) {
    return `Install ${selected.name} to categorize queued thoughts with on-device AI`;
  }

  return null;
};

const syncSynthesisQueueGate = (state: Pick<
  AppState,
  'liteRtEnabled' | 'models' | 'selectedModelId' | 'selectedModelDownloading' | 'selectedModelProgress'
>) => {
  ProcessingQueueManager.setProcessingBlockedReason(getModelBlockedReason(state));
};

export const useAppStore = create<AppState>((set, get) => {
  const initialModels = getSynthesisModels();
  const defaultModel = initialModels.find(model => model.recommended) ?? initialModels[0];

  return {
    sections: [],
    isRecording: false,
    recordingState: 'idle',
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
    queueJobs: [],

    setStatus: status => set({ status }),

    setAppLifecycleState: async nextState => {
      const appIsActive = nextState === 'active';
      set({ appIsActive });

      if (!appIsActive) {
        await audioEngine.stopWakeWordDetection();
        return;
      }

      const state = get();
      if (state.wakeWordEnabled && state.audioReadiness.wakeWordReady && state.recordingState === 'idle') {
        await audioEngine.startWakeWordDetection(async () => {
          if (get().recordingState !== 'idle') {
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
        } else if (get().appIsActive && get().recordingState === 'idle') {
          audioEngine.startWakeWordDetection(async () => {
            if (get().recordingState !== 'idle') {
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
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
      });
    },

    refreshModels: async () => {
      const refreshed = await resolveModelViews(getSynthesisModels());
      const refreshedDefault = refreshed.find(model => model.recommended) ?? refreshed[0] ?? defaultModel;
      const selectedModel = refreshed.find(model => model.id === get().selectedModelId) ?? refreshedDefault;
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

        await get().refreshModels();
        SynthesisService.configure({
          liteRtEnabled: get().liteRtEnabled,
          modelConfig: toLiteRtModelConfig(downloaded),
        });
        await SynthesisService.initialize();
        set({
          selectedModelId: modelId,
          status: `Downloaded ${target.name}`,
        });
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

      await removeSynthesisModel(target);
      await get().refreshModels();
      set({
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

    addThought: async (text, kind = 'text') => {
      const trimmed = text.trim();
      if (!trimmed) return;

      ProcessingQueueManager.addToQueue(trimmed, kind);
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

    removeQueuedThought: thoughtId => {
      if (!ProcessingQueueManager.removeFromQueue(thoughtId)) {
        set({ status: 'Active item cannot be ended yet' });
        return;
      }

      const queueState = ProcessingQueueManager.getState();
      set({
        queueSize: queueState.pendingCount,
        pendingCount: queueState.pendingCount,
        isProcessing: queueState.isProcessing,
        currentThoughtId: queueState.currentThoughtId,
        lastQueueError: queueState.lastError,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        status: 'Queue item ended',
      });
    },

    startCapture: async () => {
      if (!get().audioReadiness.transcriptionReady || !get().pushToRecordEnabled) {
        set({ status: 'Recording unavailable' });
        return;
      }

      if (get().recordingState !== 'idle') {
        return;
      }

      set(recordingStatePatch('starting', 'Starting...'));

      try {
        const hasPermission = await requestAudioPermissions();
        if (!hasPermission) {
          set(recordingStatePatch('idle', 'Microphone access needed'));
          return;
        }

        await audioEngine.startRecording();
        set(recordingStatePatch('recording', 'Listening...'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Failed to start recording:', error);
        set(recordingStatePatch('error', message ? `Mic Error: ${message}` : 'Mic Error'));
      }
    },

    stopCapture: async () => {
      if (get().recordingState !== 'recording') return;
      try {
        set(recordingStatePatch('stopping', 'Stopping...'));
        const result = await withTimeout(
          audioEngine.stopRecording(),
          STOP_CAPTURE_TIMEOUT_MS,
          'Capture stop timed out',
        );

        if (result.error && !result.text) {
          if (/timed out/i.test(result.error)) {
            set(recordingStatePatch('error', `Process Error: ${result.error}`));
            return;
          }

          set(recordingStatePatch('idle', 'No speech'));
          setTimeout(() => set({ status: 'Idle' }), 2000);
          return;
        }

        set(recordingStatePatch('transcribing', 'Transcribing...'));

        if (result.text) {
          await get().addThought(result.text, 'voice');
          set(recordingStatePatch('idle', 'Voice note queued'));
        } else {
          set(recordingStatePatch('idle', 'No speech'));
          setTimeout(() => set({ status: 'Idle' }), 2000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set(recordingStatePatch('error', message ? `Process Error: ${message}` : 'Process Error'));
      }
    },

    runTranscriptionProbe: async () => {
      if (!get().audioReadiness.transcriptionReady) {
        return;
      }

      try {
        const result = await audioEngine.transcribeFile(QA_SAMPLE_WAV);
        set({
          status: result.text ? `QA transcript: ${result.text.slice(0, 60)}` : 'QA transcript: no speech detected',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ status: `QA transcript failed: ${message}` });
      }
    },
  };
});
