import { drainQuickTextOutbox } from '../modules/BackgroundSynthesis/quickTextCapture';
import { create } from 'zustand';
import { loadAppPreferences, saveAppPreferences } from './appPreferences';
import RNFS from 'react-native-fs';
import { RELEASE_CAPABILITIES } from './releaseCapabilities';

import { AppStateStatus, Platform } from 'react-native';

import { ContextSection, ContextManager, type BackupMergeResult } from '../modules/ContextManager';
import { AudioEngineImpl } from '../modules/AudioEngine/AudioEngineImpl';
import type { AudioReadiness } from '../modules/AudioEngine';
import type { TranscriptionResult } from '../modules/AudioEngine';
import type { NoteSourceMetadata } from '../shared/notes/noteTypes';
import { ALLOWED_VOICE_IMPORT_LABEL, isSupportedVoiceImportPath, normalizeVoiceImportPath } from '../shared/utils/voiceImport';
import type { RecordingState } from '../features/capture/captureTypes';
import type { ImportDraft, ImportPreview } from './importTypes';
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
import { setHeadsetTriggerEnabled, setLockScreenHeadsetCaptureEnabled } from '../modules/HeadsetTrigger';
import { scheduleQueuedSynthesis } from '../modules/BackgroundSynthesis';
import { QA_SAMPLE_WAV } from '../shared/audio/sampleAudio';
import { createNoteId } from '../shared/notes/noteTypes';
import {
  requestAudioPermissions,
  requestLockScreenCapturePermissions,
  requestRecordingNotificationPermission,
} from '../shared/utils/permissions';
import { isAppOwnedCaptureAudioPath, isAppOwnedRetainedAudioPath } from '../shared/audio/retainedAudio';
import { exportLibraryBackupFile, pickLibraryBackupFile } from '../shared/utils/voiceFilePicker';
import {
  assessDeviceReadiness,
  formatBytesAsGiB,
  hasSeenDeviceReadinessNotice,
  markDeviceReadinessNoticeSeen,
  MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES,
  SYNTHESIS_MINIMUM_RAM_GB,
  type DeviceReadinessAssessment,
} from '../modules/DeviceReadiness';

export interface UnsynthesizedNoteReference {
  sectionHeader: string;
  noteId: string;
  thoughtText: string;
  audioFilePath?: string | null;
  transcriptionError?: string | null;
}

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
  queueClarification: QueueState['clarification'];
  isInitialized: boolean;
  appIsActive: boolean;
  deviceReadiness: DeviceReadinessAssessment | null;
  deviceReadinessNoticeVisible: boolean;
  deviceReadinessNoticeDismissed: boolean;
  audioReadiness: AudioReadiness;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  lockScreenHeadsetTriggerEnabled: boolean;
  liteRtEnabled: boolean;
  models: SynthesisModelView[];
  selectedModelId: string;
  selectedModelInstalled: boolean;
  selectedModelDownloading: boolean;
  selectedModelProgress: number;
  selectedModelError: string | null;
  selectedModelStatusMessage: string | null;
  queueJobs: PendingThought[];
  refreshDeviceReadiness: () => Promise<DeviceReadinessAssessment>;
  loadContext: () => Promise<void>;
  exportLibraryBackup: () => Promise<boolean>;
  restoreLibraryBackup: () => Promise<BackupMergeResult | null>;
  addThought: (text: string, kind?: PendingThought['kind']) => Promise<void>;
  analyzeImportDraft: (draft: ImportDraft) => Promise<ImportPreview>;
  queueImportedThought: (preview: ImportPreview, options?: { approvedTopic?: string | null }) => Promise<string>;
  queueInboxForSynthesis: (options?: { announce?: boolean }) => Promise<number>;
  updateQueuedThought: (
    thoughtId: string,
    updates: { transcript?: string; selectedTopic?: string | null; sourceMetadata?: NoteSourceMetadata },
  ) => boolean;
  resolveQueueClarification: (thoughtId: string, selectedTopic: string) => boolean;
  removeQueuedThought: (thoughtId: string) => void;
  deleteRetainedAudioFromNote: (note: UnsynthesizedNoteReference) => Promise<boolean>;
  retranscribeRetainedAudioFromNote: (note: UnsynthesizedNoteReference, options?: { queueSynthesis?: boolean }) => Promise<boolean>;
  retryRetainedInboxAudio: (options?: { queueSynthesis?: boolean }) => Promise<{ recovered: number; hasMore: boolean }>;
  deleteUnsynthesizedNote: (note: UnsynthesizedNoteReference) => Promise<boolean>;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<TranscriptionResult | void>;
  runTranscriptionProbe: () => Promise<void>;
  initializeEngine: (options?: InitializeEngineOptions) => Promise<void>;
  hydratePreferences: () => Promise<void>;
  preferencesHydrated: boolean;
  recoverInterruptedRecordings: () => Promise<number>;
  refreshModels: () => Promise<void>;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  setStatus: (status: string) => void;
  setAppLifecycleState: (nextState: AppStateStatus) => Promise<void>;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'lockScreenHeadsetTriggerEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => void;
  updateQueueSize: () => void;
  dismissDeviceReadinessNotice: () => Promise<void>;
}

type InitializeEngineOptions = {
  eagerAudio?: boolean;
  eagerSynthesis?: boolean;
};

const audioEngine = new AudioEngineImpl();
let queueSubscription: (() => void) | null = null;
let queueCompletionRevision = 0;
let queuedSynthesisSchedule: Promise<boolean> | null = null;
const retainedAudioRetries = new Set<string>();
const RETAINED_AUDIO_RETRY_DIRECTORY = `${RNFS.DocumentDirectoryPath}/setup/retained-audio-attempts`;
const RETAINED_AUDIO_RETRY_COOLDOWN_MS = 60 * 60 * 1000;
const BACKGROUND_QUEUE_SCHEDULED_STATUS =
  'Saved in Inbox. Android will retry when it can; timing depends on the system.';
const BACKGROUND_QUEUE_SCHEDULE_FAILED_STATUS =
  'Saved in Inbox. Android could not schedule the retry. Open the app again to continue.';

const scheduleQueuedSynthesisOnce = () => {
  if (!queuedSynthesisSchedule) {
    const schedule = scheduleQueuedSynthesis();
    const trackedSchedule = schedule.finally(() => {
      if (queuedSynthesisSchedule === trackedSchedule) {
        queuedSynthesisSchedule = null;
      }
    });
    queuedSynthesisSchedule = trackedSchedule;
  }
  return queuedSynthesisSchedule;
};

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
  sourceMetadata?: { audioFilePath?: string | null; transcriptionError?: string | null };
}) => {
  return thought.sourceKind === 'voice' && Boolean(thought.sourceMetadata?.audioFilePath) && Boolean(
    thought.sourceMetadata?.transcriptionError || thought.text.trim().toLowerCase() === 'voice capture retained',
  );
};

const recordingStatePatch = (recordingState: RecordingState, status?: string) => ({
  recordingState,
  isRecording: isRecordingActive(recordingState),
  ...(status ? { status } : {}),
});

