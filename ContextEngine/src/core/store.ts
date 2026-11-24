import { drainQuickTextOutbox } from '../modules/BackgroundSynthesis/quickTextCapture';
import { create } from 'zustand';
import { loadAppPreferences, saveAppPreferences, type MeetingRetention } from './appPreferences';
import RNFS from 'react-native-fs';
import { RELEASE_CAPABILITIES } from './releaseCapabilities';
import type { MeetingActionSuggestion, MeetingSession, MeetingTranscriptSegment } from '../features/meetings/meetingTypes';
import { meetingAudioRetentionMs } from '../features/meetings/meetingTypes';
import { createMeeting, listMeetings, updateMeeting } from '../features/meetings/meetingRepository';
import { extractMeetingHighlights } from '../features/meetings/meetingSummary';
import { formatMeetingContent } from '../shared/utils/meetingContent';
import { inferReminderLocally, isCompletedOrNegated } from '../modules/AutomaticReminders/planning';

import { AppStateStatus, NativeModules, Platform } from 'react-native';

import { ContextSection, ContextManager, type BackupMergeResult } from '../modules/ContextManager';
import { AudioEngineImpl } from '../modules/AudioEngine/AudioEngineImpl';
import type { AudioReadiness } from '../modules/AudioEngine';
import { getWhisperModelSize, type WhisperModelDownloadProgress } from '../modules/AudioEngine/whisperModelManager';
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE,
  type TranscriptionLanguage,
} from '../shared/languages/transcriptionLanguages';
import type { TranscriptionResult } from '../modules/AudioEngine';
import type { NoteSourceMetadata } from '../shared/notes/noteTypes';
import { ALLOWED_VOICE_IMPORT_LABEL, isSupportedVoiceImportPath, normalizeVoiceImportPath } from '../shared/utils/voiceImport';
import type { RecordingState } from '../features/capture/captureTypes';
import type { ImportDraft, ImportPreview } from './importTypes';
import {
  downloadSynthesisModel,
  getRequiredSynthesisModelStorageBytes,
  getSynthesisModels,
  removeSynthesisModel,
  resolveModelViews,
  type SynthesisModelDownloadProgress,
  type SynthesisModelView,
} from '../modules/SynthesisEngine/modelManager';
import { SynthesisService } from '../modules/SynthesisEngine/SynthesisService';
import { ProcessingQueueManager, QueueEvent, QueueState, PendingThought } from '../modules/SynthesisEngine/ProcessingQueueManager';
import { getAutomaticSynthesisModelId, getDefaultSynthesisModel, toLiteRtModelConfig } from '../modules/SynthesisEngine/models';
import { setHeadsetTriggerEnabled, setLockScreenHeadsetCaptureEnabled } from '../modules/HeadsetTrigger';
import {
  scheduleModelDownloads,
  scheduleQueuedSynthesis,
  scheduleUserInitiatedModelDownload,
} from '../modules/BackgroundSynthesis';
import { QA_SAMPLE_WAV } from '../shared/audio/sampleAudio';
import { createNoteId } from '../shared/notes/noteTypes';
import {
  requestAudioPermissions,
  requestLockScreenCapturePermissions,
  requestModelDownloadNotificationPermission,
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
  meetings: MeetingSession[];
  activeMeetingId: string | null;
  meetingTranscriptionRetryActive: boolean;
  meetingSummaryProcessingActive: boolean;
  meetingAudioRetention: MeetingRetention;
  transcriptionLanguage: TranscriptionLanguage;
  isRecording: boolean;
  recordingState: RecordingState;
  widgetVoiceCaptureActive: boolean;
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
  whisperModelDownloading: boolean;
  whisperModelProgress: number;
  whisperModelError: string | null;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  wakeWordEnabled: boolean;
  lockScreenHeadsetTriggerEnabled: boolean;
  liteRtEnabled: boolean;
  models: SynthesisModelView[];
  selectedModelId: string;
  modelSelectionIsAutomatic: boolean;
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
  queueImportedThought: (preview: ImportPreview, options?: { approvedTopic?: string | null; sharedContentId?: string }) => Promise<string>;
  autoFileSharedContent: (text: string, sharedContentId: string) => Promise<boolean>;
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
  loadMeetings: () => Promise<void>;
  startMeeting: () => Promise<string | null>;
  stopMeeting: () => Promise<void>;
  retryMeetingTranscription: (meetingId: string) => Promise<void>;
  retryMeetingSummary: (meetingId: string, automaticRetry?: boolean) => Promise<void>;
  updateMeetingAction: (meetingId: string, actionId: string, state: 'confirmed' | 'dismissed') => Promise<void>;
  saveMeetingToNotes: (meetingId: string) => Promise<void>;
  setMeetingAudioRetention: (retention: MeetingRetention) => Promise<void>;
  runTranscriptionProbe: () => Promise<void>;
  downloadWhisperModel: (waitForActive?: boolean, userInitiated?: boolean) => Promise<void>;
  setTranscriptionLanguage: (language: TranscriptionLanguage) => Promise<void>;
  initializeEngine: (options?: InitializeEngineOptions) => Promise<void>;
  hydratePreferences: () => Promise<void>;
  preferencesHydrated: boolean;
  recoverInterruptedRecordings: () => Promise<number>;
  refreshModels: (refreshAudioReadiness?: boolean) => Promise<void>;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string, waitForActive?: boolean, userInitiated?: boolean, selectForSynthesis?: boolean) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  setStatus: (status: string) => void;
  setAppLifecycleState: (nextState: AppStateStatus) => Promise<void>;
  setCaptureSetting: (
    key: 'manualCaptureEnabled' | 'pushToRecordEnabled' | 'wakeWordEnabled' | 'lockScreenHeadsetTriggerEnabled' | 'liteRtEnabled',
    value: boolean,
  ) => Promise<void>;
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
  'Saved in Inbox. It will be sorted when your device is ready.';
const BACKGROUND_QUEUE_SCHEDULE_FAILED_STATUS =
  'Saved in Inbox. Open the app again to continue sorting it.';

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
  readiness.resourcesAvailable === false;

const shouldAutoDownloadModel = (
  model: SynthesisModelView,
  readiness: DeviceReadinessAssessment | null | undefined,
) =>
  (Platform.OS === 'android' || Platform.OS === 'ios') &&
  !readiness?.isSimulator &&
  readiness?.checkAvailable === true &&
  readiness.meetsSynthesisMinimum === true &&
  readiness.resourcesAvailable === true &&
  readiness.freeStorageBytes !== null &&
  readiness.freeStorageBytes >= model.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES;

const meetingActionVerbs = /\b(?:prepare|check|decide|send|schedule|review|draft|write|update|create|share|follow up|confirm|finish|complete|submit|call|email|book|attend|collect|order|renew|return|take|pay|buy|get|pick up|clean|visit|test|verify|implement|discuss|plan|deliver|meet|coordinate|approve)\b/i;

