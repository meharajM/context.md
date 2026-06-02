import { create } from 'zustand';

import { AppStateStatus } from 'react-native';

import { ContextSection, ContextManager } from '../modules/ContextManager';
import { AudioEngineImpl } from '../modules/AudioEngine/AudioEngineImpl';
import type { AudioReadiness } from '../modules/AudioEngine';
import type { TranscriptionResult } from '../modules/AudioEngine';
import type { RecordingState } from '../features/capture/captureTypes';
import {
  downloadSynthesisModel,
  getSynthesisModels,
  removeSynthesisModel,
  resolveModelViews,
  type SynthesisModelDownloadProgress,
  type SynthesisModelView,
} from '../modules/SynthesisEngine/modelManager';
import { SynthesisService } from '../modules/SynthesisEngine/SynthesisService';
import { ProcessingQueueManager, QueueEvent, QueueState, PendingThought } from '../modules/SynthesisEngine/ProcessingQueueManager';
import { getDefaultSynthesisModel, toLiteRtModelConfig } from '../modules/SynthesisEngine/models';
import { QA_SAMPLE_WAV } from '../shared/audio/sampleAudio';
import { createNoteId } from '../shared/notes/noteTypes';
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
  selectedModelStatusMessage: string | null;
  queueJobs: PendingThought[];
  loadContext: () => Promise<void>;
  addThought: (text: string, kind?: PendingThought['kind']) => Promise<void>;
  queueInboxForSynthesis: (options?: { announce?: boolean }) => Promise<number>;
  updateQueuedThought: (
    thoughtId: string,
    updates: { transcript?: string; selectedTopic?: string | null },
  ) => boolean;
  removeQueuedThought: (thoughtId: string) => void;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<TranscriptionResult | void>;
  runTranscriptionProbe: () => Promise<void>;
  initializeEngine: (options?: InitializeEngineOptions) => Promise<void>;
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

type InitializeEngineOptions = {
  eagerAudio?: boolean;
  eagerSynthesis?: boolean;
};

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

const isRetainedVoiceFailure = (thought: {
  text: string;
  sourceKind?: string;
  sourceTranscript?: string;
  sourceMetadata?: { audioFilePath?: string | null };
}) => {
  if (thought.sourceKind !== 'voice' || !thought.sourceMetadata?.audioFilePath) {
    return false;
  }

  const normalizedText = thought.text.trim().toLowerCase();
  const normalizedTranscript = thought.sourceTranscript?.trim().toLowerCase();

  return normalizedText === 'voice capture retained' || normalizedTranscript === 'voice capture retained';
};

const recordingStatePatch = (recordingState: RecordingState, status?: string) => ({
  recordingState,
  isRecording: isRecordingActive(recordingState),
  ...(status ? { status } : {}),
});

const persistVoiceCaptureToInbox = async (transcript: string) => {
  const noteId = createNoteId('note');
  await ContextManager.appendThought('Inbox', transcript, {
    noteId,
    sourceKind: 'voice',
    sourceTranscript: transcript,
    sourceMetadata: {
      kind: 'voice',
      transcript,
      noteId,
    },
  });
};

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
    selectedModelStatusMessage: selected?.statusMessage ?? null,
  };
};

const mergeTransientModelState = (
  previousModels: SynthesisModelView[],
  refreshedModels: SynthesisModelView[],
): SynthesisModelView[] =>
  refreshedModels.map(model => {
    const previous = previousModels.find(candidate => candidate.id === model.id);
    if (!previous?.downloading) {
      return model;
    }

    if (model.installed || model.verified || Boolean(model.error) || Boolean(model.statusMessage)) {
      return model;
    }

    return {
      ...model,
      downloading: true,
      progress: previous.progress,
      error: previous.error,
      statusMessage: previous.statusMessage,
    };
  });