const shouldWaitForSynthesisResources = (readiness: DeviceReadinessAssessment | null | undefined) =>
  readiness?.checkAvailable === true &&
  readiness.resourcesAvailable === false &&
  (readiness.meetsSynthesisMinimum !== false ||
    readiness.thermalState === 'serious' ||
    readiness.thermalState === 'critical');

const persistCaptureToInbox = async (
  transcript: string,
  kind: PendingThought['kind'],
  options: { noteId?: string; sourceMetadata?: NoteSourceMetadata } = {},
) => {
  const noteId = options.noteId ?? createNoteId('note');
  const sourceMetadata: NoteSourceMetadata = {
    ...options.sourceMetadata,
    kind,
    transcript,
    noteId,
  };
  await ContextManager.appendThought('Inbox', transcript, {
    noteId,
    sourceKind: kind,
    sourceTranscript: transcript,
    sourceMetadata,
  });
  return {
    noteId,
    sectionHeader: 'Inbox' as const,
    thoughtText: transcript,
    sourceMetadata,
  };
};

const normalizeTopicInput = (topic?: string | null): string | null => {
  const normalized = topic?.trim();
  return normalized ? normalized : null;
};

const getSemanticTopics = (sections: ContextSection[]): string[] =>
  sections
    .map(section => section.header)
    .filter(header => header.trim().length > 0 && header.trim().toLowerCase() !== 'inbox');

const getSemanticTopicContexts = (sections: ContextSection[]) =>
  sections
    .filter(section => section.header.trim().length > 0 && section.header.trim().toLowerCase() !== 'inbox')
    .map(section => ({
      topic: section.header,
      content: ContextManager.getThoughtsFromSection(section).map(note => note.text).join('\n'),
    }));

const buildImportSourceMetadata = (
  draft: ImportDraft,
  transcript: string,
): { kind: 'text' | 'voice'; transcript: string; audioFilePath?: string | null } => {
  if (draft.sourceKind === 'voice') {
    return {
      kind: 'voice',
      transcript,
      ...(typeof draft.voiceFile === 'string'
        ? { audioFilePath: normalizeVoiceImportPath(draft.voiceFile) }
        : {}),
    };
  }

  return {
    kind: 'text',
    transcript,
  };
};

const resolveImportPreview = async (draft: ImportDraft, synthesisEnabled = true): Promise<ImportPreview> => {
  const selectedTopic = normalizeTopicInput(draft.selectedTopic);
  let transcript = '';

  if (draft.sourceKind === 'voice') {
    if (!RELEASE_CAPABILITIES.voiceImport) {
      throw new Error('Voice import is planned for a future release');
    }
    if (typeof draft.voiceFile === 'string' && !isSupportedVoiceImportPath(draft.voiceFile)) {
      throw new Error(`Voice imports support ${ALLOWED_VOICE_IMPORT_LABEL}`);
    }

    const voiceSource = draft.voiceFile;
    if (voiceSource == null) {
      throw new Error('Select a voice file before previewing the import');
    }

    const transcription = await audioEngine.transcribeFile(voiceSource);
    transcript = transcription.text.trim();

    if (!transcript) {
      throw new Error(transcription.error ?? 'No speech was detected in the selected voice file');
    }
  } else {
    transcript = draft.text?.trim() ?? '';
    if (!transcript) {
      throw new Error('Enter text before previewing the import');
    }
  }

  const sections = await ContextManager.readContext();
  const existingTopics = getSemanticTopics(sections);
  const synthesized = synthesisEnabled
    ? await SynthesisService.synthesize(
        transcript,
        existingTopics,
        selectedTopic,
        getSemanticTopicContexts(sections),
      )
    : {
        topic: selectedTopic ?? 'Inbox',
        refinedText: transcript,
        tags: [],
        source: 'raw-fallback' as const,
      };
  const topicExists = existingTopics.some(
    header => header.trim().toLowerCase() === synthesized.topic.trim().toLowerCase(),
  );
  const mergeCandidate = !selectedTopic && topicExists;

  return {
    sourceKind: draft.sourceKind,
    transcript,
    refinedText: synthesized.refinedText,
    suggestedTopic: selectedTopic ?? synthesized.topic,
    tags: synthesized.tags,
    source: synthesized.source,
    selectedTopic,
    mergeCandidate,
    requiresApproval: mergeCandidate,
    voiceFile: draft.voiceFile ?? null,
  };
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
  if (isCompletedEvent) {
    queueCompletionRevision += 1;
  }
  const currentStatus = useAppStore.getState().status;
  const staleQueuedStatus =
    currentStatus === 'Stored for later' ||
    currentStatus === 'Voice note queued' ||
    currentStatus === BACKGROUND_QUEUE_SCHEDULED_STATUS ||
    currentStatus === BACKGROUND_QUEUE_SCHEDULE_FAILED_STATUS;
  const store = useAppStore.getState();
  const fallbackStatus = !store.liteRtEnabled
    ? 'Saved to Inbox: turn on the writing assistant in Settings to organize this note.'
    : !SynthesisService.getLiteRtReadiness()?.available
      ? store.selectedModelInstalled
        ? 'Saved to Inbox: the writing assistant could not start. Check Settings.'
        : 'Saved to Inbox: download the writing assistant in Settings to organize this note.'
      : 'Saved to Inbox: the writing assistant could not assign a topic. Retry this note from Inbox.';
  const completedStatus =
    state.pendingCount > 0
      ? `Processing ${state.pendingCount} thought${state.pendingCount === 1 ? '' : 's'}`
      : event.type === 'fallback'
        ? fallbackStatus
        : event.topic
          ? `Organized into ${event.topic}`
          : 'Note organized';
  const statusPatch =
    isCompletedEvent
      ? { status: completedStatus }
      : event.type === 'clarification' && state.clarification
        ? { status: `Needs topic choice: ${state.clarification.question}` }
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
    queueClarification: state.clarification,
    queueJobs: ProcessingQueueManager.getQueueSnapshot(),
    ...statusPatch,
  });

  if (event.type === 'completed' || event.type === 'fallback') {
    useAppStore.getState().loadContext().catch(error => {
      console.error('Failed to reload context after queue completion:', error);
    });
  }

  if (
    Platform.OS === 'android' &&
    event.type === 'blocked' &&
    state.pendingCount > 0 &&
    state.blockedReason?.startsWith('Waiting for device resources')
  ) {
    const completionRevision = queueCompletionRevision;
    scheduleQueuedSynthesisOnce().then(scheduled => {
      const current = useAppStore.getState();
      const latestQueue = ProcessingQueueManager.getState();
      if (
        completionRevision !== queueCompletionRevision ||
        latestQueue.pendingCount === 0 ||
        latestQueue.isProcessing ||
        latestQueue.clarification ||
        !current.queueBlockedReason?.startsWith('Waiting for device resources')
      ) {
        return;
      }

      const message = scheduled
        ? BACKGROUND_QUEUE_SCHEDULED_STATUS
        : BACKGROUND_QUEUE_SCHEDULE_FAILED_STATUS;
      useAppStore.setState({ status: message, queueBlockedReason: message });
    });
  }
};