const suggestMeetingActions = (transcript: MeetingTranscriptSegment[]): MeetingActionSuggestion[] => {
  const seen = new Set<string>();
  let actionLabelForNextSentence = false;
  return transcript.flatMap(segment => {
    return segment.text.split(/(?<=[.!?])\s+/).flatMap((sentence, index) => {
      const original = sentence.trim();
      if (/^(?:action items?|next step)\s*[.!?]?$/i.test(original)) {
        actionLabelForNextSentence = true;
        return [];
      }
      const actionLabel = original.match(/^(?:action items?|next step)\s*[:,—-]\s*(.+)$/i)?.[1]?.trim();
      const explicitlyLabeled = Boolean(actionLabel) || actionLabelForNextSentence;
      actionLabelForNextSentence = false;
      const sentenceText = actionLabel || original;
      const actor = sentenceText.match(/^(the team)\s+(?:will|should|need to|must|have to|agreed to)\s+/i)?.[1] ??
        sentenceText.match(/^([A-Z][A-Za-z'-]*)\s+(?:will|should|need to|must|have to|agreed to)\s+/)?.[1];
      const candidate = sentenceText
        .replace(/^(?:we|i|you|they|the team)\s+(?:will|should|need to|must|have to|agreed to)\s+/i, '')
        .replace(/^[A-Z][A-Za-z'-]*\s+(?:will|should|need to|must|have to|agreed to)\s+/, '')
        .replace(/^and\s+/i, '')
        .replace(/^(?:let's|need to|should|must)\s+/i, '');
      const suggestion = inferReminderLocally(candidate);
      if (isCompletedOrNegated(candidate)) return [];
      const actionVerbMatch = candidate.match(meetingActionVerbs);
      const isAction = suggestion.task || actionVerbMatch?.index === 0 ||
        Boolean(explicitlyLabeled && actionVerbMatch);
      const action = isAction ? suggestion.task && suggestion.title ? suggestion.title : candidate : undefined;
      if (!action) return [];
      const actionTitle = actor ? `${actor}: ${action}` : action;
      const key = actionTitle.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: 'action-' + segment.startMs + '-' + index,
        text: actionTitle,
        startMs: segment.startMs,
        confirmed: false,
        dismissed: false,
      }];
    });
  });
};

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
): NoteSourceMetadata => {
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
    ...(synthesized.source === 'litert' && synthesized.summary?.trim() ? { summary: synthesized.summary.trim() } : {}),
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
    ? 'Saved to Inbox: turn on the writing helper in Settings to sort this note.'
    : !SynthesisService.getLiteRtReadiness()?.available
      ? store.selectedModelInstalled
        ? 'Saved to Inbox: the writing helper could not start. Check Settings.'
        : 'Saved to Inbox: download the writing helper in Settings to sort this note.'
      : 'Saved to Inbox: the writing helper could not choose a topic. Retry this note from Inbox.';
  const completedStatus =
    state.pendingCount > 0
      ? `Processing ${state.pendingCount} thought${state.pendingCount === 1 ? '' : 's'}`
      : event.type === 'fallback'
        ? event.topic
          ? `Saved as written in ${event.topic}`
          : fallbackStatus
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
    (Platform.OS === 'android' || Platform.OS === 'ios') &&
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
      useAppStore.setState({ status: message });
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

const getWritingModel = (models: SynthesisModelView[], modelId: string): SynthesisModelView | undefined =>
  models.find(model => model.id === modelId && model.taskTypes?.includes('llm_chat'));

const syncModelConfig = () => {
  const state = useAppStore.getState();
  const selected = getWritingModel(state.models, state.selectedModelId) ?? getDefaultSynthesisModel();
  SynthesisService.configure({
    liteRtEnabled: state.liteRtEnabled,
    modelConfig: toLiteRtModelConfig(selected),
  });
  return selected;
};

const updateModelFlags = (models: SynthesisModelView[], selectedModelId: string) => {
  const selected = getWritingModel(models, selectedModelId) ?? models.find(model => model.recommended);
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
  getWritingModel(state.models, state.selectedModelId) ??
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
    return `Download ${selected.name} before queued thoughts can be categorized; saved notes remain in Inbox.`;
  }

  const readiness = state.deviceReadiness;
  if (shouldWaitForSynthesisResources(readiness)) {
    const cause = readiness?.reason === 'thermal' ? 'the device is warm' : 'available memory is low';
    const retryHint = Platform.OS === 'android'
      ? 'The app will try again when your device is ready. Opening it can try sooner.'
      : 'Open the app again when your device is ready to try again.';
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
  'activeMeetingId' | 'meetingTranscriptionRetryActive' | 'meetingSummaryProcessingActive' | 'liteRtEnabled' | 'models' | 'selectedModelId' | 'selectedModelDownloading' | 'selectedModelProgress' | 'deviceReadiness'
>) => {
  ProcessingQueueManager.setProcessingBlockedReason(state.activeMeetingId || state.meetingTranscriptionRetryActive || state.meetingSummaryProcessingActive
    ? 'Meeting processing is active; queued note synthesis will resume when it finishes.'
    : getModelBlockedReason(state));
};

export const useAppStore = create<AppState>((set, get) => {
  const initialModels = getSynthesisModels();
  const defaultModel = initialModels.find(model => model.recommended) ?? initialModels[0];
  let hydration: Promise<void> | null = null;
  let assistantPreferenceChanged = false;
  let modelPreferenceChanged = false;
  let modelDownloadInFlight: Promise<void> | null = null;
  let whisperDownloadInFlight: Promise<void> | null = null;
  let whisperAutoDownloadStarted = false;
  const persistPreferences = () => saveAppPreferences({
    liteRtEnabled: get().liteRtEnabled,
    selectedModelId: get().selectedModelId,
    modelSelectionIsAutomatic: get().modelSelectionIsAutomatic,
    manualCaptureEnabled: get().manualCaptureEnabled,
    pushToRecordEnabled: get().pushToRecordEnabled,
    meetingAudioRetention: get().meetingAudioRetention,
    transcriptionLanguage: get().transcriptionLanguage,
  }).catch(error => {
    console.warn('Could not save assistant preferences:', error);
    set({ status: 'Could not save assistant settings. Your choice may reset after restarting.' });
  });
  const refreshEngineAudioReadiness = async () => {
    const audioReadiness = await audioEngine.initializeModels();
    set({
      audioReadiness,
      isInitialized: audioReadiness.transcriptionReady,
      whisperModelError: audioReadiness.errors[0] ?? null,
    });
    if (audioReadiness.transcriptionReady) {
      await get().retryRetainedInboxAudio({ queueSynthesis: true });
    }
    return audioReadiness;
  };
  const ensureAutomaticWhisperDownload = (readiness: AudioReadiness) => {
    const usesGemmaForTranscription = get().transcriptionLanguage === 'en' && SynthesisService.hasAudioModelSelected();
    const needsWhisper = !usesGemmaForTranscription &&
      (Platform.OS === 'android' || readiness.missingModels.some(model => model.toLowerCase().includes('whisper')));
    if (!readiness.transcriptionReady && needsWhisper && !whisperAutoDownloadStarted) {
      whisperAutoDownloadStarted = true;
      void get().downloadWhisperModel();
    }
  };
  const meetingCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const meetingSummaryInFlight = new Set<string>();
  let pendingMeetingSummaryRetries: Promise<void> | null = null;
  const publishMeeting = (meeting: MeetingSession) => set(state => ({
    meetings: [meeting, ...state.meetings.filter(item => item.id !== meeting.id)]
      .sort((a, b) => b.startedAt - a.startedAt),
  }));
  const persistMeetingUpdate = async (
    id: string,
    update: (meeting: MeetingSession) => MeetingSession,
  ) => {
    const meeting = await updateMeeting(id, update);
    if (meeting) publishMeeting(meeting);
    return meeting;
  };
  const expireMeetingAudio = async (id: string) => {
    meetingCleanupTimers.delete(id);
    const meeting = (await listMeetings()).find(item => item.id === id);
    if (!meeting || !meeting.transcriptionComplete || !meeting.transcriptSavedAt ||
        !meeting.endedAt || !meeting.deleteAudioAt || meeting.deleteAudioAt > Date.now() ||
        !meeting.audioFilePath || !isAppOwnedRetainedAudioPath(meeting.audioFilePath)) return;
    await audioEngine.deleteRetainedAudioFile(meeting.audioFilePath);
    const updated = await persistMeetingUpdate(id, current => current.audioFilePath === meeting.audioFilePath
      ? { ...current, audioFilePath: undefined, deleteAudioAt: undefined }
      : current);
    if (updated) set({ meetings: [updated, ...get().meetings.filter(item => item.id !== id)] });
  };
  const scheduleMeetingAudioCleanup = (meeting: MeetingSession) => {
    const previous = meetingCleanupTimers.get(meeting.id);
    if (previous) clearTimeout(previous);
    meetingCleanupTimers.delete(meeting.id);
    if (!meeting.transcriptionComplete || !meeting.endedAt || !meeting.transcriptSavedAt ||
        !meeting.deleteAudioAt || !meeting.audioFilePath) return;
    const timer = setTimeout(() => {
      void expireMeetingAudio(meeting.id).catch(error => {
        console.warn('Meeting audio cleanup will retry when the app opens:', error);
      });
    }, Math.max(0, meeting.deleteAudioAt - Date.now()));
    meetingCleanupTimers.set(meeting.id, timer);
  };
  const resumePendingMeetingSummaries = async (force = false) => {
    if (pendingMeetingSummaryRetries) return pendingMeetingSummaryRetries;
    pendingMeetingSummaryRetries = (async () => {
      const state = get();
      if (!state.appIsActive || !state.liteRtEnabled || !state.selectedModelInstalled ||
          state.selectedModelDownloading || state.activeMeetingId || state.meetingTranscriptionRetryActive) return;
      for (const meeting of state.meetings) {
        const hasFinalSummary = Boolean(meeting.summary?.trim()) && meeting.summarySource !== 'transcript';
        if (!meeting.transcriptionComplete || hasFinalSummary || !meeting.transcript.some(segment => segment.text.trim()) ||
            meeting.status === 'recording' || meeting.status === 'summarizing' ||
            (!force && meeting.error && !meeting.error.startsWith('Summary paused') &&
              meeting.error !== 'Summary could not be created; it will retry automatically when the app is ready.')) continue;
        try {
          await get().retryMeetingSummary(meeting.id, true);
        } catch (error) {
          console.warn('Meeting summary will retry automatically when the app is ready:', error);
        }
      }
    })().finally(() => { pendingMeetingSummaryRetries = null; });
    return pendingMeetingSummaryRetries;
  };

  return {
    sections: [],
    meetings: [],
    activeMeetingId: null,
    meetingTranscriptionRetryActive: false,
    meetingSummaryProcessingActive: false,
    meetingAudioRetention: '5m',
    isRecording: false,
    recordingState: 'idle',
    widgetVoiceCaptureActive: false,
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
    whisperModelDownloading: false,
    whisperModelProgress: 0,
    whisperModelError: null,
    transcriptionLanguage: DEFAULT_TRANSCRIPTION_LANGUAGE,
    manualCaptureEnabled: true,
    pushToRecordEnabled: RELEASE_CAPABILITIES.voiceCapture,
    wakeWordEnabled: false,
    lockScreenHeadsetTriggerEnabled: false,
    liteRtEnabled: true,
    models: initialModels,
    selectedModelId: defaultModel.id,
    modelSelectionIsAutomatic: true,
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
          const transcriptionLanguage = saved?.transcriptionLanguage ?? DEFAULT_TRANSCRIPTION_LANGUAGE;
          if (saved) set({
            ...(!assistantPreferenceChanged ? { liteRtEnabled: saved.liteRtEnabled } : {}),
            ...(!modelPreferenceChanged && getWritingModel(get().models, saved.selectedModelId)
              ? {
                  selectedModelId: saved.selectedModelId,
                  modelSelectionIsAutomatic: saved.modelSelectionIsAutomatic,
                }
              : {}),
            manualCaptureEnabled: saved.manualCaptureEnabled,
            pushToRecordEnabled: saved.pushToRecordEnabled && RELEASE_CAPABILITIES.voiceCapture,
            meetingAudioRetention: saved.meetingAudioRetention,
            transcriptionLanguage,
          });
          await SynthesisService.setTranscriptionLanguage(transcriptionLanguage);
          await audioEngine.setTranscriptionLanguage(transcriptionLanguage);
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
        deviceReadinessNoticeDismissed: noticeSeen || get().deviceReadinessNoticeDismissed,
      });

      const resumingAfterResourceWait =
        previousBlockReason?.startsWith('Waiting for device resources') && !nextBlockReason;
      syncSynthesisQueueGate({ ...get(), deviceReadiness: readiness });

      if (resumingAfterResourceWait) {
        await get().queueInboxForSynthesis({ announce: false });
      }

      return readiness;
    },

    setAppLifecycleState: async nextState => {
      await get().hydratePreferences();
      const wasAppActive = get().appIsActive;
      const appIsActive = nextState === 'active';
      set({ appIsActive });
      if (appIsActive) {
        await get().loadMeetings().catch(error => {
          console.warn('Meeting audio cleanup will retry:', error);
        });
      }
      if (
        appIsActive &&
        get().liteRtEnabled &&
        !get().selectedModelInstalled &&
        !get().selectedModelDownloading &&
        !get().selectedModelError
      ) {
        await get().refreshModels(false).catch(error => {
          console.warn('Installed writing model status will retry when the app opens:', error);
        });
      }
      if (appIsActive && Platform.OS === 'android' && typeof NativeModules.EventEmitter?.getWidgetVoiceCaptureState === 'function') {
        try {
          const widgetVoiceCaptureActive = await NativeModules.EventEmitter.getWidgetVoiceCaptureState();
          if (widgetVoiceCaptureActive) {
            set({
              widgetVoiceCaptureActive: true,
              ...recordingStatePatch('recording', 'Recording from widget · Stop here'),
            });
          } else {
            const wasWidgetVoiceCaptureActive = get().widgetVoiceCaptureActive;
            if (wasWidgetVoiceCaptureActive) {
              set({ widgetVoiceCaptureActive: false, ...recordingStatePatch('idle', 'Recovering widget recording...') });
            }
            const recovered = await get().recoverInterruptedRecordings();
            if (recovered || wasWidgetVoiceCaptureActive) {
              await get().retryRetainedInboxAudio({ queueSynthesis: true });
            }
          }
        } catch (error) {
          console.warn('[Capture] Could not sync widget recording state:', error);
        }
      }
      if ((Platform.OS === 'android' || Platform.OS === 'ios') && nextState === 'background') {
        try {
          const current = get();
          if (
            Platform.OS === 'android' &&
            (current.selectedModelDownloading || current.whisperModelDownloading)
          ) {
            await scheduleModelDownloads(
              current.selectedModelDownloading ? current.selectedModelId : null,
              current.whisperModelDownloading,
            );
          }
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
      if (
        appIsActive && !wasAppActive && Platform.OS === 'android' &&
        RELEASE_CAPABILITIES.voiceCapture && !get().audioReadiness.transcriptionReady
      ) {
        try {
          const audioReadiness = await audioEngine.initializeModels();
          if (audioReadiness.transcriptionReady) {
            set({
              audioReadiness,
              isInitialized: true,
              whisperModelDownloading: false,
              whisperModelProgress: 100,
              whisperModelError: null,
              status: get().status === 'Audio Unavailable' ? 'Capture Ready' : get().status,
            });
          }
        } catch (error) {
          console.warn('[Audio] Could not refresh voice readiness after background work:', error);
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
      if (appIsActive) await resumePendingMeetingSummaries();
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

    setCaptureSetting: async (key, value) => {
      if (key === 'manualCaptureEnabled' || key === 'pushToRecordEnabled' || key === 'liteRtEnabled') {
        await get().hydratePreferences();
      }
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
      if (key === 'liteRtEnabled') {
        await SynthesisService.release();
        ensureAutomaticWhisperDownload(await refreshEngineAudioReadiness());
      }
      if (key === 'liteRtEnabled' || key === 'manualCaptureEnabled' || key === 'pushToRecordEnabled') {
        await persistPreferences();
      }
      if (key === 'liteRtEnabled' && value) await resumePendingMeetingSummaries(true);
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

    refreshModels: async (refreshAudioReadiness = true) => {
      const refreshed = mergeTransientModelState(get().models, await resolveModelViews(getSynthesisModels()));
      const refreshedDefault = refreshed.find(model => model.recommended) ?? refreshed[0] ?? defaultModel;
      const selectedModel = getWritingModel(refreshed, get().selectedModelId) ?? refreshedDefault;
      syncSynthesisQueueGate({
        ...get(),
        models: refreshed,
        selectedModelId: selectedModel.id,
        ...updateModelFlags(refreshed, selectedModel.id),
      });
      set({
        selectedModelId: selectedModel.id,
        models: refreshed,
        ...updateModelFlags(refreshed, selectedModel.id),
      });
      SynthesisService.configure({
        liteRtEnabled: get().liteRtEnabled,
        modelConfig: toLiteRtModelConfig(selectedModel),
      });
      if (refreshAudioReadiness) await refreshEngineAudioReadiness();
    },

    selectModel: async modelId => {
      if (modelDownloadInFlight) return;
      const requested = get().models.find(model => model.id === modelId);
      if (requested && !requested.taskTypes?.includes('llm_chat')) return;
      modelPreferenceChanged = true;
      await get().hydratePreferences();
      if (modelDownloadInFlight || get().selectedModelDownloading) return;
      const models = get().models;
      const selected = models.find(model => model.id === modelId) ?? defaultModel;
      if (!selected.taskTypes?.includes('llm_chat')) return;
      syncSynthesisQueueGate({
        ...get(),
        models,
        selectedModelId: selected.id,
        ...updateModelFlags(models, selected.id),
      });
      set({
        models,
        selectedModelId: selected.id,
        modelSelectionIsAutomatic: false,
        ...updateModelFlags(models, selected.id),
        status: selected.installed ? `Selected ${selected.name}` : `Selected ${selected.name}; download required`,
      });
      SynthesisService.configure({
        liteRtEnabled: get().liteRtEnabled,
        modelConfig: toLiteRtModelConfig(selected),
      });
      await persistPreferences();
      await SynthesisService.release();
      ensureAutomaticWhisperDownload(await refreshEngineAudioReadiness());
      await resumePendingMeetingSummaries(true);
    },

    downloadModel: (modelId, waitForActive = false, userInitiated = false, selectForSynthesis = true) => {
      if (modelDownloadInFlight) return waitForActive ? modelDownloadInFlight : Promise.resolve();
      const download = async () => {
        let checkingDeviceReadiness = true;
        let userInitiatedTransfer = false;
        const initialTarget = get().models.find(model => model.id === modelId);
        const selectForWriting = selectForSynthesis && Boolean(initialTarget?.taskTypes?.includes('llm_chat'));
        const updateTarget = (changes: Partial<SynthesisModelView>, status?: string) => {
          set({
            models: get().models.map(model => model.id === modelId ? { ...model, ...changes } : model),
            ...(status ? { status } : {}),
          });
        };
        if (selectForWriting) {
          set({
            selectedModelDownloading: true,
            selectedModelProgress: 0,
            selectedModelError: null,
            selectedModelStatusMessage: 'Checking device readiness',
          });
        }
        try {
          if (selectForWriting && userInitiated) {
            modelPreferenceChanged = true;
            set({ modelSelectionIsAutomatic: false });
          }
          const immediateTarget = get().models.find(model => model.id === modelId);
          if (userInitiated && Platform.OS === 'android') {
            const notificationsEnabled = await requestModelDownloadNotificationPermission();
            if (!notificationsEnabled) {
              set({ status: 'Download will continue; turn on notifications to see its progress outside the app.' });
            }
          }
          if (
            userInitiated &&
            Platform.OS === 'android' &&
            Number(Platform.Version) >= 34 &&
            immediateTarget
          ) {
            userInitiatedTransfer = await scheduleUserInitiatedModelDownload(
              modelId,
              false,
              immediateTarget.sizeInBytes,
            );
            if (!userInitiatedTransfer) {
              const message = 'Could not schedule this model download to continue in the background. Please retry.';
              checkingDeviceReadiness = false;
              if (selectForWriting) {
                set({ selectedModelDownloading: false, selectedModelError: message, selectedModelStatusMessage: message, status: message });
              } else {
                updateTarget({ downloading: false, error: message, statusMessage: message }, message);
              }
              return;
            }
          }
          await get().hydratePreferences();
          const target = get().models.find(model => model.id === modelId);
          if (!target) return;
          if (
            userInitiated &&
            Platform.OS === 'android' &&
            Number(Platform.Version) >= 34 &&
            !userInitiatedTransfer
          ) {
            userInitiatedTransfer = await scheduleUserInitiatedModelDownload(modelId, false, target.sizeInBytes);
            if (!userInitiatedTransfer) {
              const message = 'Could not schedule this model download to continue in the background. Please retry.';
              checkingDeviceReadiness = false;
              if (selectForWriting) {
                set({ selectedModelDownloading: false, selectedModelError: message, selectedModelStatusMessage: message, status: message });
              } else {
                updateTarget({ downloading: false, error: message, statusMessage: message }, message);
              }
              return;
            }
          }
          const requiredMemoryGb = Math.max(SYNTHESIS_MINIMUM_RAM_GB, target.minDeviceMemoryInGb);
          checkingDeviceReadiness = true;
          if (selectForWriting) {
            set({
              selectedModelDownloading: true,
              selectedModelProgress: 0,
              selectedModelError: null,
              selectedModelStatusMessage: 'Checking device readiness',
            });
          }
          const downloadReadiness = await assessDeviceReadiness(requiredMemoryGb);
          const requiredStorageBytes = await getRequiredSynthesisModelStorageBytes(target);
          if (
            downloadReadiness.checkAvailable &&
            downloadReadiness.freeStorageBytes !== null &&
            downloadReadiness.freeStorageBytes < requiredStorageBytes
          ) {
            const requiredStorage = formatBytesAsGiB(requiredStorageBytes);
            const availableStorage = formatBytesAsGiB(downloadReadiness.freeStorageBytes);
            const message = `Free up storage before installing ${target.name}: about ${requiredStorage} is recommended; ${availableStorage} is available.`;
            checkingDeviceReadiness = false;
            if (selectForWriting) {
              set({
                selectedModelDownloading: false,
                selectedModelError: message,
                selectedModelStatusMessage: message,
                status: message,
              });
            } else {
              updateTarget({ downloading: false, error: message, statusMessage: message }, message);
            }
            return;
          }
          const startingModels = get().models.map(model =>
            model.id === modelId
              ? { ...model, downloading: true, progress: 0, error: null, statusMessage: 'Preparing download' }
              : model,
          );

        set({
          models: startingModels,
          ...(selectForWriting ? {
            selectedModelId: modelId,
            ...updateModelFlags(startingModels, modelId),
          } : {}),
          status: `Downloading ${target.name}...`,
        });
        if (selectForWriting) {
          await persistPreferences();
          SynthesisService.configure({
            liteRtEnabled: get().liteRtEnabled,
            modelConfig: toLiteRtModelConfig(target),
          });
          syncSynthesisQueueGate({
            ...get(),
            models: startingModels,
            selectedModelId: modelId,
            selectedModelDownloading: true,
            selectedModelProgress: 0,
          });
        }
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
            if (selectForWriting) {
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
            } else {
              set({ models: nextModels });
            }
          });

          await get().refreshModels();
          if (userInitiatedTransfer) {
            set({
              ...(selectForWriting ? {
                selectedModelId: modelId,
                selectedModelDownloading: false,
                selectedModelProgress: 100,
                selectedModelError: null,
                selectedModelStatusMessage: null,
              } : {}),
              status: `Downloaded ${target.name}`,
            });
            return;
          }
          const readiness = await assessDeviceReadiness(requiredMemoryGb);
          set({ deviceReadiness: readiness });
          if (selectForWriting) syncSynthesisQueueGate({ ...get(), deviceReadiness: readiness });
          const belowMinimum = readiness.checkAvailable && readiness.meetsSynthesisMinimum === false;
          const performanceWarning = belowMinimum
            ? `${target.name} is below this device’s ${requiredMemoryGb} GB RAM minimum. Synthesis may be slow or fail; notes stay saved in Inbox.`
            : null;
          if (shouldWaitForSynthesisResources(readiness)) {
            const resourceWait = readiness.reason === 'thermal'
              ? 'The device needs to cool down before local inference.'
              : 'More free memory is needed before local inference.';
            const message = selectForWriting
              ? `Installed ${target.name}. ${resourceWait} ${performanceWarning ?? 'Notes stay in Inbox.'}`
              : `Installed ${target.name}. ${resourceWait}`;
            if (selectForWriting) await get().queueInboxForSynthesis({ announce: false });
            set({
              ...(selectForWriting ? {
                selectedModelId: modelId,
                selectedModelDownloading: false,
                selectedModelProgress: 100,
                selectedModelError: message,
                selectedModelStatusMessage: message,
              } : {}),
              models: get().models.map(model => model.id === modelId ? { ...model, statusMessage: message } : model),
              status: message,
            });
            return;
          }
          if (selectForWriting) {
            SynthesisService.configure({
              liteRtEnabled: get().liteRtEnabled,
              modelConfig: toLiteRtModelConfig(downloaded),
            });
            await get().queueInboxForSynthesis({ announce: false });
          }
          set({
            ...(selectForWriting ? {
              selectedModelId: modelId,
              selectedModelDownloading: false,
              selectedModelProgress: 100,
              selectedModelError: null,
              selectedModelStatusMessage: performanceWarning,
            } : {}),
            models: get().models.map(model => model.id === modelId ? { ...model, statusMessage: null } : model),
            status: performanceWarning ?? `Downloaded ${target.name}`,
          });
          if (selectForWriting) await resumePendingMeetingSummaries(true);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('Synthesis model download failed:', error);
          const modelInstalled = get().models.find(model => model.id === modelId)?.installed ?? false;
          const status = modelInstalled
            ? `Installed ${target.name}, but synthesis could not start: ${message}. Notes remain in Inbox.`
            : `Model download failed: ${message}`;
          const nextModels = get().models.map(model =>
            model.id === modelId
              ? { ...model, downloading: false, error: message, statusMessage: null }
              : model,
          );
          if (selectForWriting) {
            syncSynthesisQueueGate({
              ...get(),
              models: nextModels,
              selectedModelDownloading: false,
            });
            set({
              models: nextModels,
              ...updateModelFlags(nextModels, modelId),
              selectedModelError: modelInstalled ? status : message,
              selectedModelStatusMessage: status,
              status,
            });
          } else {
            set({
              models: nextModels.map(model => model.id === modelId
                ? { ...model, statusMessage: modelInstalled ? status : message }
                : model),
              status,
            });
          }
        }
        } finally {
          if (checkingDeviceReadiness && selectForWriting) {
            set({ selectedModelDownloading: false, selectedModelStatusMessage: null });
          }
        }
      };
      modelDownloadInFlight = download().finally(() => { modelDownloadInFlight = null; });
      return modelDownloadInFlight;
    },

    removeModel: async modelId => {
      const target = get().models.find(model => model.id === modelId);
      if (!target) return;

      if (target.taskTypes?.includes('llm_chat')) await SynthesisService.release();
      await removeSynthesisModel(target);
      await get().refreshModels();
      set({
        status: `Removed ${target.name}`,
      });
    },

    downloadWhisperModel: (waitForActive = false, userInitiated = false) => {
      if (!RELEASE_CAPABILITIES.voiceCapture) return Promise.resolve();
      if (
        get().transcriptionLanguage === 'en' &&
        SynthesisService.hasAudioModelSelected() &&
        !getSelectedModel(get()).installed
      ) {
        return get().downloadModel(get().selectedModelId, waitForActive, false);
      }
      if (whisperDownloadInFlight) return waitForActive ? whisperDownloadInFlight : Promise.resolve();
      const download = async () => {
        set({ whisperModelDownloading: true, whisperModelProgress: 0, whisperModelError: null });
        try {
          if (userInitiated && Platform.OS === 'android') {
            await requestModelDownloadNotificationPermission();
          }
          if (userInitiated && Platform.OS === 'android' && Number(Platform.Version) >= 34) {
            const scheduled = await scheduleUserInitiatedModelDownload(
              null,
              true,
              getWhisperModelSize(get().transcriptionLanguage),
            );
            if (!scheduled) throw new Error('Could not schedule this model download to continue in the background. Please retry.');
          }
          const readiness = await audioEngine.downloadWhisperModel((update: WhisperModelDownloadProgress) => {
            set({ whisperModelProgress: update.progress });
          });
          if (!readiness.transcriptionReady) {
            throw new Error(readiness.errors[0] ?? 'Voice model could not be initialized');
          }
          set({
            audioReadiness: readiness,
            isInitialized: true,
            whisperModelDownloading: false,
            whisperModelProgress: 100,
            whisperModelError: null,
            status: get().status === 'Audio Unavailable' ? 'Capture Ready' : get().status,
          });
          await get().retryRetainedInboxAudio({ queueSynthesis: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('[Audio] Whisper model download failed:', message);
          set({ whisperModelDownloading: false, whisperModelError: message });
        }
      };
      whisperDownloadInFlight = download().finally(() => {
        whisperDownloadInFlight = null;
        whisperAutoDownloadStarted = false;
      });
      return whisperDownloadInFlight;
    },

    setTranscriptionLanguage: async language => {
      await get().hydratePreferences();
      if (language === get().transcriptionLanguage) return;
      if (get().recordingState !== 'idle' || get().isRecording) {
        set({ status: 'Stop recording before changing the voice language.' });
        return;
      }

      set({
        transcriptionLanguage: language,
        audioReadiness: EMPTY_AUDIO_READINESS,
        isInitialized: false,
        whisperModelError: null,
        status: `Preparing ${language.toUpperCase()} voice support`,
      });
      await persistPreferences();
      await SynthesisService.setTranscriptionLanguage(language);
      await audioEngine.setTranscriptionLanguage(language);
      ensureAutomaticWhisperDownload(await refreshEngineAudioReadiness());
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
      await get().refreshModels(false);
      let deviceReadiness = await get().refreshDeviceReadiness();
      if ((Platform.OS === 'ios' || Platform.OS === 'android') && get().modelSelectionIsAutomatic) {
        const automaticModelId = getAutomaticSynthesisModelId(
          get().models,
          deviceReadiness,
          Platform.OS,
          get().liteRtEnabled,
        );
        if (automaticModelId !== get().selectedModelId) {
          const model = get().models.find(candidate => candidate.id === automaticModelId);
          if (model) {
            set({ selectedModelId: model.id, ...updateModelFlags(get().models, model.id) });
            SynthesisService.configure({
              liteRtEnabled: get().liteRtEnabled,
              modelConfig: toLiteRtModelConfig(model),
            });
            await SynthesisService.release();
            await persistPreferences();
            deviceReadiness = await get().refreshDeviceReadiness();
          }
        }
      }
      syncModelConfig();
      const modelInstalled = get().models.find(model => model.id === get().selectedModelId)?.installed ?? false;

      if (eagerAudio && RELEASE_CAPABILITIES.voiceCapture) {
        try {
          audioReadiness = await audioEngine.initializeModels();
          audioReady = audioReadiness.transcriptionReady;
          set({
            isInitialized: audioReady,
            audioReadiness,
            whisperModelError: audioReadiness.errors[0] ?? null,
            status: audioReady ? 'Capture Ready' : 'Audio Unavailable',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          audioReadiness = { ...audioReadiness, errors: [message] };
          set({ isInitialized: false, audioReadiness, whisperModelError: message, status: 'Audio Unavailable' });
        }
        deviceReadiness = await get().refreshDeviceReadiness();
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
        } else {
          set({
            isInitialized: audioReady,
            audioReadiness,
            status: !RELEASE_CAPABILITIES.voiceCapture
              ? modelInstalled ? 'Ready for local capture' : 'Model missing'
              : audioReady ? 'Idle' : 'Audio Unavailable',
          });
        }
      } else if (!audioReady) {
        set({ isInitialized: false, status: 'Ready for local capture' });
      }

      if (eagerSynthesis) {
        await get().queueInboxForSynthesis({ announce: false });
      }
      if (audioReadiness.transcriptionReady) {
        await get().retryRetainedInboxAudio({ queueSynthesis: eagerSynthesis });
      }
      if (recoveryWarning) set({ status: `Recording recovery needs attention: ${recoveryWarning}` });

      if (eagerAudio && RELEASE_CAPABILITIES.voiceCapture) ensureAutomaticWhisperDownload(audioReadiness);

      const selectedModel = getSelectedModel(get());
      if (
        eagerSynthesis &&
        get().liteRtEnabled &&
        (Platform.OS === 'android' || get().modelSelectionIsAutomatic) &&
        !selectedModel.installed &&
        !get().selectedModelDownloading &&
        shouldAutoDownloadModel(selectedModel, deviceReadiness)
      ) {
        get().downloadModel(selectedModel.id).catch(error => {
          console.error('Could not start the on-device model download:', error);
        });
      }
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
      const noteId = options.sharedContentId ?? createNoteId('import');
      if (options.sharedContentId) {
        const sections = await ContextManager.readContext();
        const alreadySaved = sections
          .some(section => ContextManager.getThoughtsFromSection(section)
            .some(thought => (thought.noteId ?? thought.id) === noteId));
        if (alreadySaved) return noteId;
      }
      const sourceMetadata = buildImportSourceMetadata(
        {
          sourceKind: preview.sourceKind,
          text: preview.sourceKind === 'text' ? preview.transcript : undefined,
          voiceFile: preview.voiceFile,
          selectedTopic,
        },
        preview.transcript,
      );
      if (preview.source === 'litert' && preview.summary?.trim()) {
        sourceMetadata.summary = preview.summary.trim();
      }

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

    autoFileSharedContent: async (text, sharedContentId) => {
      await get().hydratePreferences();
      const transcript = text.trim();
      if (!transcript) return false;
      const sections = await ContextManager.readContext();
      const matchingNotes = sections.flatMap(section =>
        ContextManager.getThoughtsFromSection(section)
          .filter(thought => thought.noteId === sharedContentId || thought.id === sharedContentId)
          .map(thought => ({ section, thought })),
      );
      const existingTopicNote = matchingNotes.find(
        ({ section }) => section.header.trim().toLowerCase() !== 'inbox',
      );
      const existingInboxNote = matchingNotes.find(
        ({ section }) => section.header.trim().toLowerCase() === 'inbox',
      );

      if (existingTopicNote) {
        if (existingInboxNote) {
          const removed = await ContextManager.removeThought(
            existingInboxNote.section.header,
            existingInboxNote.thought.text,
            sharedContentId,
          );
          if (!removed) throw new Error('Duplicate shared response could not be cleaned up');
          await get().loadContext();
        }
        return true;
      }

      if (!existingInboxNote) {
        const sourceMetadata = buildImportSourceMetadata(
          { sourceKind: 'text', text: transcript },
          transcript,
        );
        await persistCaptureToInbox(transcript, 'text', {
          noteId: sharedContentId,
          sourceMetadata,
        });
        await get().loadContext();
      }

      await get().queueInboxForSynthesis({ announce: false });
      return true;
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

        const id = ProcessingQueueManager.addToQueue(thought.text, thought.sourceKind ?? 'text', {
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
      if (!RELEASE_CAPABILITIES.voiceCapture || get().isRecording || isRecordingActive(get().recordingState)) return 0;
      try {
        const recovered = await audioEngine.recoverInterruptedRecordings(async (audioFilePath, noteId, meetingId) => {
          if (meetingId) {
            const meeting = await persistMeetingUpdate(meetingId, current => ({
              ...current,
              status: 'interrupted',
              endedAt: current.endedAt ?? Date.now(),
              audioFilePath,
              error: 'Meeting ended unexpectedly. Partial transcript and recovered audio are preserved.',
            }));
            if (meeting) return;
          }
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
      if (!RELEASE_CAPABILITIES.voiceCapture || get().isRecording || isRecordingActive(get().recordingState)) {
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

    loadMeetings: async () => {
      let meetings = await listMeetings();
      for (const meeting of meetings) {
        if (meeting.id === get().activeMeetingId ||
            (meeting.status !== 'recording' && meeting.status !== 'summarizing')) continue;
        const summaryInterrupted = meeting.status === 'summarizing' && meeting.transcriptionComplete &&
          (!meeting.summary?.trim() || meeting.summarySource === 'transcript');
        const recovered = await persistMeetingUpdate(meeting.id, current => ({
          ...current,
          status: summaryInterrupted ? 'complete' : 'interrupted',
          error: summaryInterrupted
            ? 'Summary paused after the app closed. It will retry automatically.'
            : 'Meeting processing stopped before it finished. Saved transcript and audio are preserved.',
        }));
        if (recovered) meetings = meetings.map(item => item.id === recovered.id ? recovered : item);
      }
      set({ meetings });
      for (const meeting of meetings) {
        if (meeting.deleteAudioAt && meeting.deleteAudioAt <= Date.now()) {
          await expireMeetingAudio(meeting.id).catch(error => {
            console.warn('Expired meeting audio will retry when the app opens:', error);
          });
        } else {
          scheduleMeetingAudioCleanup(meeting);
        }
      }
    },

    setMeetingAudioRetention: async retention => {
      await get().hydratePreferences();
      set({ meetingAudioRetention: retention });
      const duration = meetingAudioRetentionMs(retention);
      for (const meeting of get().meetings) {
        if (!meeting.transcriptionComplete || !meeting.audioFilePath ||
            !meeting.endedAt || !meeting.transcriptSavedAt) continue;
        const updated = await persistMeetingUpdate(meeting.id, current => ({
          ...current,
          deleteAudioAt: duration === null
            ? undefined
            : Math.max(current.endedAt ?? 0, current.transcriptSavedAt ?? 0) + duration,
        }));
        if (updated) scheduleMeetingAudioCleanup(updated);
      }
      await persistPreferences();
    },

    updateMeetingAction: async (meetingId, actionId, actionState) => {
      const updated = await persistMeetingUpdate(meetingId, meeting => ({
        ...meeting,
        actions: meeting.actions.map(action => action.id !== actionId ? action : {
          ...action,
          confirmed: actionState === 'confirmed',
          dismissed: actionState === 'dismissed',
        }),
      }));
      if (!updated) set({ status: 'Meeting action could not be saved' });
    },

    saveMeetingToNotes: async meetingId => {
      const meeting = get().meetings.find(item => item.id === meetingId);
      if (!meeting || !meeting.transcript.some(segment => segment.text.trim())) {
        throw new Error('There is no meeting transcript to save yet');
      }
      if (meeting.status === 'recording' || meeting.status === 'summarizing') {
        throw new Error('Wait until meeting processing finishes before saving it to notes');
      }

      const noteId = meeting.savedNoteId ?? `meeting-note-${meeting.id}`;
      const text = formatMeetingContent(meeting);
      const sourceMetadata: NoteSourceMetadata = {
        kind: 'text',
        noteId,
        ...(meeting.summary ? { summary: meeting.summary } : {}),
      };
      const existingSection = await ContextManager.updateThoughtAndResolveSection('Inbox', noteId, {
        text,
        sourceMetadata,
        updatedAt: new Date().toISOString(),
      });
      if (!existingSection) {
        await ContextManager.appendThought('Inbox', text, {
          noteId,
          sourceKind: 'text',
          sourceMetadata,
        });
      }

      const updated = await persistMeetingUpdate(meetingId, current => ({ ...current, savedNoteId: noteId }));
      if (!updated) throw new Error('Meeting note was saved, but its meeting link could not be updated');
      await get().loadContext();
      set({ status: 'Meeting content saved to notes' });
    },

    startMeeting: async () => {
      if (!RELEASE_CAPABILITIES.voiceCapture) return null;
      if (get().meetingTranscriptionRetryActive) {
        return 'A saved meeting is still being transcribed. Wait for it to finish before starting another meeting.';
      }
      const before = get().recordingState;
      if (before !== 'idle' && before !== 'error') return null;
      set(recordingStatePatch('starting', 'Preparing meeting recording...'));
      let meeting: MeetingSession | null = null;
      try {
        await get().hydratePreferences();
        let readiness = get().audioReadiness;
        if (!readiness.transcriptionReady) {
          readiness = await audioEngine.initializeModels();
          set({ audioReadiness: readiness });
        }
        if (!readiness.transcriptionReady) {
          const message = 'Whisper is unavailable';
          set(recordingStatePatch('error', message));
          return message;
        }
        if (!(await requestAudioPermissions())) {
          const message = 'Microphone access is needed for Meeting mode';
          set(recordingStatePatch('error', message));
          return message;
        }
        const notificationPermission = await requestRecordingNotificationPermission();
        meeting = await createMeeting();
        set(state => ({
          activeMeetingId: meeting!.id,
          meetings: [meeting!, ...state.meetings],
        }));
        syncSynthesisQueueGate(get());
        const meetingId = meeting.id;
        await audioEngine.startRecording(() => {
          if (get().recordingState === 'starting') set(recordingStatePatch('recording', 'Stopping failed meeting microphone...'));
          void get().stopMeeting();
        }, {
          meetingId,
          onAudioFilePath: async audioFilePath => {
            await persistMeetingUpdate(meetingId, current => ({ ...current, audioFilePath }));
          },
          onTranscript: async segments => {
            const transcript: MeetingTranscriptSegment[] = segments.map(segment => ({
              ...segment,
              id: createNoteId('meeting-segment'),
            }));
            await persistMeetingUpdate(meetingId, current => ({
              ...current,
              transcript: [...current.transcript, ...transcript].sort((a, b) => a.startMs - b.startMs),
              transcriptSavedAt: Date.now(),
            }));
          },
          beforeTranscription: async () => {
            const queueState = await ProcessingQueueManager.waitUntilSettled();
            if (queueState === 'timeout') {
              throw new Error('Note processing is still active; the full meeting recording is preserved for retry');
            }
          },
        });
        if (get().recordingState !== 'starting') return null;
        const inputLabel = audioEngine.getCaptureInputLabel?.();
        set(recordingStatePatch(
          'recording',
          notificationPermission
            ? inputLabel ? 'Meeting recording · ' + inputLabel : 'Meeting recording'
            : 'Meeting recording · return to app to stop',
        ));
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (meeting) {
          await persistMeetingUpdate(meeting.id, current => ({
            ...current,
            status: 'error',
            error: 'Meeting could not start: ' + message,
          })).catch(() => undefined);
        }
        set({ activeMeetingId: null, ...recordingStatePatch('error', 'Meeting could not start: ' + message) });
        syncSynthesisQueueGate(get());
        return 'Meeting could not start: ' + message;
      }
    },

    stopMeeting: async () => {
      const meetingId = get().activeMeetingId;
      if (!meetingId || get().recordingState !== 'recording') return;
      const endedAt = Date.now();
      set(recordingStatePatch('stopping', 'Saving meeting recording...'));
      try {
        const result = await audioEngine.stopRecording(async audioFilePath => {
          await persistMeetingUpdate(meetingId, current => ({ ...current, audioFilePath }));
        });
        if (!result.text.trim() || result.error) {
          const message = result.error || 'No speech detected';
          await persistMeetingUpdate(meetingId, current => ({
            ...current,
            status: 'error',
            endedAt,
            error: 'Transcript incomplete; recording preserved. ' + message,
          }));
          set({ activeMeetingId: null, ...recordingStatePatch('error', 'Meeting transcript incomplete; audio preserved') });
          syncSynthesisQueueGate(get());
          return;
        }

        const transcriptSavedAt = Date.now();
        const retention = meetingAudioRetentionMs(get().meetingAudioRetention);
        const summarizing = await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'summarizing',
          endedAt,
          transcriptSavedAt,
          transcriptionComplete: true,
          deleteAudioAt: retention === null || !current.audioFilePath
            ? undefined
            : Math.max(endedAt, transcriptSavedAt) + retention,
          error: undefined,
        }));
        if (summarizing) scheduleMeetingAudioCleanup(summarizing);
        set({ activeMeetingId: null, ...recordingStatePatch('idle', 'Meeting saved') });
        syncSynthesisQueueGate(get());
        void get().retryMeetingSummary(meetingId).catch(error => {
          console.warn('Meeting summary could not be completed; saved transcript and actions remain available:', error);
          void persistMeetingUpdate(meetingId, current => ({
            ...current,
            status: 'complete',
            error: 'Summary could not be created; transcript and suggested actions remain saved.',
          })).catch(() => undefined);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'error',
          endedAt,
          error: 'Meeting processing failed; recording preserved. ' + message,
        })).catch(() => undefined);
        set({ activeMeetingId: null, ...recordingStatePatch('error', 'Meeting saved with an error; audio preserved') });
        syncSynthesisQueueGate(get());
      }
    },

    retryMeetingTranscription: async meetingId => {
      const meeting = (await listMeetings()).find(item => item.id === meetingId);
      if (!meeting?.audioFilePath || meeting.transcriptionComplete ||
          meeting.status === 'summarizing' || !isAppOwnedRetainedAudioPath(meeting.audioFilePath)) return;
      set({ meetingTranscriptionRetryActive: true });
      syncSynthesisQueueGate(get());
      try {
        await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'summarizing',
          error: 'Transcribing recovered meeting audio...',
        }));
        const queueState = await ProcessingQueueManager.waitUntilSettled();
        if (queueState === 'timeout') {
          throw new Error('Note processing is still active; the full meeting recording is preserved for retry');
        }
        const result = await audioEngine.transcribeFile(meeting.audioFilePath);
        if (result.error || !result.text.trim()) {
          throw new Error(result.error || 'No speech detected');
        }
        let segments = result.segments?.filter(segment => segment.text.trim()) ?? [];
        if (!segments.length) {
          const size = Number((await RNFS.stat(meeting.audioFilePath)).size);
          segments = [{
            startMs: 0,
            endMs: Number.isSafeInteger(size) ? Math.max(0, Math.round((size - 44) / 32000 * 1000)) : 0,
            text: result.text.trim(),
          }];
        }
        const transcriptSavedAt = Date.now();
        const endedAt = meeting.endedAt ?? transcriptSavedAt;
        const transcript: MeetingTranscriptSegment[] = segments.map(segment => ({
          ...segment,
          id: createNoteId('meeting-segment'),
        }));
        const retention = meetingAudioRetentionMs(get().meetingAudioRetention);
        const updated = await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'summarizing',
          endedAt,
          transcriptSavedAt,
          transcriptionComplete: true,
          transcript,
          deleteAudioAt: retention === null
            ? undefined
            : Math.max(endedAt, transcriptSavedAt) + retention,
          error: undefined,
        }));
        if (updated) scheduleMeetingAudioCleanup(updated);
        await get().retryMeetingSummary(meetingId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'error',
          error: 'Transcription retry failed; recording preserved. ' + message,
        })).catch(() => undefined);
        throw error;
      } finally {
        set({ meetingTranscriptionRetryActive: false });
        syncSynthesisQueueGate(get());
      }
    },

    retryMeetingSummary: async (meetingId, automaticRetry = false) => {
      if (meetingSummaryInFlight.has(meetingId)) return;
      meetingSummaryInFlight.add(meetingId);
      set({ meetingSummaryProcessingActive: true });
      syncSynthesisQueueGate(get());
      try {
        const meeting = (await listMeetings()).find(item => item.id === meetingId);
        if (!meeting?.transcriptionComplete || !meeting.transcript.some(segment => segment.text.trim())) return;
        const writingHelperReady = get().liteRtEnabled && get().selectedModelInstalled;
        const transcriptSummary = extractMeetingHighlights(meeting.transcript);
        await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'summarizing',
          error: undefined,
          summary: current.summary?.trim() ? current.summary : transcriptSummary,
          summarySource: current.summary?.trim() ? current.summarySource : transcriptSummary ? 'transcript' : current.summarySource,
          actions: current.actions.length ? current.actions : suggestMeetingActions(current.transcript),
        }));
        let runtimeRecovered = true;
        if (writingHelperReady && SynthesisService.getLiteRtReadiness()?.available === false) {
          runtimeRecovered = (await SynthesisService.initialize().catch(error => {
            console.warn('Meeting summary runtime could not recover:', error);
            return null;
          }))?.available === true;
        }
        const onDeviceSummary = writingHelperReady && runtimeRecovered
          ? await SynthesisService.summarizeMeeting(
            meeting.transcript.map(segment => segment.text).join(' '),
          ).catch(error => {
            console.warn('Meeting summary could not be created:', error);
            return null;
          })
          : null;
        const updated = await persistMeetingUpdate(meetingId, current => ({
          ...current,
          status: 'complete',
          summary: onDeviceSummary ?? (current.summary?.trim() ? current.summary : transcriptSummary),
          summarySource: onDeviceSummary
            ? 'on-device'
            : current.summary?.trim() ? current.summarySource : transcriptSummary ? 'transcript' : current.summarySource,
          error: onDeviceSummary || !writingHelperReady
            ? undefined
            : automaticRetry
              ? 'Automatic summary retry failed. Transcript and suggested actions remain saved.'
              : 'Summary could not be created; it will retry automatically when the app is ready.',
          actions: current.actions.length ? current.actions : suggestMeetingActions(current.transcript),
        }));
        if (updated) scheduleMeetingAudioCleanup(updated);
      } finally {
        meetingSummaryInFlight.delete(meetingId);
        set({ meetingSummaryProcessingActive: meetingSummaryInFlight.size > 0 });
        syncSynthesisQueueGate(get());
      }
    },

    startCapture: async () => {
      if (!RELEASE_CAPABILITIES.voiceCapture) return;
      const latestReadiness = get().audioReadiness;

      if (!get().pushToRecordEnabled) {
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

      set(recordingStatePatch(
        'starting',
        latestReadiness.transcriptionReady
          ? 'Starting...'
          : 'Starting · transcription will finish when the voice model is ready',
      ));

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
        const recordingNotice = !latestReadiness.transcriptionReady
          ? ' · saved in Inbox until voice model is ready'
          : notificationPermission ? '' : ' · stop from app';
        set(recordingStatePatch(
          'recording',
          `${listeningStatus}${recordingNotice}`,
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
      if (get().activeMeetingId && get().recordingState === 'recording') {
        await get().stopMeeting();
        return;
      }
      if (get().recordingState !== 'recording') return;
      if (get().widgetVoiceCaptureActive) {
        try {
          const stopWidgetCapture = NativeModules.EventEmitter?.stopWidgetVoiceCapture;
          if (typeof stopWidgetCapture !== 'function') throw new Error('Widget recording control is unavailable');
          await stopWidgetCapture.call(NativeModules.EventEmitter);
          set({ widgetVoiceCaptureActive: false, ...recordingStatePatch('idle', 'Saving widget recording...') });
          await get().recoverInterruptedRecordings();
          const recovered = await get().retryRetainedInboxAudio({ queueSynthesis: true });
          set(recordingStatePatch('idle', recovered.recovered ? 'Voice note transcribed' : 'Voice note saved in Inbox'));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set(recordingStatePatch('error', `Widget recording needs attention: ${message}`));
        }
        return;
      }
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