const getSelectedModel = (state: Pick<AppState, 'models' | 'selectedModelId'>): SynthesisModelView =>
  state.models.find(model => model.id === state.selectedModelId) ??
  state.models[0] ?? {
    ...getDefaultSynthesisModel(),
    downloadUrl: '',
    localPath: '',
    installed: false,
    downloading: false,
    progress: 0,
    error: null,
    verified: false,
    statusMessage: null,
  };

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
    const progress = selected.progress ?? state.selectedModelProgress;
    return `Downloading ${selected.name} (${progress}%) before queued thoughts can be categorized`;
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
    queueBlockedReason: null,
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
    selectedModelStatusMessage: defaultModel.statusMessage ?? null,
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

      const nextState = {
        ...get(),
        [key]: value,
      };
      syncSynthesisQueueGate(nextState);
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
        queueBlockedReason: state.blockedReason,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
      });
    },

    refreshModels: async () => {
      const refreshed = mergeTransientModelState(get().models, await resolveModelViews(getSynthesisModels()));
      const refreshedDefault = refreshed.find(model => model.recommended) ?? refreshed[0] ?? defaultModel;
      const selectedModel = refreshed.find(model => model.id === get().selectedModelId) ?? refreshedDefault;
      syncSynthesisQueueGate({
        ...get(),
        models: refreshed,
        selectedModelId: selectedModel.id,
        ...updateModelFlags(refreshed, selectedModel.id),
      });
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
      syncSynthesisQueueGate({
        ...get(),
        models,
        selectedModelId: selected.id,
        ...updateModelFlags(models, selected.id),
      });
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
      const startingModels = get().models.map(model =>
        model.id === modelId
          ? { ...model, downloading: true, progress: 0, error: null, statusMessage: 'Preparing download' }
          : model,
      );

      set({
        models: startingModels,
        selectedModelId: modelId,
        selectedModelDownloading: true,
        selectedModelProgress: 0,
        selectedModelError: null,
        selectedModelStatusMessage: 'Preparing download',
        status: `Downloading ${target.name}...`,
      });
      syncSynthesisQueueGate({
        ...get(),
        models: startingModels,
        selectedModelId: modelId,
        selectedModelDownloading: true,
        selectedModelProgress: 0,
      });

      try {
        const downloaded = await downloadSynthesisModel(target, (update: SynthesisModelDownloadProgress) => {
          const progress = update.progress;
          const statusMessage = update.statusMessage;
          const isStillDownloading = true;
          const nextModels = get().models.map(model =>
            model.id === modelId
              ? { ...model, downloading: isStillDownloading, progress, error: null, statusMessage }
              : model,
          );
          syncSynthesisQueueGate({
            ...get(),
            models: nextModels,
            selectedModelId: modelId,
            selectedModelDownloading: isStillDownloading,
            selectedModelProgress: progress,
          });
          set({
            selectedModelId: modelId,
            selectedModelDownloading: isStillDownloading,
            selectedModelProgress: progress,
            selectedModelStatusMessage: statusMessage,
            models: nextModels,
          });
        });

        await get().refreshModels();
        SynthesisService.configure({
          liteRtEnabled: get().liteRtEnabled,
          modelConfig: toLiteRtModelConfig(downloaded),
        });
        await SynthesisService.initialize();
        await get().queueInboxForSynthesis({ announce: false });
        set({
          selectedModelId: modelId,
          selectedModelDownloading: false,
          selectedModelProgress: 100,
          selectedModelError: null,
          selectedModelStatusMessage: null,
          status: `Downloaded ${target.name}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const nextModels = get().models.map(model =>
          model.id === modelId
            ? { ...model, downloading: false, error: message, statusMessage: null }
            : model,
        );
        syncSynthesisQueueGate({
          ...get(),
          models: nextModels,
          selectedModelDownloading: false,
        });
        set({
          models: nextModels,
          selectedModelDownloading: false,
          selectedModelError: message,
          selectedModelStatusMessage: null,
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

    initializeEngine: async (options: InitializeEngineOptions = {}) => {
      const { eagerAudio = true, eagerSynthesis = true } = options;
      let audioReady = false;
      let audioReadiness = EMPTY_AUDIO_READINESS;
      await get().refreshModels();
      syncModelConfig();
      const modelInstalled = get().models.find(model => model.id === get().selectedModelId)?.installed ?? false;

      if (eagerAudio) {
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
      } else {
        set({
          isInitialized: false,
          audioReadiness,
          status: 'Ready for local capture',
        });
      }

      ensureQueueSubscription();
      syncSynthesisQueueGate(get());

      if (eagerSynthesis) {
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
      } else if (!audioReady) {
        set({ isInitialized: false, status: 'Ready for local capture' });
      }

      if (eagerSynthesis) {
        await get().queueInboxForSynthesis({ announce: false });
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
        queueBlockedReason: queueState.blockedReason,
        status: queueState.blockedReason ?? 'Stored for later',
      });
    },

    queueInboxForSynthesis: async (options = {}) => {
      const { announce = true } = options;
      const sections = await ContextManager.readContext();
      const inboxThoughts = ContextManager.getInboxThoughts(sections);
      const queuedSources = new Set(
        ProcessingQueueManager.getQueueSnapshot()
          .map(item => item.sourceContext ? `${item.sourceContext.sectionHeader}\n${item.sourceContext.noteId ?? item.sourceContext.thoughtId ?? item.sourceContext.thoughtText}` : null)
          .filter((source): source is string => Boolean(source)),
      );
      let queuedCount = 0;

      for (const thought of inboxThoughts) {
        const sourceKey = `${thought.sectionHeader}\n${thought.noteId}`;
        if (queuedSources.has(sourceKey)) {
          continue;
        }

        if (isRetainedVoiceFailure(thought)) {
          continue;
        }

        const transcript = thought.sourceTranscript?.trim() || thought.text;
        const id = ProcessingQueueManager.addToQueue(transcript, thought.sourceKind ?? 'text', {
          sectionHeader: thought.sectionHeader,
          thoughtText: thought.text,
          thoughtId: thought.id,
          noteId: thought.noteId,
          sourceMetadata: thought.sourceMetadata,
        }, {
          noteId: thought.noteId,
          selectedTopic: null,
        });

        if (id) {
          queuedSources.add(sourceKey);
          queuedCount += 1;
        }
      }

      const queueState = ProcessingQueueManager.getState();
      set({
        queueSize: queueState.pendingCount,
        pendingCount: queueState.pendingCount,
        isProcessing: queueState.isProcessing,
        currentThoughtId: queueState.currentThoughtId,
        lastQueueError: queueState.lastError,
        queueBlockedReason: queueState.blockedReason,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        ...(announce
          ? {
              status:
                queuedCount > 0
                  ? `Queued ${queuedCount} Inbox item${queuedCount === 1 ? '' : 's'} for synthesis`
                  : 'No Inbox items to synthesize',
            }
          : {}),
      });

      return queuedCount;
    },

    updateQueuedThought: (thoughtId, updates) => {
      const updated = ProcessingQueueManager.updateQueuedThought(thoughtId, updates);
      if (!updated) {
        set({ status: 'Queued item cannot be updated yet' });
        return false;
      }

      const queueState = ProcessingQueueManager.getState();
      set({
        queueSize: queueState.pendingCount,
        pendingCount: queueState.pendingCount,
        isProcessing: queueState.isProcessing,
        currentThoughtId: queueState.currentThoughtId,
        lastQueueError: queueState.lastError,
        queueBlockedReason: queueState.blockedReason,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        status: 'Queued item updated',
      });

      return true;
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
      let latestReadiness = get().audioReadiness;
      if (!latestReadiness.transcriptionReady) {
        latestReadiness = await audioEngine.initializeModels();
        set({ audioReadiness: latestReadiness });
      }

      if (!latestReadiness.transcriptionReady || !get().pushToRecordEnabled) {
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
        const errorObj = error as any;
        console.error('Failed to start recording details:', {
          message: errorObj?.message,
          stack: errorObj?.stack,
          keys: errorObj ? Object.keys(errorObj) : [],
          raw: String(error)
        });
        const message = errorObj?.message || String(error);
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

        set(recordingStatePatch('transcribing', 'Transcribing...'));

        if (result.error) {
          if (result.text) {
            await persistVoiceCaptureToInbox(result.text);
            await get().loadContext();
            set(recordingStatePatch('idle', 'Saved to Inbox'));
            return result;
          }

          if (result.audioFilePath) {
            await ContextManager.appendThought('Inbox', 'Voice capture retained', {
              sourceKind: 'voice',
              sourceMetadata: {
                audioFilePath: result.audioFilePath,
              },
            });
            await get().loadContext();
          }

          if (/timed out/i.test(result.error)) {
            set(recordingStatePatch('error', `Process Error: ${result.error}`));
            return;
          }

          set(recordingStatePatch('error', result.audioFilePath ? 'Audio retained in Inbox' : 'No speech'));
          return;
        }

        if (result.text) {
          await persistVoiceCaptureToInbox(result.text);
          await get().loadContext();
          set(recordingStatePatch('idle', 'Saved to Inbox'));
        } else {
          set(recordingStatePatch('idle', 'No speech'));
          setTimeout(() => set({ status: 'Idle' }), 2000);
        }
        return result;
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