const syncStoreToQueueState = (statusFallback: string) => {
  const queueState = ProcessingQueueManager.getState();
  useAppStore.setState({
    queueSize: queueState.pendingCount,
    pendingCount: queueState.pendingCount,
    isProcessing: queueState.isProcessing,
    currentThoughtId: queueState.currentThoughtId,
    lastQueueError: queueState.lastError,
    queueBlockedReason: queueState.blockedReason,
    queueClarification: queueState.clarification,
    queueJobs: ProcessingQueueManager.getQueueSnapshot(),
    status: queueState.blockedReason ?? statusFallback,
  });
};

const ensureQueueSubscription = () => {
  if (ProcessingQueueManager.hasListener(syncQueueStateToStore)) {
    return;
  }

  queueSubscription?.();
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
    'liteRtEnabled' | 'models' | 'selectedModelId' | 'selectedModelDownloading' | 'selectedModelProgress' | 'deviceReadiness'
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

  if (!selected.installed) {
    return null;
  }

  const readiness = state.deviceReadiness;
  if (shouldWaitForSynthesisResources(readiness)) {
    const cause = readiness?.reason === 'thermal' ? 'the device is warm' : 'available memory is low';
    const retryHint = Platform.OS === 'android'
      ? 'Android may retry while idle when resources recover; opening the app also retries.'
      : 'Open the app again when resources recover to retry synthesis.';
    return `Waiting for device resources: ${cause}. Your note is saved in Inbox. ${retryHint}`;
  }

  return null;
};

const getSelectedModelResourceBlockReason = (state: Pick<AppState, 'deviceReadiness'>): string | null => {
  const readiness = state.deviceReadiness;
  if (!shouldWaitForSynthesisResources(readiness)) {
    return null;
  }

  const cause = readiness?.reason === 'thermal' ? 'the device is warm' : 'available memory is low';
  return `Synthesis is waiting because ${cause}. Your note is saved in Inbox.`;
};

const syncSynthesisQueueGate = (state: Pick<
  AppState,
  'liteRtEnabled' | 'models' | 'selectedModelId' | 'selectedModelDownloading' | 'selectedModelProgress' | 'deviceReadiness'
>) => {
  ProcessingQueueManager.setProcessingBlockedReason(getModelBlockedReason(state));
};

export const useAppStore = create<AppState>((set, get) => {
  const initialModels = getSynthesisModels();
  const defaultModel = initialModels.find(model => model.recommended) ?? initialModels[0];
  let hydration: Promise<void> | null = null;
  let assistantPreferenceChanged = false;
  let modelPreferenceChanged = false;
  let modelDownloadInFlight = false;
  const persistPreferences = () => saveAppPreferences({
    liteRtEnabled: get().liteRtEnabled,
    selectedModelId: get().selectedModelId,
  }).catch(error => {
    console.warn('Could not save assistant preferences:', error);
    set({ status: 'Could not save assistant settings. Your choice may reset after restarting.' });
  });

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
    queueClarification: null,
    isInitialized: false,
    appIsActive: true,
    deviceReadiness: null,
    deviceReadinessNoticeVisible: false,
    deviceReadinessNoticeDismissed: false,
    audioReadiness: EMPTY_AUDIO_READINESS,
    manualCaptureEnabled: true,
    pushToRecordEnabled: RELEASE_CAPABILITIES.voiceCapture,
    wakeWordEnabled: false,
    lockScreenHeadsetTriggerEnabled: false,
    liteRtEnabled: true,
    models: initialModels,
    selectedModelId: defaultModel.id,
    selectedModelInstalled: defaultModel.installed,
    selectedModelDownloading: defaultModel.downloading,
    selectedModelProgress: defaultModel.progress,
    selectedModelError: defaultModel.error,
    selectedModelStatusMessage: defaultModel.statusMessage ?? null,
    queueJobs: [],
    preferencesHydrated: false,

    hydratePreferences: async () => {
      if (get().preferencesHydrated) return;
      hydration ??= (async () => {
        try {
          const saved = await loadAppPreferences();
          if (saved) set({
            ...(!assistantPreferenceChanged ? { liteRtEnabled: saved.liteRtEnabled } : {}),
            ...(!modelPreferenceChanged ? { selectedModelId: saved.selectedModelId } : {}),
          });
        } catch (error) {
          console.warn('Could not load assistant preferences:', error);
          if (!assistantPreferenceChanged) set({ liteRtEnabled: false });
        }
        set({ preferencesHydrated: true });
        syncModelConfig();
        syncSynthesisQueueGate(get());
      })();
      await hydration;
    },

    setStatus: status => set({ status }),

    dismissDeviceReadinessNotice: async () => {
      set({ deviceReadinessNoticeVisible: false, deviceReadinessNoticeDismissed: true });
      try {
        await markDeviceReadinessNoticeSeen();
      } catch (error) {
        console.warn('Could not save device-check dismissal:', error);
      }
    },

    refreshDeviceReadiness: async () => {
      const selectedModel = getSelectedModel(get());
      const readiness = await assessDeviceReadiness(Math.max(SYNTHESIS_MINIMUM_RAM_GB, selectedModel.minDeviceMemoryInGb));
      const noticeSeen = await hasSeenDeviceReadinessNotice();
      const previousBlockReason = ProcessingQueueManager.getState().blockedReason;
      const nextState = {
        ...get(),
        deviceReadiness: readiness,
      };
      const nextBlockReason = getModelBlockedReason(nextState);

      set({
        deviceReadiness: readiness,
        deviceReadinessNoticeVisible: !noticeSeen && !get().deviceReadinessNoticeDismissed,
      });

      const resumingAfterResourceWait =
        previousBlockReason?.startsWith('Waiting for device resources') && !nextBlockReason;
      if (
        resumingAfterResourceWait &&
        get().liteRtEnabled &&
        get().selectedModelInstalled &&
        !SynthesisService.getLiteRtReadiness()?.available
      ) {
        await SynthesisService.initialize();
      }

      syncSynthesisQueueGate({ ...get(), deviceReadiness: readiness });

      if (resumingAfterResourceWait) {
        await get().queueInboxForSynthesis({ announce: false });
      }

      return readiness;
    },

    setAppLifecycleState: async nextState => {
      await get().hydratePreferences();
      const appIsActive = nextState === 'active';
      set({ appIsActive });
      if (Platform.OS === 'android' && nextState === 'background') {
        try {
          await get().queueInboxForSynthesis({ announce: false });
          const queueState = ProcessingQueueManager.getState();
          if (queueState.pendingCount > 0 && !queueState.clarification) {
            const completionRevision = queueCompletionRevision;
            const scheduled = await scheduleQueuedSynthesisOnce();
            const latestQueue = ProcessingQueueManager.getState();
            if (
              completionRevision === queueCompletionRevision &&
              latestQueue.pendingCount > 0 &&
              !latestQueue.isProcessing &&
              !latestQueue.clarification
            ) {
              const status = scheduled
                ? BACKGROUND_QUEUE_SCHEDULED_STATUS
                : BACKGROUND_QUEUE_SCHEDULE_FAILED_STATUS;
              set({ status, queueBlockedReason: status });
            }
          }
        } catch (error) {
          console.error('Could not schedule durable Inbox work after backgrounding:', error);
        }
      }
      if (appIsActive) {
        try {
          if (await drainQuickTextOutbox()) {
            await get().loadContext();
            await get().queueInboxForSynthesis({ announce: false });
          }
        } catch (error) {
          console.error('Saved quick text will be retried on the next foreground:', error);
        }
      }
      if (!RELEASE_CAPABILITIES.wakeWord) {
        if (appIsActive) {
          await get().refreshDeviceReadiness();
        }
        return;
      }

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
      if (
        (key === 'pushToRecordEnabled' && !RELEASE_CAPABILITIES.voiceCapture) ||
        (key === 'wakeWordEnabled' && !RELEASE_CAPABILITIES.wakeWord) ||
        (key === 'lockScreenHeadsetTriggerEnabled' && !RELEASE_CAPABILITIES.headsetTrigger)
      ) {
        set({ [key]: false });
        return;
      }

      if (key === 'liteRtEnabled') {
        assistantPreferenceChanged = true;
        SynthesisService.configure({ liteRtEnabled: value, modelConfig: toLiteRtModelConfig(get().models.find(model => model.id === get().selectedModelId) ?? defaultModel) });
      }

      if (key === 'pushToRecordEnabled') {
        setHeadsetTriggerEnabled(value).catch(error => {
          console.error('Failed to sync headset trigger setting:', error);
        });
      }

      if (key === 'lockScreenHeadsetTriggerEnabled') {
        if (!value) {
          setLockScreenHeadsetCaptureEnabled(false).catch(error => {
            console.error('Failed to disable lock-screen headset capture:', error);
          });
          set({
            lockScreenHeadsetTriggerEnabled: false,
            status: 'Lock-screen headset capture disabled',
          });
          return;
        }

        if (!get().pushToRecordEnabled) {
          set({
            lockScreenHeadsetTriggerEnabled: false,
            status: 'Enable Push to Record first to use lock-screen capture',
          });
          return;
        }

        if (!get().audioReadiness.transcriptionReady) {
          set({
            lockScreenHeadsetTriggerEnabled: false,
            status: 'Lock-screen capture unavailable',
          });
          return;
        }

        (async () => {
          const hasPermission = await requestLockScreenCapturePermissions();
          if (!hasPermission) {
            set({
              lockScreenHeadsetTriggerEnabled: false,
              status: 'Allow the requested permissions to use lock-screen capture',
            });
            return;
          }

          try {
            await setLockScreenHeadsetCaptureEnabled(true);
            set({
              lockScreenHeadsetTriggerEnabled: true,
              status: 'Lock-screen headset capture enabled',
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Failed to enable lock-screen headset capture:', error);
            set({
              lockScreenHeadsetTriggerEnabled: false,
              status: message ? `Lock-screen capture unavailable: ${message}` : 'Lock-screen capture unavailable',
            });
          }
        })();
        return;
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

      if (key === 'pushToRecordEnabled' && !value && get().lockScreenHeadsetTriggerEnabled) {
        setLockScreenHeadsetCaptureEnabled(false).catch(error => {
          console.error('Failed to disable lock-screen headset capture after turning off Push to Record:', error);
        });
        set({
          lockScreenHeadsetTriggerEnabled: false,
        });
      }

      const nextState = {
        ...get(),
        [key]: value,
      };
      syncSynthesisQueueGate(nextState);
      set({ [key]: value });
      if (key === 'liteRtEnabled') void persistPreferences();
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
        queueClarification: state.clarification,
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
      if (modelDownloadInFlight) return;
      modelPreferenceChanged = true;
      await get().hydratePreferences();
      if (modelDownloadInFlight || get().selectedModelDownloading) return;
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
      await persistPreferences();
    },

    downloadModel: async modelId => {
      if (modelDownloadInFlight) return;
      modelDownloadInFlight = true;
      let checkingDeviceReadiness = false;
      try {
        modelPreferenceChanged = true;
        await get().hydratePreferences();
        if (get().selectedModelDownloading) return;
        const target = get().models.find(model => model.id === modelId);
        if (!target) return;
        const requiredMemoryGb = Math.max(SYNTHESIS_MINIMUM_RAM_GB, target.minDeviceMemoryInGb);
        checkingDeviceReadiness = true;
        set({
          selectedModelDownloading: true,
          selectedModelProgress: 0,
          selectedModelError: null,
          selectedModelStatusMessage: 'Checking device readiness',
        });
        const downloadReadiness = await assessDeviceReadiness(requiredMemoryGb);
        const requiredStorageBytes = target.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES;
        if (
          downloadReadiness.checkAvailable &&
          downloadReadiness.freeStorageBytes !== null &&
          downloadReadiness.freeStorageBytes < requiredStorageBytes
        ) {
          const requiredStorage = formatBytesAsGiB(requiredStorageBytes);
          const availableStorage = formatBytesAsGiB(downloadReadiness.freeStorageBytes);
          const message = `Free up storage before installing ${target.name}: about ${requiredStorage} is recommended; ${availableStorage} is available.`;
          checkingDeviceReadiness = false;
          set({
            selectedModelDownloading: false,
            selectedModelError: message,
            selectedModelStatusMessage: message,
            status: message,
          });
          return;
        }
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
      await persistPreferences();
      syncSynthesisQueueGate({
        ...get(),
        models: startingModels,
        selectedModelId: modelId,
        selectedModelDownloading: true,
        selectedModelProgress: 0,
      });
      checkingDeviceReadiness = false;

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
        const readiness = await assessDeviceReadiness(requiredMemoryGb);
        set({ deviceReadiness: readiness });
        syncSynthesisQueueGate({ ...get(), deviceReadiness: readiness });
        const belowMinimum = readiness.checkAvailable && readiness.meetsSynthesisMinimum === false;
        const performanceWarning = belowMinimum
          ? `${target.name} is below this device’s ${requiredMemoryGb} GB RAM minimum. Synthesis may be slow or fail; notes stay saved in Inbox.`
          : null;
        if (shouldWaitForSynthesisResources(readiness)) {
          await get().queueInboxForSynthesis({ announce: false });
          const resourceWait = readiness.reason === 'thermal'
            ? 'Synthesis is waiting until the device cools down.'
            : 'Synthesis is waiting until more memory is free.';
          const message = `Installed ${target.name}. ${resourceWait} ${performanceWarning ?? 'Notes stay in Inbox.'}`;
          set({
            selectedModelId: modelId,
            selectedModelDownloading: false,
            selectedModelProgress: 100,
            selectedModelError: message,
            selectedModelStatusMessage: message,
            status: message,
          });
          return;
        }
        SynthesisService.configure({
          liteRtEnabled: get().liteRtEnabled,
          modelConfig: toLiteRtModelConfig(downloaded),
        });
        const runtimeReadiness = await SynthesisService.initialize();
        if (!runtimeReadiness.available) {
          const message = `Installed ${target.name}, but synthesis could not start. ${performanceWarning ?? ''} ${runtimeReadiness.detail} Notes remain in Inbox.`.replace(/\s+/g, ' ').trim();
          set({
            selectedModelId: modelId,
            selectedModelDownloading: false,
            selectedModelProgress: 100,
            selectedModelError: null,
            selectedModelStatusMessage: message,
            status: message,
          });
          return;
        }
        await get().queueInboxForSynthesis({ announce: false });
        set({
          selectedModelId: modelId,
          selectedModelDownloading: false,
          selectedModelProgress: 100,
          selectedModelError: null,
          selectedModelStatusMessage: performanceWarning,
          status: performanceWarning ?? `Downloaded ${target.name}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const modelInstalled = get().models.find(model => model.id === modelId)?.installed ?? false;
        const status = modelInstalled
          ? `Installed ${target.name}, but synthesis could not start: ${message}. Notes remain in Inbox.`
          : `Model download failed: ${message}`;
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
          selectedModelError: modelInstalled ? status : message,
          selectedModelStatusMessage: status,
          status,
        });
      }
      } finally {
        if (checkingDeviceReadiness) {
          set({ selectedModelDownloading: false, selectedModelStatusMessage: null });
        }
        modelDownloadInFlight = false;
      }
    },

    removeModel: async modelId => {
      const target = get().models.find(model => model.id === modelId);
      if (!target) return;

      await SynthesisService.release();
      await removeSynthesisModel(target);
      await get().refreshModels();
      set({
        status: `Removed ${target.name}`,
      });
    },

    initializeEngine: async (options: InitializeEngineOptions = {}) => {
      await get().hydratePreferences();
      let recoveryWarning: string | null = null;
      try {
        await get().recoverInterruptedRecordings();
      } catch (error) {
        recoveryWarning = error instanceof Error ? error.message : String(error);
        console.warn('[Capture] Startup continues with retained recording recovery pending:', error);
      }
      const { eagerAudio = true, eagerSynthesis = true } = options;
      let audioReady = false;
      let audioReadiness = EMPTY_AUDIO_READINESS;
      await get().refreshModels();
      const deviceReadiness = await get().refreshDeviceReadiness();
      syncModelConfig();
      const modelInstalled = get().models.find(model => model.id === get().selectedModelId)?.installed ?? false;

      if (eagerAudio && RELEASE_CAPABILITIES.voiceCapture) {
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
        const readinessBlock = getModelBlockedReason({ ...get(), deviceReadiness });
        if (readinessBlock) {
          set({
            isInitialized: audioReady,
            audioReadiness,
            status: readinessBlock,
          });
        } else try {
          const readiness = await SynthesisService.initialize();
          set({
            isInitialized: audioReady,
            audioReadiness,
            status: !RELEASE_CAPABILITIES.voiceCapture
              ? readiness.available ? 'Ready for local capture' : modelInstalled ? 'AI Offline' : 'Model missing'
              : readiness.available
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
            status: !RELEASE_CAPABILITIES.voiceCapture || audioReady
              ? (modelInstalled ? 'AI Offline' : 'Model missing') : 'Audio Unavailable',
          });
        }
      } else if (!audioReady) {
        set({ isInitialized: false, status: 'Ready for local capture' });
      }

      if (eagerSynthesis) {
        await get().queueInboxForSynthesis({ announce: false });
      }
      if (recoveryWarning) set({ status: `Recording recovery needs attention: ${recoveryWarning}` });
    },

    loadContext: async () => {
      const data = await ContextManager.readContext();
      set({ sections: data });
    },

    exportLibraryBackup: async () => {
      const backup = await ContextManager.createBackup();
      return exportLibraryBackupFile(backup);
    },

    restoreLibraryBackup: async () => {
      const file = await pickLibraryBackupFile();
      if (!file) return null;
      const result = await ContextManager.mergeBackup(file.content);
      await get().loadContext();
      return result;
    },

    addThought: async (text, kind = 'text') => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const savedThought = await persistCaptureToInbox(trimmed, kind);
      await get().loadContext();
      await get().hydratePreferences();
      const queuedId = ProcessingQueueManager.addToQueue(trimmed, kind, savedThought, {
        noteId: savedThought.noteId,
        selectedTopic: null,
      });
      syncStoreToQueueState(queuedId ? 'Stored for later' : get().status);
    },

    analyzeImportDraft: async draft => {
      await get().hydratePreferences();
      set({ status: draft.sourceKind === 'voice' ? 'Previewing voice import' : 'Previewing text import' });
      try {
        const resourceBlockReason = getSelectedModelResourceBlockReason(get());
        const preview = await resolveImportPreview(draft, !resourceBlockReason);
        set({
          status: resourceBlockReason
            ? 'Synthesis is waiting for device resources; import can still be saved to Inbox'
            : preview.requiresApproval
            ? `Merge into ${preview.suggestedTopic} requires approval`
            : preview.selectedTopic
              ? `Ready to import into ${preview.selectedTopic}`
              : `Ready to import into ${preview.suggestedTopic}`,
        });
        return preview;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ status: `Import preview failed: ${message}` });
        throw error;
      }
    },

    queueImportedThought: async (preview, options = {}) => {
      if (preview.sourceKind === 'voice' && !RELEASE_CAPABILITIES.voiceImport) {
        throw new Error('Voice import is planned for a future release');
      }
      const approvedTopic = normalizeTopicInput(options.approvedTopic);
      const explicitTopic = normalizeTopicInput(preview.selectedTopic);

      if (preview.requiresApproval && !approvedTopic) {
        throw new Error(`Approve merge into ${preview.suggestedTopic} before importing`);
      }

      const selectedTopic = approvedTopic ?? explicitTopic ?? null;
      const noteId = createNoteId('import');
      const sourceMetadata = buildImportSourceMetadata(
        {
          sourceKind: preview.sourceKind,
          text: preview.sourceKind === 'text' ? preview.transcript : undefined,
          voiceFile: preview.voiceFile,
          selectedTopic,
        },
        preview.transcript,
      );

      const savedThought = await persistCaptureToInbox(preview.transcript, preview.sourceKind, {
        noteId,
        sourceMetadata,
      });
      await get().loadContext();

      const queuedId = ProcessingQueueManager.addToQueue(
        preview.transcript,
        preview.sourceKind,
        savedThought,
        {
          noteId,
          selectedTopic,
          skipVoiceDelay: preview.sourceKind === 'voice',
          sourceMetadata,
        },
      );

      const queueState = ProcessingQueueManager.getState();
      set({
        queueSize: queueState.pendingCount,
        pendingCount: queueState.pendingCount,
        isProcessing: queueState.isProcessing,
        currentThoughtId: queueState.currentThoughtId,
        lastQueueError: queueState.lastError,
        queueBlockedReason: queueState.blockedReason,
        queueClarification: queueState.clarification,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        status: queuedId
          ? selectedTopic
            ? `Queued import for ${selectedTopic}`
            : preview.source === 'raw-fallback'
              ? 'Queued import to Inbox'
              : 'Queued import for synthesis'
          : get().status,
      });

      return noteId;
    },

    queueInboxForSynthesis: async (options = {}) => {
      await get().hydratePreferences();
      const { announce = true } = options;
      const sections = await ContextManager.readContext();
      const inboxThoughts = ContextManager.getInboxThoughts(sections);
      const queuedSources = new Set(
        ProcessingQueueManager.getQueueSnapshot()
          .map(item => item.sourceContext ? `${item.sourceContext.sectionHeader}\n${item.sourceContext.noteId ?? item.sourceContext.thoughtId ?? item.sourceContext.thoughtText}` : null)
          .filter((source): source is string => Boolean(source)),
      );
      let queuedCount = 0;
      let alreadyCoveredCount = 0;

      for (const thought of inboxThoughts) {
        const sourceKey = `${thought.sectionHeader}\n${thought.noteId}`;
        if (queuedSources.has(sourceKey)) {
          alreadyCoveredCount += 1;
          continue;
        }

        if (isRetainedVoiceFailure(thought)) {
          continue;
        }

        let sourceMetadata = thought.sourceMetadata;
        if (isAppOwnedCaptureAudioPath(sourceMetadata?.audioFilePath)) {
          if (thought.sourceKind !== 'voice') continue;
          const audioFilePath = sourceMetadata.audioFilePath!;
          const cleaned = await get().deleteRetainedAudioFromNote({
            sectionHeader: thought.sectionHeader,
            noteId: thought.noteId,
            thoughtText: thought.text,
            audioFilePath,
            transcriptionError: sourceMetadata.transcriptionError ?? null,
          });
          if (!cleaned) continue;
          sourceMetadata = { ...sourceMetadata, audioFilePath: null };
        }

        const transcript = thought.sourceTranscript?.trim() || thought.text;
        const id = ProcessingQueueManager.addToQueue(transcript, thought.sourceKind ?? 'text', {
          sectionHeader: thought.sectionHeader,
          thoughtText: thought.text,
          thoughtId: thought.id,
          noteId: thought.noteId,
          sourceMetadata,
        }, {
          noteId: thought.noteId,
          selectedTopic: null,
          sourceMetadata,
        });

        if (id) {
          queuedSources.add(sourceKey);
          queuedCount += 1;
        } else {
          alreadyCoveredCount += 1;
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
        queueClarification: queueState.clarification,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        ...(announce
          ? {
              status:
                queuedCount > 0
                  ? `Queued ${queuedCount} Inbox item${queuedCount === 1 ? '' : 's'} for synthesis`
                  : alreadyCoveredCount > 0
                    ? get().status
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
        queueClarification: queueState.clarification,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        status: 'Queued item updated',
      });

      return true;
    },

    resolveQueueClarification: (thoughtId, selectedTopic) => {
      const resolved = ProcessingQueueManager.resolveClarification(thoughtId, selectedTopic);
      if (!resolved) {
        set({ status: 'Choose one of the suggested topics to continue' });
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
        queueClarification: queueState.clarification,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        status: `Resuming synthesis for ${selectedTopic.trim()}`,
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
        queueBlockedReason: queueState.blockedReason,
        queueClarification: queueState.clarification,
        queueJobs: ProcessingQueueManager.getQueueSnapshot(),
        status: 'Queue item ended',
      });
    },

    deleteRetainedAudioFromNote: async note => {
      if (note.sectionHeader.trim().toLowerCase() !== 'inbox') {
        set({ status: 'Only unsynthesized Inbox audio can be deleted here' });
        return false;
      }

      const audioFilePath = note.audioFilePath?.trim();
      if (!audioFilePath || !isAppOwnedCaptureAudioPath(audioFilePath)) {
        set({ status: 'Only Context Engine capture audio can be deleted here' });
        return false;
      }

      const updated = await ContextManager.updateThought(note.sectionHeader, note.noteId, {
        sourceMetadata: { audioFilePath: null, transcriptionError: null },
      });
      if (!updated) {
        set({ status: 'Retained audio could not be removed' });
        return false;
      }

      try {
        await audioEngine.deleteRetainedAudioFile(audioFilePath);
      } catch (error) {
        await ContextManager.updateThought(note.sectionHeader, note.noteId, {
          sourceMetadata: { audioFilePath, transcriptionError: note.transcriptionError ?? null },
        }).catch(() => false);
        await get().loadContext();
        const message = error instanceof Error ? error.message : String(error);
        set({ status: `Retained audio deletion failed: ${message}` });
        return false;
      }

      await get().loadContext();
      set({ status: 'Retained audio deleted' });
      return true;
    },

    recoverInterruptedRecordings: async () => {
      if (Platform.OS !== 'android' || get().isRecording || isRecordingActive(get().recordingState)) return 0;
      try {
        const recovered = await audioEngine.recoverInterruptedRecordings(async (audioFilePath, noteId) => {
          await persistCaptureToInbox('Voice capture retained', 'voice', {
            noteId,
            sourceMetadata: { audioFilePath },
          });
        });
        if (recovered) {
          await get().loadContext();
          set({ status: 'Interrupted audio recovered in Inbox' });
        }
        return recovered;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ status: `Recording recovery needs attention: ${message}` });
        throw error;
      }
    },

    retryRetainedInboxAudio: async (options = {}) => {
      const noRecovery = { recovered: 0, hasMore: false };
      if (Platform.OS !== 'android' || get().isRecording || isRecordingActive(get().recordingState)) {
        return noRecovery;
      }

      const sections = await ContextManager.readContext();
      const candidates = ContextManager.getInboxThoughts(sections).filter(thought =>
        Boolean(thought.noteId?.trim()) &&
        isRetainedVoiceFailure(thought) &&
        isAppOwnedCaptureAudioPath(thought.sourceMetadata?.audioFilePath),
      );
      if (candidates.length === 0) return noRecovery;

      try {
        const eligible = [];
        for (const thought of candidates) {
          const filename = thought.sourceMetadata!.audioFilePath!.trim().split('/').pop();
          const attemptPath = `${RETAINED_AUDIO_RETRY_DIRECTORY}/${filename}.txt`;
          const lastAttempt = await RNFS.exists(attemptPath)
            ? Number(await RNFS.readFile(attemptPath, 'utf8'))
            : 0;
          if (!Number.isFinite(lastAttempt)) throw new Error('Invalid retained-audio retry checkpoint');
          if (Date.now() - lastAttempt >= RETAINED_AUDIO_RETRY_COOLDOWN_MS) {
            eligible.push({ thought, attemptPath });
          }
        }
        if (eligible.length === 0) return noRecovery;
        const audioReadiness = await audioEngine.initializeModels();
        set({ audioReadiness, isInitialized: audioReadiness.transcriptionReady });
        if (!audioReadiness.transcriptionReady || get().isRecording || isRecordingActive(get().recordingState)) {
          return noRecovery;
        }

        const { thought, attemptPath } = eligible[0];
        await RNFS.mkdir(RETAINED_AUDIO_RETRY_DIRECTORY);
        // Checkpoint before decoding so process death or non-speech cannot starve the remaining backlog.
        await RNFS.writeFile(attemptPath, String(Date.now()), 'utf8');
        ensureQueueSubscription();
        syncSynthesisQueueGate(get());
        const recovered = await get().retranscribeRetainedAudioFromNote({
          sectionHeader: thought.sectionHeader,
          noteId: thought.noteId,
          thoughtText: thought.text,
          audioFilePath: thought.sourceMetadata?.audioFilePath,
        }, options);
        return { recovered: recovered ? 1 : 0, hasMore: eligible.length > 1 };
      } catch (error) {
        console.warn('[Capture] Background transcription unavailable; recordings remain in Inbox:', error);
        return noRecovery;
      }
    },

    retranscribeRetainedAudioFromNote: async (note, { queueSynthesis = true } = {}) => {
      const noteId = note.noteId.trim();
      if (
        note.sectionHeader.trim().toLowerCase() !== 'inbox' ||
        !noteId ||
        get().isRecording ||
        isRecordingActive(get().recordingState) ||
        retainedAudioRetries.has(noteId)
      ) {
        return false;
      }

      const queuedForNote = () => ProcessingQueueManager.getQueueSnapshot().some(item =>
        item.noteId === noteId ||
        item.sourceContext?.noteId === noteId ||
        item.sourceContext?.thoughtId === noteId,
      );
      if (queuedForNote()) return false;

      retainedAudioRetries.add(noteId);
      try {
        const findRetainedThought = async () => {
          const sections = await ContextManager.readContext();
          return ContextManager.getInboxThoughts(sections).find(thought => thought.noteId === noteId);
        };
        const thought = await findRetainedThought();
        const audioFilePath = thought?.sourceMetadata?.audioFilePath;
        if (
          !thought ||
          thought.sectionHeader.trim().toLowerCase() !== 'inbox' ||
          thought.sourceKind !== 'voice' ||
          thought.text !== note.thoughtText ||
          !isRetainedVoiceFailure(thought) ||
          !audioFilePath ||
          audioFilePath !== note.audioFilePath ||
          !isAppOwnedCaptureAudioPath(audioFilePath)
        ) {
          return false;
        }

        let result: TranscriptionResult;
        try {
          result = await audioEngine.transcribeFile(audioFilePath);
        } catch (error) {
          console.warn('[Capture] Retained-audio transcription retry failed:', error);
          return false;
        }
        const transcript = result.text.trim();
        if (!transcript) return false;

        const currentThought = await findRetainedThought();
        if (
          get().isRecording ||
          isRecordingActive(get().recordingState) ||
          queuedForNote() ||
          !currentThought ||
          currentThought.sourceKind !== 'voice' ||
          currentThought.text !== note.thoughtText ||
          !isRetainedVoiceFailure(currentThought) ||
          currentThought.sourceMetadata?.audioFilePath !== audioFilePath
        ) {
          return false;
        }

        const sourceMetadata: NoteSourceMetadata = {
          ...currentThought.sourceMetadata,
          kind: 'voice',
          transcript,
          noteId,
          audioFilePath,
          transcriptionError: result.error ?? null,
        };
        const updated = await ContextManager.updateThought('Inbox', noteId, {
          text: transcript,
          sourceMetadata,
        });
        if (!updated) return false;
        if (result.error) {
          await get().loadContext();
          set({ status: 'Partial transcript saved in Inbox; recording retained for review' });
          return false;
        }

        let audioDeleted: boolean;
        try {
          audioDeleted = await get().deleteRetainedAudioFromNote({
            sectionHeader: 'Inbox',
            noteId,
            thoughtText: transcript,
            audioFilePath,
          });
        } catch (error) {
          console.warn('[Capture] Transcript saved, but retained-audio cleanup failed:', error);
          await get().loadContext().catch(refreshError => {
            console.warn('[Capture] Transcript saved, but Inbox refresh failed:', refreshError);
          });
          set({ status: 'Transcript recovered in Inbox; recording cleanup could not be confirmed.' });
          return false;
        }

        if (!audioDeleted) {
          await get().loadContext().catch(error => {
            console.warn('[Capture] Transcript saved, but Inbox refresh failed:', error);
          });
          set({ status: 'Transcript recovered in Inbox; delete the retained recording before synthesis.' });
          return false;
        }

        const queuedMetadata: NoteSourceMetadata = { ...sourceMetadata, audioFilePath: null };
        await get().loadContext().catch(error => {
          console.warn('[Capture] Transcript saved, but Inbox refresh failed:', error);
        });

        if (!queueSynthesis) {
          set({ status: 'Transcript recovered in Inbox' });
          return true;
        }

        const savedThought = {
          sectionHeader: 'Inbox',
          thoughtText: transcript,
          thoughtId: noteId,
          noteId,
          sourceMetadata: queuedMetadata,
        };
        const queuedId = ProcessingQueueManager.addToQueue(transcript, 'voice', savedThought, {
          noteId,
          selectedTopic: null,
          skipVoiceDelay: true,
          sourceMetadata: queuedMetadata,
        });

        syncStoreToQueueState(queuedId ? 'Voice note queued' : get().status);
        return true;
      } catch (error) {
        console.warn('[Capture] Could not retry retained audio:', error);
        return false;
      } finally {
        retainedAudioRetries.delete(noteId);
      }
    },

    deleteUnsynthesizedNote: async note => {
      if (note.sectionHeader.trim().toLowerCase() !== 'inbox') {
        set({ status: 'Only unsynthesized Inbox notes can be deleted here' });
        return false;
      }

      const queueRemoval = ProcessingQueueManager.removePendingThoughtsByNoteId(note.noteId);
      if (queueRemoval.blockedByActive) {
        set({ status: 'Wait for this note to finish processing before deleting it' });
        return false;
      }

      const removed = await ContextManager.removeThought(
        note.sectionHeader,
        note.thoughtText,
        note.noteId,
      );
      if (!removed) {
        syncStoreToQueueState('Note could not be deleted');
        return false;
      }

      let audioCleanupError: string | null = null;
      if (note.audioFilePath && isAppOwnedCaptureAudioPath(note.audioFilePath)) {
        try {
          await audioEngine.deleteRetainedAudioFile(note.audioFilePath);
        } catch (error) {
          audioCleanupError = error instanceof Error ? error.message : String(error);
        }
      }

      await get().loadContext();
      syncStoreToQueueState(
        audioCleanupError
          ? `Note deleted; retained audio cleanup failed: ${audioCleanupError}`
          : 'Unsynthesized note deleted',
      );
      return true;
    },

    startCapture: async () => {
      if (!RELEASE_CAPABILITIES.voiceCapture) return;
      let latestReadiness = get().audioReadiness;
      if (!latestReadiness.transcriptionReady) {
        latestReadiness = await audioEngine.initializeModels();
        set({ audioReadiness: latestReadiness });
      }

      if (!latestReadiness.transcriptionReady || !get().pushToRecordEnabled) {
        set({ status: 'Recording unavailable' });
        return;
      }

      const recordingState = get().recordingState;
      if (recordingState !== 'idle' && recordingState !== 'error') {
        return;
      }
      if (recordingState === 'error') {
        set(recordingStatePatch('idle', 'Capture Ready'));
      }

      set(recordingStatePatch('starting', 'Starting...'));

      try {
        const hasPermission = await requestAudioPermissions();
        if (!hasPermission) {
          set(recordingStatePatch('idle', 'Microphone access needed'));
          return;
        }

        const notificationPermission = await requestRecordingNotificationPermission();
        await audioEngine.startRecording(() => {
          // Terminal stream failures use the same stop/retention path as every Stop surface.
          if (get().recordingState === 'starting') set(recordingStatePatch('recording', 'Stopping failed microphone...'));
          void get().stopCapture();
        });
        if (get().recordingState !== 'starting') return;
        const inputLabel = audioEngine.getCaptureInputLabel?.();
        const listeningStatus = inputLabel ? `Listening with ${inputLabel}` : 'Listening...';
        set(recordingStatePatch(
          'recording',
          notificationPermission ? listeningStatus : `${listeningStatus} · stop from app`,
        ));
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
      if (!RELEASE_CAPABILITIES.voiceCapture) return;
      if (get().recordingState !== 'recording') return;
      let captureResult: TranscriptionResult | undefined;
      let transcriptSaved = false;
      let retainedNoteId: string | undefined;
      let retainedAudioFilePath: string | undefined;
      let retainedCaptureSaved = false;
      const persistRetainedCapture = async (audioFilePath: string, noteId?: string) => {
        retainedAudioFilePath = audioFilePath;
        if (retainedCaptureSaved) return;
        retainedNoteId ??= noteId ?? createNoteId('voice-retained');
        await persistCaptureToInbox('Voice capture retained', 'voice', {
          noteId: retainedNoteId,
          sourceMetadata: { audioFilePath },
        });
        retainedCaptureSaved = true;
        await get().loadContext();
        set(recordingStatePatch('transcribing', 'Transcribing...'));
      };
      const retainedStatus = () => retainedAudioFilePath && !isAppOwnedRetainedAudioPath(retainedAudioFilePath)
        ? 'Temporary audio saved in Inbox; durable storage failed'
        : 'Audio retained in Inbox';
      const saveTranscript = async (result: TranscriptionResult) => {
        const audioFilePath = result.audioFilePath ?? retainedAudioFilePath;
        let savedThought: Awaited<ReturnType<typeof persistCaptureToInbox>>;
        if (retainedCaptureSaved && retainedNoteId) {
          const sourceMetadata: NoteSourceMetadata = {
            kind: 'voice', transcript: result.text, noteId: retainedNoteId, audioFilePath,
          };
          const updated = await ContextManager.updateThought('Inbox', retainedNoteId, {
            text: result.text, sourceMetadata,
          });
          if (!updated) throw new Error('Retained note could not be updated; recording preserved');
          savedThought = { noteId: retainedNoteId, sectionHeader: 'Inbox', thoughtText: result.text, sourceMetadata };
        } else {
          savedThought = await persistCaptureToInbox(result.text, 'voice', {
            noteId: retainedNoteId,
            sourceMetadata: audioFilePath ? { audioFilePath } : undefined,
          });
        }
        transcriptSaved = true;
        if (audioFilePath) {
          const cleaned = await get().deleteRetainedAudioFromNote({
            sectionHeader: 'Inbox', noteId: savedThought.noteId, thoughtText: result.text, audioFilePath,
          });
          if (!cleaned) {
            set(recordingStatePatch('error', 'Transcript saved in Inbox; recording cleanup needs attention'));
            return;
          }
          savedThought.sourceMetadata = { ...savedThought.sourceMetadata, audioFilePath: null };
        }
        await get().loadContext();
        const queuedId = ProcessingQueueManager.addToQueue(result.text, 'voice', savedThought, {
          noteId: savedThought.noteId, selectedTopic: null,
        });
        syncStoreToQueueState(queuedId ? 'Voice note queued' : get().status);
        set(recordingStatePatch('idle', useAppStore.getState().status));
      };

      try {
        set(recordingStatePatch('stopping', 'Stopping...'));
        const completion = audioEngine.stopRecording(persistRetainedCapture).then(async result => {
          captureResult = result;
          set(recordingStatePatch('transcribing', 'Transcribing...'));

          if (result.text.trim() && result.error) {
            if (result.audioFilePath) await persistRetainedCapture(result.audioFilePath);
            const sourceMetadata: NoteSourceMetadata = {
              kind: 'voice', transcript: result.text, noteId: retainedNoteId,
              audioFilePath: result.audioFilePath ?? retainedAudioFilePath,
              transcriptionError: result.error,
            };
            if (retainedCaptureSaved && retainedNoteId) {
              const updated = await ContextManager.updateThought('Inbox', retainedNoteId, {
                text: result.text, sourceMetadata,
              });
              if (!updated) throw new Error('Partial transcript could not be saved; recording preserved');
            } else {
              await persistCaptureToInbox(result.text, 'voice', { noteId: retainedNoteId, sourceMetadata });
            }
            transcriptSaved = true;
            await get().loadContext();
            set(recordingStatePatch('error', `Partial transcript saved in Inbox; ${result.error}`));
            return result;
          }

          if (result.text.trim()) {
            await saveTranscript(result);
            return result;
          }

          if (result.audioFilePath) {
            await persistRetainedCapture(result.audioFilePath);
            set(recordingStatePatch('error', retainedStatus()));
            return result;
          }

          if (result.error) {
            set(recordingStatePatch('error', `Process Error: ${result.error}`));
            return result;
          }

          if (retainedCaptureSaved) {
            set(recordingStatePatch('error', retainedStatus()));
          } else {
            set(recordingStatePatch('idle', 'No speech'));
            setTimeout(() => set({ status: 'Idle' }), 2000);
          }
          return result;
        }).catch(async error => {
          const audioFilePath = retainedAudioFilePath ?? captureResult?.audioFilePath;
          if (audioFilePath && !retainedCaptureSaved && !transcriptSaved) {
            try {
              await persistRetainedCapture(audioFilePath);
            } catch (retentionError) {
              console.error('[Capture] Failed to persist retained voice audio in Inbox:', retentionError);
            }
          }
          const message = error instanceof Error ? error.message : String(error);
          set(recordingStatePatch(
            'error',
            retainedCaptureSaved
              ? retainedStatus()
              : message ? `Process Error: ${message}` : 'Process Error',
          ));
          return captureResult;
        });

        return await withTimeout(
          completion,
          STOP_CAPTURE_TIMEOUT_MS,
          'Capture stop timed out',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/timed out/i.test(message)) {
          set(recordingStatePatch(
            'transcribing',
            retainedCaptureSaved
              ? 'Audio saved in Inbox; transcription continues'
              : 'Saving audio; transcription continues',
          ));
          return;
        }
        set(recordingStatePatch('error', message ? `Process Error: ${message}` : 'Process Error'));
      }
    },

    runTranscriptionProbe: async () => {
      if (!RELEASE_CAPABILITIES.voiceCapture) return;
      if (!get().audioReadiness.transcriptionReady) {
        return;
      }

      try {
        const result = await audioEngine.transcribeFile(QA_SAMPLE_WAV);
        set({
          status: result.text ? `QA transcript: ${result.text.slice(0, 240)}` : 'QA transcript: no speech detected',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ status: `QA transcript failed: ${message}` });
      }
    },
  };
});
