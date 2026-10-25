import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type { TranscriptionResult } from '../../modules/AudioEngine';
import type { NoteSourceMetadata } from '../../shared/notes/noteTypes';

const mockInitializeModels = jest.fn(async () => ({
  transcriptionReady: true,
  wakeWordReady: false,
  missingModels: [],
  errors: [],
}));
const mockStartRecording = jest.fn(async () => undefined);
const mockGetCaptureInputLabel = jest.fn(() => null as string | null);
const mockStopRecording = jest.fn<
  Promise<TranscriptionResult>,
  [onAudioRetained?: (audioFilePath: string) => Promise<void>]
>(async () => ({ text: '', confidence: 0 }));
const mockTranscribeFile = jest.fn<Promise<TranscriptionResult>, [filePathOrAsset: string | number]>(async () => ({
  text: '',
  confidence: 0,
}));
const mockDeleteRetainedAudioFile = jest.fn(async () => true);
const mockRecoverInterruptedRecordings = jest.fn(async () => 0);

const mockDrainQuickTextOutbox = jest.fn(async () => 0);
jest.mock('../../modules/BackgroundSynthesis/quickTextCapture', () => ({
  drainQuickTextOutbox: mockDrainQuickTextOutbox,
}));

const mockConfigure = jest.fn();
const mockInitialize = jest.fn(async () => ({
  available: true,
  status: 'ready',
  detail: 'LiteRT ready',
}));
const mockSetLockScreenHeadsetCaptureEnabled = jest.fn(async () => undefined);
const mockRequestAudioPermissions = jest.fn(async () => true);
const mockRequestRecordingNotificationPermission = jest.fn(async () => true);
const mockRequestLockScreenCapturePermissions = jest.fn(async () => true);
const mockLoadAppPreferences = jest.fn(async () => null as { liteRtEnabled: boolean; selectedModelId: string } | null);
const mockSaveAppPreferences = jest.fn(async () => undefined);

jest.mock('../../modules/AudioEngine/AudioEngineImpl', () => ({
  AudioEngineImpl: jest.fn().mockImplementation(() => ({
    initializeModels: mockInitializeModels,
    stopWakeWordDetection: jest.fn(async () => undefined),
    startWakeWordDetection: jest.fn(async () => undefined),
    startRecording: mockStartRecording,
    getCaptureInputLabel: mockGetCaptureInputLabel,
    stopRecording: mockStopRecording,
    transcribeFile: mockTranscribeFile,
    deleteRetainedAudioFile: mockDeleteRetainedAudioFile,
    recoverInterruptedRecordings: mockRecoverInterruptedRecordings,
  })),
}));

jest.mock('../appPreferences', () => ({
  loadAppPreferences: mockLoadAppPreferences,
  saveAppPreferences: mockSaveAppPreferences,
}));

jest.mock('../../modules/SynthesisEngine/SynthesisService', () => ({
  SynthesisService: {
    configure: mockConfigure,
    initialize: mockInitialize,
    release: jest.fn(async () => undefined),
    synthesize: jest.fn(),
    getLiteRtReadiness: jest.fn(),
    resetForTests: jest.fn(),
  },
}));

jest.mock('../../modules/HeadsetTrigger', () => ({
  setLockScreenHeadsetCaptureEnabled: mockSetLockScreenHeadsetCaptureEnabled,
}));

jest.mock('../../modules/ContextManager', () => ({
  ContextManager: {
    setPath: jest.fn(),
    readContext: jest.fn(async () => []),
    appendThought: jest.fn(),
    commitSynthesisResult: jest.fn(),
    getInboxThoughts: jest.fn(() => []),
    getThoughtsFromSection: jest.fn((section: { content: string }) =>
      section.content ? [{ text: section.content.replace(/^\s*-\s*/, '') }] : [],
    ),
    removeThought: jest.fn(),
    updateThought: jest.fn(),
  },
}));

jest.mock('../../shared/utils/permissions', () => ({
  requestAudioPermissions: mockRequestAudioPermissions,
  requestLockScreenCapturePermissions: mockRequestLockScreenCapturePermissions,
  requestRecordingNotificationPermission: mockRequestRecordingNotificationPermission,
}));

describe('useAppStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAppPreferences.mockResolvedValue(null);
    mockSaveAppPreferences.mockResolvedValue(undefined);
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue('0');
    mockRequestAudioPermissions.mockResolvedValue(true);
    mockRequestRecordingNotificationPermission.mockResolvedValue(true);
    mockGetCaptureInputLabel.mockReturnValue(null);
    mockRequestLockScreenCapturePermissions.mockResolvedValue(true);
    mockStopRecording.mockResolvedValue({ text: '', confidence: 0 });
    mockDeleteRetainedAudioFile.mockResolvedValue(true);
    mockRecoverInterruptedRecordings.mockResolvedValue(0);
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    ProcessingQueueManager.resetForTests();
    (ContextManager.commitSynthesisResult as jest.Mock).mockImplementation(async (
      source: { sectionHeader: string; thoughtText: string; noteId?: string; thoughtId?: string },
      targetHeader: string,
      refinedText: string,
      options: Record<string, unknown>,
    ) => {
      await ContextManager.appendThought(targetHeader, refinedText, options);
      await ContextManager.removeThought(source.sectionHeader, source.thoughtText, source.noteId ?? source.thoughtId);
      return true;
    });
  });

  it('hydrates persisted assistant/model choices and saves later user changes', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const original = useAppStore.getState();
    mockLoadAppPreferences.mockResolvedValueOnce({
      liteRtEnabled: false,
      selectedModelId: 'gemma4-e2b-it',
    });

    await useAppStore.getState().hydratePreferences();
    expect(useAppStore.getState()).toMatchObject({
      preferencesHydrated: true,
      liteRtEnabled: false,
      selectedModelId: 'gemma4-e2b-it',
    });
    expect(mockConfigure).toHaveBeenLastCalledWith(expect.objectContaining({ liteRtEnabled: false }));

    useAppStore.getState().setCaptureSetting('liteRtEnabled', true);
    await useAppStore.getState().selectModel('gemma3-1b-it');
    expect(mockSaveAppPreferences).toHaveBeenLastCalledWith({
      liteRtEnabled: true,
      selectedModelId: 'gemma3-1b-it',
    });
    useAppStore.setState({ ...original, preferencesHydrated: true });
  });

  it('continues engine initialization when interrupted-recording recovery needs a retry', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const original = useAppStore.getState();
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockRecoverInterruptedRecordings.mockRejectedValueOnce(new Error('invalid descriptor'));

    try {
      await expect(useAppStore.getState().initializeEngine({ eagerAudio: false, eagerSynthesis: false })).resolves.toBeUndefined();
      expect(useAppStore.getState().preferencesHydrated).toBe(true);
      expect(useAppStore.getState().status).toContain('Recording recovery needs attention');
    } finally {
      useAppStore.setState(original);
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('imports durable widget text when an existing app returns to foreground', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const original = useAppStore.getState();
    const loadContext = jest.fn(async () => undefined);
    const queueInboxForSynthesis = jest.fn(async () => 1);
    useAppStore.setState({ loadContext, queueInboxForSynthesis, wakeWordEnabled: false });
    mockDrainQuickTextOutbox.mockResolvedValueOnce(1);
    try {
      await useAppStore.getState().setAppLifecycleState('active');
      expect(loadContext).toHaveBeenCalledTimes(1);
      expect(queueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    } finally {
      useAppStore.setState(original);
    }
  });

  it('auto-queues Inbox synthesis silently during engine initialization when LiteRT is ready', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const queueInboxForSynthesis = jest.fn(async () => 2);
    (NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock).mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: true,
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
      apiLevel: 36,
    });

    useAppStore.setState({
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
      audioReadiness: {
        transcriptionReady: false,
        wakeWordReady: false,
        missingModels: [],
        errors: [],
      },
      manualCaptureEnabled: true,
      pushToRecordEnabled: true,
      wakeWordEnabled: false,
      liteRtEnabled: true,
      models: [],
      selectedModelId: 'gemma3-1b-it',
      selectedModelInstalled: false,
      selectedModelDownloading: false,
      selectedModelProgress: 0,
      selectedModelError: null,
      selectedModelStatusMessage: null,
      queueJobs: [],
    });
    const storeState = useAppStore.getState() as any;
    const originalQueueInboxForSynthesis = storeState.queueInboxForSynthesis;
    storeState.queueInboxForSynthesis = queueInboxForSynthesis;

    await useAppStore.getState().initializeEngine();
    useAppStore.setState({ queueInboxForSynthesis: originalQueueInboxForSynthesis });

    expect(mockInitializeModels).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(queueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(useAppStore.getState().status).toBe('Idle');
  });

  it('does not download a model on an eligible physical device before the user chooses to', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const original = useAppStore.getState();
    const downloadModel = jest.fn(async () => undefined);
    const queueInboxForSynthesis = jest.fn(async () => 1);
    const refreshModels = jest.fn(async () => undefined);
    (NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock).mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
      apiLevel: 36,
    });
    (RNFS.getFSInfo as jest.Mock).mockResolvedValueOnce({ freeSpace: 8 * 1024 ** 3 });
    useAppStore.setState({
      downloadModel,
      queueInboxForSynthesis,
      refreshModels,
      liteRtEnabled: true,
      selectedModelInstalled: false,
      selectedModelDownloading: false,
    });

    try {
      await useAppStore.getState().initializeEngine({ eagerAudio: false });
      expect(downloadModel).not.toHaveBeenCalled();
      expect(queueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    } finally {
      useAppStore.setState(original);
    }
  });

  it('persists manual and assistant captures before adding them to the in-memory queue', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    let finishPersistence: (() => void) | undefined;
    const persistence = new Promise<void>(resolve => {
      finishPersistence = resolve;
    });
    (ContextManager.appendThought as jest.Mock).mockReturnValueOnce(persistence);
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-durable-capture');

    const capturePromise = useAppStore.getState().addThought('  remember the durable capture  ', 'text');
    await Promise.resolve();

    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Inbox',
      'remember the durable capture',
      expect.objectContaining({
        noteId: expect.any(String),
        sourceKind: 'text',
        sourceTranscript: 'remember the durable capture',
        sourceMetadata: expect.objectContaining({
          kind: 'text',
          transcript: 'remember the durable capture',
          noteId: expect.any(String),
        }),
      }),
    );
    expect(addToQueueSpy).not.toHaveBeenCalled();

    finishPersistence?.();
    await capturePromise;

    expect(addToQueueSpy).toHaveBeenCalledWith(
      'remember the durable capture',
      'text',
      expect.objectContaining({
        sectionHeader: 'Inbox',
        thoughtText: 'remember the durable capture',
        noteId: expect.any(String),
        sourceMetadata: expect.objectContaining({
          kind: 'text',
          transcript: 'remember the durable capture',
        }),
      }),
      expect.objectContaining({
        noteId: expect.any(String),
        selectedTopic: null,
      }),
    );
    expect(ContextManager.readContext).toHaveBeenCalled();

    addToQueueSpy.mockRestore();
  });

  it('does not synthesize a persisted capture twice when background rehydration wins the enqueue race', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const schedule = NativeModules.BackgroundSynthesisModule.scheduleQueuedSynthesis as jest.Mock;
    const originalPlatform = Platform.OS;
    let resumeCaptureRead!: (sections: Array<{ header: string; content: string }>) => void;
    let capturePromise: Promise<void> | undefined;
    const captureRead = new Promise<Array<{ header: string; content: string }>>(resolve => {
      resumeCaptureRead = resolve;
    });
    let readCount = 0;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    (NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock).mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: true,
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
      apiLevel: 36,
    });
    (ContextManager.readContext as jest.Mock).mockImplementation(async () => {
      readCount += 1;
      if (readCount === 1) {
        return captureRead;
      }
      return [{ header: 'Inbox', content: '- Finish the background race note' }];
    });
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Finish the background race note.',
      tags: [],
      source: 'litert',
    });
    schedule.mockResolvedValueOnce(true);

    try {
      await useAppStore.getState().initializeEngine({ eagerAudio: false, eagerSynthesis: false });
      ProcessingQueueManager.setProcessingBlockedReason('Hold until the capture resumes');
      capturePromise = useAppStore.getState().addThought('Finish the background race note');
      await Promise.resolve();
      await Promise.resolve();

      expect(ContextManager.appendThought).toHaveBeenCalledWith(
        'Inbox',
        'Finish the background race note',
        expect.objectContaining({ noteId: expect.any(String) }),
      );
      expect(readCount).toBe(1);
      const persistedMetadata = (ContextManager.appendThought as jest.Mock).mock.calls[0][2];
      const noteId = persistedMetadata.noteId;
      (ContextManager.getInboxThoughts as jest.Mock).mockReturnValueOnce([{
        id: noteId,
        noteId,
        sectionHeader: 'Inbox',
        text: 'Finish the background race note',
        thoughtText: 'Finish the background race note',
        sourceKind: 'text',
        sourceTranscript: 'Finish the background race note',
        sourceMetadata: { kind: 'text', transcript: 'Finish the background race note', noteId },
      }]);

      await useAppStore.getState().setAppLifecycleState('background');
      expect(ProcessingQueueManager.getState().pendingCount).toBe(1);
      expect(schedule).toHaveBeenCalledTimes(1);

      ProcessingQueueManager.setProcessingBlockedReason(null);
      await expect(ProcessingQueueManager.waitUntilSettled(1000)).resolves.toBe('idle');
      expect(SynthesisService.synthesize).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().status).toBe('Organized into Work');

      resumeCaptureRead([{ header: 'Inbox', content: '- Finish the background race note' }]);
      await capturePromise;
      await expect(ProcessingQueueManager.waitUntilSettled(1000)).resolves.toBe('idle');

      expect(SynthesisService.synthesize).toHaveBeenCalledTimes(1);
      expect(ContextManager.appendThought).toHaveBeenCalledTimes(2);
      expect(ContextManager.appendThought).toHaveBeenNthCalledWith(
        2,
        'Work',
        'Finish the background race note.',
        expect.objectContaining({ noteId }),
      );
      expect(useAppStore.getState().status).toBe('Organized into Work');
    } finally {
      resumeCaptureRead([{ header: 'Inbox', content: '' }]);
      await capturePromise?.catch(() => undefined);
      ProcessingQueueManager.resetForTests();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('reports Inbox fallback separately from successful topic filing', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    useAppStore.setState({ liteRtEnabled: false });
    await useAppStore.getState().initializeEngine({ eagerAudio: false, eagerSynthesis: false });

    useAppStore.setState({ liteRtEnabled: false, selectedModelInstalled: false });
    (SynthesisService.synthesize as jest.Mock).mockResolvedValueOnce({
      topic: 'Inbox',
      refinedText: 'Keep this note safe',
      tags: ['fallback'],
      source: 'raw-fallback',
    });
    await useAppStore.getState().addThought('Keep this note safe');
    await ProcessingQueueManager.waitUntilSettled();
    expect(useAppStore.getState().status).toBe(
      'Saved to Inbox: turn on the writing assistant in Settings to organize this note.',
    );

    useAppStore.setState({ liteRtEnabled: true });
    (SynthesisService.synthesize as jest.Mock).mockResolvedValueOnce({
      topic: 'Home',
      refinedText: 'Replace the kitchen filter.',
      tags: ['home'],
      source: 'litert',
    });
    await useAppStore.getState().addThought('Replace the kitchen filter');
    await ProcessingQueueManager.waitUntilSettled();
    expect(useAppStore.getState().status).toBe('Organized into Home');
  });

  it('does not enqueue a capture when durable Inbox persistence fails', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    (ContextManager.appendThought as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue');

    await expect(useAppStore.getState().addThought('keep this visible', 'text')).rejects.toThrow('disk unavailable');

    expect(addToQueueSpy).not.toHaveBeenCalled();
    expect(ContextManager.readContext).not.toHaveBeenCalled();

    addToQueueSpy.mockRestore();
  });

  it('attempts synthesis below the RAM minimum even when available memory is low', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const getDeviceReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-below-minimum');
    const selectedModel = useAppStore.getState().models[0];
    useAppStore.setState({
      models: [{ ...selectedModel, installed: true, verified: true }],
      selectedModelInstalled: true,
    });
    getDeviceReadiness.mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 3 * 1024 ** 3,
      availableMemoryBytes: 512 * 1024 ** 2,
      lowMemory: true,
      thermalState: 'nominal',
      osVersion: '14',
    });

    await useAppStore.getState().refreshDeviceReadiness();
    await useAppStore.getState().addThought('Keep this note safe');

    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Inbox',
      'Keep this note safe',
      expect.objectContaining({ sourceTranscript: 'Keep this note safe' }),
    );
    expect(addToQueueSpy).toHaveBeenCalledTimes(1);
    expect(ProcessingQueueManager.getState().blockedReason).toBeNull();
    addToQueueSpy.mockRestore();
  });

  it('previews and queues imported text below the model RAM minimum despite low available memory', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const getDeviceReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-import');
    (SynthesisService.synthesize as jest.Mock).mockResolvedValueOnce({
      topic: 'Outdoors',
      refinedText: 'Pack water for the weekend hike.',
      tags: ['hike'],
      source: 'litert',
    });
    getDeviceReadiness.mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 3.5 * 1024 ** 3,
      availableMemoryBytes: 512 * 1024 ** 2,
      lowMemory: true,
      thermalState: 'nominal',
      osVersion: '12',
    });

    await useAppStore.getState().refreshDeviceReadiness();
    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'text',
      text: 'Pack water for the weekend hike.',
    });
    await useAppStore.getState().queueImportedThought(preview);

    expect(preview).toMatchObject({ source: 'litert', suggestedTopic: 'Outdoors', requiresApproval: false });
    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(1);
    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Inbox',
      'Pack water for the weekend hike.',
      expect.objectContaining({ sourceTranscript: 'Pack water for the weekend hike.' }),
    );
    expect(addToQueueSpy).toHaveBeenCalledTimes(1);
    useAppStore.setState({ deviceReadiness: null });
    addToQueueSpy.mockRestore();
  });

  it('saves imported text and waits for transient memory to recover before synthesis', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const selectedModel = useAppStore.getState().models.find(model => model.id === useAppStore.getState().selectedModelId)!;
    useAppStore.setState({ models: [{ ...selectedModel, installed: true, verified: true }] });
    (NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock).mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 512 * 1024 ** 2,
      lowMemory: true,
      thermalState: 'nominal',
      osVersion: '12',
    });

    await useAppStore.getState().refreshDeviceReadiness();
    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'text',
      text: 'Save this for later when memory is free.',
    });
    await useAppStore.getState().queueImportedThought(preview);

    expect(preview.source).toBe('raw-fallback');
    expect(SynthesisService.synthesize).not.toHaveBeenCalled();
    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Inbox',
      'Save this for later when memory is free.',
      expect.objectContaining({ sourceTranscript: 'Save this for later when memory is free.' }),
    );
    expect(ProcessingQueueManager.getState().blockedReason).toContain('available memory is low');
  });

  it('holds queued synthesis during temporary memory pressure and resumes after resources recover', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const getDeviceReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
    const initialState = useAppStore.getState();
    const selectedModel = initialState.models.find(model => model.id === initialState.selectedModelId)!;
    useAppStore.setState({ models: [{ ...selectedModel, installed: true, verified: true }] });
    getDeviceReadiness.mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 12 * 1024 ** 3,
      availableMemoryBytes: 512 * 1024 ** 2,
      lowMemory: true,
      thermalState: 'nominal',
      osVersion: '14',
    });
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Ideas',
      refinedText: 'Keep this note safe',
      tags: [],
      source: 'litert',
    });

    await useAppStore.getState().refreshDeviceReadiness();
    await useAppStore.getState().addThought('Keep this note safe');
    expect(ProcessingQueueManager.getState().blockedReason).toContain('available memory is low');
    expect(useAppStore.getState().pendingCount).toBe(1);

    getDeviceReadiness.mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 12 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '14',
    });
    (SynthesisService.getLiteRtReadiness as jest.Mock).mockReturnValue({ available: true });

    await useAppStore.getState().refreshDeviceReadiness();

    expect(ProcessingQueueManager.getState().blockedReason).toBeNull();
  });

  it('schedules Android idle synthesis for durable notes blocked by temporary resources', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const scheduleQueuedSynthesis = NativeModules.BackgroundSynthesisModule.scheduleQueuedSynthesis as jest.Mock;
    const getDeviceReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    try {
      await useAppStore.getState().initializeEngine({ eagerAudio: false, eagerSynthesis: false });
      const selectedModel = useAppStore.getState().models.find(model => model.id === useAppStore.getState().selectedModelId)!;
      useAppStore.setState({ models: [{ ...selectedModel, installed: true, verified: true }] });
      getDeviceReadiness.mockResolvedValueOnce({
        checkAvailable: true,
        isSimulator: true,
        totalMemoryBytes: 6 * 1024 ** 3,
        availableMemoryBytes: 512 * 1024 ** 2,
        lowMemory: true,
        thermalState: 'nominal',
        osVersion: '16',
      });

      await useAppStore.getState().refreshDeviceReadiness();
      await useAppStore.getState().addThought('Keep and retry this note');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().status).toBe(
        'Saved in Inbox. Android will retry when it can; timing depends on the system.',
      );
      expect(useAppStore.getState().queueBlockedReason).toBe(
        'Saved in Inbox. Android will retry when it can; timing depends on the system.',
      );
      expect(useAppStore.getState().pendingCount).toBe(1);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('schedules existing durable Inbox notes when Android backgrounds', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const schedule = NativeModules.BackgroundSynthesisModule.scheduleQueuedSynthesis as jest.Mock;
    const originalPlatform = Platform.OS;
    const order: string[] = [];
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    ProcessingQueueManager.setProcessingBlockedReason('Hold until the app returns');
    (ContextManager.readContext as jest.Mock).mockImplementationOnce(async () => {
      order.push('read durable Inbox');
      return [{ header: 'Inbox', content: '- Keep this note' }];
    });
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValueOnce([{
      id: 'background-note',
      noteId: 'background-note',
      sectionHeader: 'Inbox',
      text: 'Keep this note',
      thoughtText: 'Keep this note',
      sourceKind: 'text',
      sourceTranscript: 'Keep this note',
      sourceMetadata: { kind: 'text', transcript: 'Keep this note', noteId: 'background-note' },
    }]);
    schedule.mockImplementationOnce(async () => {
      order.push('schedule WorkManager');
      return true;
    });

    try {
      await useAppStore.getState().setAppLifecycleState('background');

      expect(order).toEqual(['read durable Inbox', 'schedule WorkManager']);
      expect(ProcessingQueueManager.getState().pendingCount).toBe(1);
      expect(useAppStore.getState().status).toBe(
        'Saved in Inbox. Android will retry when it can; timing depends on the system.',
      );
      expect(useAppStore.getState().queueBlockedReason).toBe(
        'Saved in Inbox. Android will retry when it can; timing depends on the system.',
      );
    } finally {
      ProcessingQueueManager.resetForTests();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('does not schedule Android work when Inbox and the in-memory queue are empty', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const schedule = NativeModules.BackgroundSynthesisModule.scheduleQueuedSynthesis as jest.Mock;
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    try {
      await useAppStore.getState().setAppLifecycleState('background');

      expect(ProcessingQueueManager.getState().pendingCount).toBe(0);
      expect(schedule).not.toHaveBeenCalled();
    } finally {
      ProcessingQueueManager.resetForTests();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('reports when Android cannot schedule durable background work', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const schedule = NativeModules.BackgroundSynthesisModule.scheduleQueuedSynthesis as jest.Mock;
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    ProcessingQueueManager.setProcessingBlockedReason('Hold until the app returns');
    (ContextManager.readContext as jest.Mock).mockResolvedValueOnce([{ header: 'Inbox', content: '- Keep this note' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValueOnce([{
      id: 'background-failure-note',
      noteId: 'background-failure-note',
      sectionHeader: 'Inbox',
      text: 'Keep this note',
      thoughtText: 'Keep this note',
      sourceKind: 'text',
      sourceTranscript: 'Keep this note',
      sourceMetadata: { kind: 'text', transcript: 'Keep this note', noteId: 'background-failure-note' },
    }]);
    schedule.mockResolvedValueOnce(false);

    try {
      await useAppStore.getState().setAppLifecycleState('background');

      expect(schedule).toHaveBeenCalledTimes(1);
      expect(ProcessingQueueManager.getState().pendingCount).toBe(1);
      expect(useAppStore.getState().status).toBe(
        'Saved in Inbox. Android could not schedule the retry. Open the app again to continue.',
      );
      expect(useAppStore.getState().queueBlockedReason).toBe(
        'Saved in Inbox. Android could not schedule the retry. Open the app again to continue.',
      );
    } finally {
      ProcessingQueueManager.resetForTests();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('does not let a late background scheduling reply replace a foreground completion', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const releaseCapabilities = require('../releaseCapabilities').RELEASE_CAPABILITIES as { wakeWord: boolean };
    const schedule = NativeModules.BackgroundSynthesisModule.scheduleQueuedSynthesis as jest.Mock;
    const originalPlatform = Platform.OS;
    const originalWakeWordCapability = releaseCapabilities.wakeWord;
    let resolveSchedule!: (scheduled: boolean) => void;
    let markSchedulingStarted!: () => void;
    const schedulingStarted = new Promise<void>(resolve => {
      markSchedulingStarted = resolve;
    });
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    (NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock).mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: true,
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
      apiLevel: 36,
    });
    await useAppStore.getState().initializeEngine({ eagerAudio: false, eagerSynthesis: false });
    ProcessingQueueManager.setProcessingBlockedReason('Hold until the app returns');
    (ContextManager.readContext as jest.Mock).mockResolvedValueOnce([{ header: 'Inbox', content: '- Finish the note' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValueOnce([{
      id: 'completion-race-note',
      noteId: 'completion-race-note',
      sectionHeader: 'Inbox',
      text: 'Finish the note',
      thoughtText: 'Finish the note',
      sourceKind: 'text',
      sourceTranscript: 'Finish the note',
      sourceMetadata: { kind: 'text', transcript: 'Finish the note', noteId: 'completion-race-note' },
    }]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValueOnce({
      topic: 'Ideas',
      refinedText: 'Finish the note.',
      tags: [],
      source: 'litert',
    });
    schedule.mockImplementationOnce(() => {
      markSchedulingStarted();
      return new Promise<boolean>(resolve => {
        resolveSchedule = resolve;
      });
    });
    releaseCapabilities.wakeWord = false;
    const originalRefreshDeviceReadiness = useAppStore.getState().refreshDeviceReadiness;
    useAppStore.setState({
      refreshDeviceReadiness: async () => {
        ProcessingQueueManager.setProcessingBlockedReason(null);
        return {} as any;
      },
    });
    try {
      const backgroundPromise = useAppStore.getState().setAppLifecycleState('background');
      await schedulingStarted;
      await useAppStore.getState().setAppLifecycleState('active');
      const settled = await ProcessingQueueManager.waitUntilSettled(1000);

      expect(settled).toBe('idle');
      expect(useAppStore.getState().status).toBe('Organized into Ideas');
      expect(useAppStore.getState().queueBlockedReason).toBeNull();
      resolveSchedule(true);
      await backgroundPromise;
      expect(useAppStore.getState().status).toBe('Organized into Ideas');
    } finally {
      useAppStore.setState({ refreshDeviceReadiness: originalRefreshDeviceReadiness });
      releaseCapabilities.wakeWord = originalWakeWordCapability;
      ProcessingQueueManager.resetForTests();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('does not start a model download when free storage is below the model size plus setup headroom', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const model = useAppStore.getState().models[0];
    (RNFS.getFSInfo as jest.Mock).mockResolvedValueOnce({
      freeSpace: 256 * 1024 ** 2,
      totalSpace: 64 * 1024 ** 3,
    });

    await useAppStore.getState().downloadModel(model.id);

    expect(useAppStore.getState().selectedModelDownloading).toBe(false);
    expect(useAppStore.getState().status).toContain('Free up storage before installing');
  });

  it('keeps model selection locked to the active download until it finishes', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const modelManager = require('../../modules/SynthesisEngine/modelManager') as typeof import('../../modules/SynthesisEngine/modelManager');
    const target = useAppStore.getState().models[0];
    const alternate = useAppStore.getState().models[1];
    const downloadSpy = jest.spyOn(modelManager, 'downloadSynthesisModel');
    let markStarted!: () => void;
    let rejectDownload!: (reason: Error) => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    downloadSpy.mockImplementation((_model, onProgress) => {
      onProgress?.({ progress: 32, statusMessage: 'Downloading model' });
      markStarted();
      return new Promise((_resolve, reject) => { rejectDownload = reject; });
    });

    try {
      const download = useAppStore.getState().downloadModel(target.id);
      await started;
      await useAppStore.getState().selectModel(alternate.id);
      await useAppStore.getState().downloadModel(alternate.id);
      expect(useAppStore.getState().selectedModelId).toBe(target.id);
      expect(useAppStore.getState().selectedModelDownloading).toBe(true);
      expect(downloadSpy).toHaveBeenCalledTimes(1);

      rejectDownload(new Error('Download interrupted'));
      await download;
      expect(useAppStore.getState().selectedModelId).toBe(target.id);
      expect(useAppStore.getState().selectedModelDownloading).toBe(false);

      await useAppStore.getState().selectModel(alternate.id);
      expect(useAppStore.getState().selectedModelId).toBe(alternate.id);
    } finally {
      downloadSpy.mockRestore();
    }
  });

  it('locks model selection and duplicate downloads during readiness preflight', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const modelManager = require('../../modules/SynthesisEngine/modelManager') as typeof import('../../modules/SynthesisEngine/modelManager');
    const originalState = useAppStore.getState();
    const originalSelectedModelId = originalState.selectedModelId;
    const [target, alternate] = originalState.models;
    const getDeviceReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
    const downloadSpy = jest.spyOn(modelManager, 'downloadSynthesisModel').mockRejectedValueOnce(new Error('Download interrupted'));
    let markReadinessStarted!: () => void;
    let resolveReadiness!: (value: unknown) => void;
    const readinessStarted = new Promise<void>(resolve => { markReadinessStarted = resolve; });
    getDeviceReadiness.mockImplementationOnce(() => {
      markReadinessStarted();
      return new Promise(resolve => { resolveReadiness = resolve; });
    });
    (RNFS.getFSInfo as jest.Mock).mockResolvedValueOnce({ freeSpace: 8 * 1024 ** 3 });

    try {
      const download = useAppStore.getState().downloadModel(target.id);
      await readinessStarted;
      expect(useAppStore.getState().selectedModelDownloading).toBe(true);
      await useAppStore.getState().selectModel(alternate.id);
      await useAppStore.getState().downloadModel(alternate.id);
      expect(useAppStore.getState().selectedModelId).toBe(originalSelectedModelId);
      expect(downloadSpy).not.toHaveBeenCalled();

      resolveReadiness({
        checkAvailable: true,
        isSimulator: false,
        totalMemoryBytes: 8 * 1024 ** 3,
        availableMemoryBytes: 3 * 1024 ** 3,
        lowMemory: false,
        thermalState: 'nominal',
        osVersion: '16',
      });
      await download;
      expect(downloadSpy).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().selectedModelId).toBe(target.id);
      expect(useAppStore.getState().selectedModelDownloading).toBe(false);
    } finally {
      useAppStore.setState(originalState);
      downloadSpy.mockRestore();
    }
  });

  it('installs and initializes the selected model below minimum RAM with a performance warning', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const modelManager = require('../../modules/SynthesisEngine/modelManager') as typeof import('../../modules/SynthesisEngine/modelManager');
    const downloadSpy = jest.spyOn(modelManager, 'downloadSynthesisModel');
    const model = useAppStore.getState().models[0];
    const queueInboxForSynthesis = jest.fn(async () => 0);
    const originalQueueInboxForSynthesis = useAppStore.getState().queueInboxForSynthesis;
    useAppStore.setState({ queueInboxForSynthesis });
    const manifest = {
      [model.id]: {
        installedAt: '2026-10-18T00:00:00.000Z',
        file: model.modelFile,
        size: model.sizeInBytes,
        sha256: model.expectedSha256,
        sourceUrl: model.sourceUrl,
        license: model.license,
        verified: true,
      },
    };
    (RNFS.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(manifest));
    downloadSpy.mockResolvedValueOnce({ ...model, installed: true, verified: true });
    const getDeviceReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
    const belowMinimumReadiness = {
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 3 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '14',
    };
    getDeviceReadiness
      .mockResolvedValueOnce(belowMinimumReadiness)
      .mockResolvedValueOnce(belowMinimumReadiness);

    await useAppStore.getState().downloadModel(model.id);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().selectedModelDownloading).toBe(false);
    expect(useAppStore.getState().status).toContain('Compact assistant is below this device’s 4 GB RAM minimum');
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(queueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    useAppStore.setState({
      deviceReadiness: null,
      queueInboxForSynthesis: originalQueueInboxForSynthesis,
    });
    downloadSpy.mockRestore();
  });

  it('flags related import merges for explicit approval before queueing', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');

    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Work', content: '' },
    ]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Finish the report.',
      tags: ['work'],
      source: 'litert',
    });

    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'text',
      text: 'finish the report',
    });

    expect(preview).toMatchObject({
      suggestedTopic: 'Work',
      mergeCandidate: true,
      requiresApproval: true,
    });
    expect(SynthesisService.synthesize).toHaveBeenCalledWith(
      'finish the report',
      ['Work'],
      null,
      [{ topic: 'Work', content: '' }],
    );
  });

  it('requires approval whenever a fallback preview suggests an existing topic', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-import');

    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Work', content: '- Existing project context.' },
    ]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'finish the report',
      tags: ['fallback'],
      source: 'raw-fallback',
    });

    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'text',
      text: 'finish the report',
    });

    expect(preview).toMatchObject({
      suggestedTopic: 'Work',
      mergeCandidate: true,
      requiresApproval: true,
    });
    await expect(useAppStore.getState().queueImportedThought(preview)).rejects.toThrow(
      'Approve merge into Work before importing',
    );
    expect(addToQueueSpy).not.toHaveBeenCalled();

    await useAppStore.getState().queueImportedThought(preview, { approvedTopic: 'Work' });
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'finish the report',
      'text',
      expect.objectContaining({ sectionHeader: 'Inbox' }),
      expect.objectContaining({ selectedTopic: 'Work' }),
    );

    addToQueueSpy.mockRestore();
  });

  it('queues imported text into an explicitly selected topic with source metadata preserved', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-import');

    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Work', content: '' },
    ]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Finish the report.',
      tags: ['work'],
      source: 'litert',
    });

    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'text',
      text: 'finish the report',
      selectedTopic: 'Work',
    });

    const noteId = await useAppStore.getState().queueImportedThought(preview);

    expect(noteId).toMatch(/^import-/);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', preview.transcript,
      expect.objectContaining({ noteId, sourceTranscript: preview.transcript }));
    expect((ContextManager.appendThought as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      addToQueueSpy.mock.invocationCallOrder[0],
    );
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'finish the report',
      'text',
      expect.objectContaining({ sectionHeader: 'Inbox', noteId }),
      expect.objectContaining({
        selectedTopic: 'Work',
        skipVoiceDelay: false,
        sourceMetadata: expect.objectContaining({
          kind: 'text',
          transcript: 'finish the report',
        }),
      }),
    );

    addToQueueSpy.mockRestore();
  });

  it('preserves the current outcome when a persisted import enqueue is suppressed', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('');
    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'text',
      text: 'Import already processed by the background worker.',
      selectedTopic: 'Work',
    });
    useAppStore.setState({ status: 'Organized into Work' });

    await useAppStore.getState().queueImportedThought(preview);

    expect(useAppStore.getState().status).toBe('Organized into Work');
    addToQueueSpy.mockRestore();
  });

  it('queues imported voice files without the live capture delay and preserves the audio file path', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const { SynthesisService } = require('../../modules/SynthesisEngine/SynthesisService') as typeof import('../../modules/SynthesisEngine/SynthesisService');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-voice');

    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Ideas',
      refinedText: 'Voice import transcript.',
      tags: ['voice'],
      source: 'litert',
    });
    mockTranscribeFile.mockResolvedValue({
      text: 'Voice import transcript.',
      confidence: 1,
    });

    const preview = await useAppStore.getState().analyzeImportDraft({
      sourceKind: 'voice',
      voiceFile: '/tmp/imported.m4a',
      selectedTopic: 'Ideas',
    });
    const noteId = await useAppStore.getState().queueImportedThought(preview);

    expect(noteId).toMatch(/^import-/);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', preview.transcript,
      expect.objectContaining({ noteId, sourceTranscript: preview.transcript }));
    expect((ContextManager.appendThought as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      addToQueueSpy.mock.invocationCallOrder[0],
    );
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Voice import transcript.',
      'voice',
      expect.objectContaining({ sectionHeader: 'Inbox', noteId }),
      expect.objectContaining({
        selectedTopic: 'Ideas',
        skipVoiceDelay: true,
        sourceMetadata: expect.objectContaining({
          kind: 'voice',
          transcript: 'Voice import transcript.',
          audioFilePath: '/tmp/imported.m4a',
        }),
      }),
    );

    addToQueueSpy.mockRestore();
  });

  it('skips retained voice captures when queueing Inbox synthesis', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue');

    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([
      {
        sectionHeader: 'Inbox',
        text: 'Voice capture retained',
        noteId: 'note-voice-1',
        sourceKind: 'voice',
        sourceMetadata: {
          audioFilePath: '/tmp/voice.wav',
        },
      },
    ]);

    await useAppStore.getState().queueInboxForSynthesis({ announce: false });

    expect(addToQueueSpy).not.toHaveBeenCalled();

    addToQueueSpy.mockRestore();
  });

  it('still queues an imported voice transcript that has no capture error', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-import');
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([{
      noteId: 'imported-voice-note',
      sectionHeader: 'Inbox',
      text: 'Call the clinic tomorrow',
      sourceKind: 'voice',
      sourceMetadata: { kind: 'voice', transcript: 'Call the clinic tomorrow', audioFilePath: '/tmp/user-selected.m4a' },
    }]);

    await useAppStore.getState().queueInboxForSynthesis({ announce: false });

    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Call the clinic tomorrow',
      'voice',
      expect.objectContaining({ noteId: 'imported-voice-note' }),
      expect.objectContaining({ noteId: 'imported-voice-note' }),
    );
    addToQueueSpy.mockRestore();
  });

  it('cleans retained audio and queues a completed transcript after interrupted stop finalization', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    const recoveredThought = {
      id: 'voice-recovered-audio-retained',
      noteId: 'voice-recovered-audio-retained',
      sectionHeader: 'Inbox',
      text: 'Recovered words from the recording.',
      sourceKind: 'voice',
      sourceMetadata: {
        kind: 'voice',
        transcript: 'Recovered words from the recording.',
        audioFilePath: '/mock/path/retained-audio/contextengine-retained-not-yet-cleaned.wav',
      } as NoteSourceMetadata,
    };
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([recoveredThought]);
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-after-audio-delete');

    const queued = await useAppStore.getState().queueInboxForSynthesis({ announce: false });
    expect(queued).toBe(1);
    expect(ContextManager.updateThought).toHaveBeenCalledWith('Inbox', recoveredThought.noteId, {
      sourceMetadata: { audioFilePath: null, transcriptionError: null },
    });
    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(recoveredThought.sourceMetadata.audioFilePath);
    expect(addToQueueSpy).toHaveBeenCalledTimes(1);
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Recovered words from the recording.',
      'voice',
      expect.objectContaining({ noteId: recoveredThought.noteId }),
      expect.objectContaining({
        noteId: recoveredThought.noteId,
        sourceMetadata: expect.objectContaining({ audioFilePath: null }),
      }),
    );
    addToQueueSpy.mockRestore();
  });

  it('does not load Whisper when background Inbox scan has no app-owned recoverable recording', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useAppStore.setState({ isRecording: false, recordingState: 'idle' });
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([{
      noteId: 'imported-voice',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceMetadata: { audioFilePath: '/tmp/imported.wav' },
    }]);
    try {
      expect(await useAppStore.getState().retryRetainedInboxAudio()).toEqual({ recovered: 0, hasMore: false });
      expect(mockInitializeModels).not.toHaveBeenCalled();
      expect(mockTranscribeFile).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('recovers a retained Inbox recording automatically without queueing synthesis below baseline', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useAppStore.setState({ isRecording: false, recordingState: 'idle' });
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-background.wav';
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([{
      id: 'background-voice',
      noteId: 'background-voice',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceMetadata: { kind: 'voice', audioFilePath: retainedPath },
    }]);
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    mockInitializeModels.mockResolvedValue({ transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] });
    mockTranscribeFile.mockResolvedValue({ text: 'Recovered in background.', audioFilePath: retainedPath });
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue');
    try {
      expect(await useAppStore.getState().retryRetainedInboxAudio({ queueSynthesis: false })).toEqual({ recovered: 1, hasMore: false });
      expect(mockInitializeModels).toHaveBeenCalledTimes(1);
      expect(mockTranscribeFile).toHaveBeenCalledWith(retainedPath);
      expect(ContextManager.updateThought).toHaveBeenCalledWith('Inbox', 'background-voice', expect.objectContaining({
        text: 'Recovered in background.',
        sourceMetadata: expect.objectContaining({ noteId: 'background-voice' }),
      }));
      expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(retainedPath);
      expect(addToQueueSpy).not.toHaveBeenCalled();
      expect(useAppStore.getState().status).toBe('Transcript recovered in Inbox');
      expect(mockRequestAudioPermissions).not.toHaveBeenCalled();
    } finally {
      addToQueueSpy.mockRestore();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('advances the retained backlog without immediately retrying failed audio', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useAppStore.setState({ isRecording: false, recordingState: 'idle' });
    const attempts = new Map<string, string>();
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => attempts.has(path));
    (RNFS.readFile as jest.Mock).mockImplementation(async (path: string) => attempts.get(path));
    (RNFS.writeFile as jest.Mock).mockImplementation(async (path: string, value: string) => { attempts.set(path, value); });
    const thoughts = ['first', 'second'].map(id => ({
      noteId: id, sectionHeader: 'Inbox', text: 'Voice capture retained', sourceKind: 'voice',
      sourceMetadata: { audioFilePath: `/mock/path/retained-audio/contextengine-retained-${id}.wav` },
    }));
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue(thoughts);
    mockInitializeModels.mockResolvedValue({ transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] });
    mockTranscribeFile.mockResolvedValue({ text: '' });
    try {
      expect(await useAppStore.getState().retryRetainedInboxAudio()).toEqual({ recovered: 0, hasMore: true });
      expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
      expect(await useAppStore.getState().retryRetainedInboxAudio()).toEqual({ recovered: 0, hasMore: false });
      expect(mockTranscribeFile).toHaveBeenCalledTimes(2);
      expect(mockTranscribeFile).toHaveBeenNthCalledWith(2, thoughts[1].sourceMetadata.audioFilePath);
      expect(await useAppStore.getState().retryRetainedInboxAudio()).toEqual({ recovered: 0, hasMore: false });
      expect(mockTranscribeFile).toHaveBeenCalledTimes(2);
      expect(ContextManager.updateThought).not.toHaveBeenCalled();
      expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
      for (const key of attempts.keys()) attempts.set(key, String(Date.now() - 60 * 60 * 1000 - 1));
      expect(await useAppStore.getState().retryRetainedInboxAudio()).toEqual({ recovered: 0, hasMore: true });
      expect(mockTranscribeFile).toHaveBeenCalledTimes(3);
    } finally {
      (RNFS.writeFile as jest.Mock).mockReset();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('preserves background recordings when Whisper is unavailable', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useAppStore.setState({ isRecording: false, recordingState: 'idle' });
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([{
      noteId: 'background-unavailable', sectionHeader: 'Inbox', text: 'Voice capture retained', sourceKind: 'voice',
      sourceMetadata: { audioFilePath: '/mock/path/retained-audio/contextengine-retained-unavailable.wav' },
    }]);
    mockInitializeModels.mockResolvedValueOnce({ transcriptionReady: false, wakeWordReady: false, missingModels: [], errors: [] });
    try {
      expect(await useAppStore.getState().retryRetainedInboxAudio()).toEqual({ recovered: 0, hasMore: false });
      expect(mockInitializeModels).toHaveBeenCalledTimes(1);
      expect(mockTranscribeFile).not.toHaveBeenCalled();
      expect(ContextManager.updateThought).not.toHaveBeenCalled();
      expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('preserves a retained Inbox voice note when retry transcription is empty', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-empty.wav';
    const thought = {
      id: 'voice-retained-empty',
      noteId: 'voice-retained-empty',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceTranscript: 'Voice capture retained',
      sourceMetadata: { kind: 'voice', transcript: 'Voice capture retained', audioFilePath: retainedPath },
    };
    (ContextManager.readContext as jest.Mock).mockResolvedValue([{ header: 'Inbox', content: 'raw' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([thought]);
    mockTranscribeFile.mockResolvedValue({ text: '', audioFilePath: retainedPath });

    const retried = await useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    });

    expect(retried).toBe(false);
    expect(ContextManager.updateThought).not.toHaveBeenCalled();
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('preserves retained audio when retry transcription reports an error with partial text', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-error.wav';
    const thought = {
      id: 'voice-retained-error',
      noteId: 'voice-retained-error',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceMetadata: { kind: 'voice', audioFilePath: retainedPath },
    };
    (ContextManager.readContext as jest.Mock).mockResolvedValue([{ header: 'Inbox', content: 'raw' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([thought]);
    mockTranscribeFile.mockResolvedValue({ text: 'possibly inaccurate partial text', error: 'Decode failed' });

    const retried = await useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    });

    expect(retried).toBe(false);
    expect(ContextManager.updateThought).toHaveBeenCalledWith('Inbox', thought.noteId, {
      text: 'possibly inaccurate partial text',
      sourceMetadata: expect.objectContaining({
        audioFilePath: retainedPath,
        transcript: 'possibly inaccurate partial text',
        transcriptionError: 'Decode failed',
      }),
    });
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
  });

  it('persists a retried transcript and queues the same retained Inbox note once', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-retry.wav';
    const thought = {
      id: 'voice-retained-retry',
      noteId: 'voice-retained-retry',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceTranscript: 'Voice capture retained',
      sourceMetadata: { kind: 'voice', transcript: 'Voice capture retained', audioFilePath: retainedPath },
    };
    (ContextManager.readContext as jest.Mock).mockResolvedValue([{ header: 'Inbox', content: 'raw' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([thought]);
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    mockTranscribeFile.mockResolvedValue({ text: 'Call the dentist Friday at nine.', audioFilePath: retainedPath });
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-retry');

    const retried = await useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    });

    expect(retried).toBe(true);
    expect(mockTranscribeFile).toHaveBeenCalledWith(retainedPath);
    expect(ContextManager.updateThought).toHaveBeenCalledWith('Inbox', thought.noteId, {
      text: 'Call the dentist Friday at nine.',
      sourceMetadata: expect.objectContaining({
        kind: 'voice',
        transcript: 'Call the dentist Friday at nine.',
        noteId: thought.noteId,
        audioFilePath: retainedPath,
      }),
    });
    expect(addToQueueSpy).toHaveBeenCalledTimes(1);
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Call the dentist Friday at nine.',
      'voice',
      expect.objectContaining({
        sectionHeader: 'Inbox',
        noteId: thought.noteId,
        thoughtId: thought.noteId,
        thoughtText: 'Call the dentist Friday at nine.',
        sourceMetadata: expect.objectContaining({ audioFilePath: null }),
      }),
      expect.objectContaining({
        noteId: thought.noteId,
        selectedTopic: null,
        sourceMetadata: expect.objectContaining({ audioFilePath: null }),
      }),
    );
    expect((ContextManager.updateThought as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteRetainedAudioFile.mock.invocationCallOrder[0],
    );
    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(retainedPath);
    addToQueueSpy.mockRestore();
  });

  it('rejects a duplicate retry while transcription is already running', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-double-tap.wav';
    const thought = {
      id: 'voice-retained-double-tap',
      noteId: 'voice-retained-double-tap',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceMetadata: { kind: 'voice', audioFilePath: retainedPath },
    };
    let finishTranscription: (result: TranscriptionResult) => void = () => undefined;
    mockTranscribeFile.mockReturnValue(new Promise(resolve => { finishTranscription = resolve; }));
    (ContextManager.readContext as jest.Mock).mockResolvedValue([{ header: 'Inbox', content: 'raw' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([thought]);
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-double-tap');

    const firstRetry = useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    });
    await Promise.resolve();
    await Promise.resolve();
    const duplicateRetry = await useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    });
    finishTranscription({ text: 'A recovered transcript.' });

    await expect(firstRetry).resolves.toBe(true);
    expect(duplicateRetry).toBe(false);
    expect(mockTranscribeFile).toHaveBeenCalledTimes(1);
    expect(addToQueueSpy).toHaveBeenCalledTimes(1);
    addToQueueSpy.mockRestore();
  });

  it('keeps the retained-audio pointer when cleanup fails after transcript persistence', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-cleanup-failure.wav';
    const thought = {
      id: 'voice-retained-cleanup-failure',
      noteId: 'voice-retained-cleanup-failure',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceMetadata: { kind: 'voice', audioFilePath: retainedPath },
    };
    (ContextManager.readContext as jest.Mock).mockResolvedValue([{ header: 'Inbox', content: 'raw' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([thought]);
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    mockTranscribeFile.mockResolvedValue({ text: 'Recovered speech.' });
    mockDeleteRetainedAudioFile.mockRejectedValueOnce(new Error('Storage busy'));
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-cleanup-failure');

    const retried = await useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    });

    expect(retried).toBe(false);
    expect(ContextManager.updateThought).toHaveBeenNthCalledWith(1, 'Inbox', thought.noteId, expect.objectContaining({
      text: 'Recovered speech.',
      sourceMetadata: expect.objectContaining({ transcript: 'Recovered speech.', audioFilePath: retainedPath }),
    }));
    expect(ContextManager.updateThought).toHaveBeenNthCalledWith(2, 'Inbox', thought.noteId, {
      sourceMetadata: { audioFilePath: null, transcriptionError: null },
    });
    expect(ContextManager.updateThought).toHaveBeenNthCalledWith(3, 'Inbox', thought.noteId, {
      sourceMetadata: { audioFilePath: retainedPath, transcriptionError: null },
    });
    expect(addToQueueSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().status).toContain('delete the retained recording before synthesis');
    addToQueueSpy.mockRestore();
  });

  it('refuses retained-audio retry while live capture is active', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    useAppStore.setState({ recordingState: 'recording', isRecording: true });

    const retried = await useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: 'voice-active-capture',
      thoughtText: 'Voice capture retained',
      audioFilePath: '/mock/path/retained-audio/contextengine-retained-active-capture.wav',
    });

    expect(retried).toBe(false);
    expect(mockTranscribeFile).not.toHaveBeenCalled();
    useAppStore.setState({ recordingState: 'idle', isRecording: false });
  });

  it('rejects retained-audio retry outside Inbox or when the stored path differs', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const retainedPath = '/mock/path/retained-audio/contextengine-retained-validation.wav';
    const thought = {
      id: 'voice-retained-validation',
      noteId: 'voice-retained-validation',
      sectionHeader: 'Inbox',
      text: 'Voice capture retained',
      sourceKind: 'voice',
      sourceMetadata: { kind: 'voice', audioFilePath: retainedPath },
    };
    (ContextManager.readContext as jest.Mock).mockResolvedValue([{ header: 'Inbox', content: 'raw' }]);
    (ContextManager.getInboxThoughts as jest.Mock).mockReturnValue([thought]);

    await expect(useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Ideas',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: retainedPath,
    })).resolves.toBe(false);
    await expect(useAppStore.getState().retranscribeRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: thought.noteId,
      thoughtText: thought.text,
      audioFilePath: `${retainedPath}.other`,
    })).resolves.toBe(false);

    expect(mockTranscribeFile).not.toHaveBeenCalled();
    expect(ContextManager.updateThought).not.toHaveBeenCalled();
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
  });

  it('deletes a confirmed unsynthesized Inbox note and cancels its pending queue work', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const removePendingSpy = jest.spyOn(ProcessingQueueManager, 'removePendingThoughtsByNoteId').mockReturnValue({
      removedCount: 1,
      blockedByActive: false,
    });
    (ContextManager.removeThought as jest.Mock).mockResolvedValueOnce(true);
    (ContextManager.readContext as jest.Mock).mockResolvedValueOnce([]);

    const deleted = await useAppStore.getState().deleteUnsynthesizedNote({
      sectionHeader: 'Inbox',
      noteId: 'note-delete-1',
      thoughtText: 'Delete this raw thought',
    });

    expect(deleted).toBe(true);
    expect(removePendingSpy).toHaveBeenCalledWith('note-delete-1');
    expect(ContextManager.removeThought).toHaveBeenCalledWith(
      'Inbox',
      'Delete this raw thought',
      'note-delete-1',
    );
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().status).toBe('Unsynthesized note deleted');

    removePendingSpy.mockRestore();
  });

  it('refuses to delete a persisted note while matching synthesis work is active', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const removePendingSpy = jest.spyOn(ProcessingQueueManager, 'removePendingThoughtsByNoteId').mockReturnValue({
      removedCount: 0,
      blockedByActive: true,
    });

    const deleted = await useAppStore.getState().deleteUnsynthesizedNote({
      sectionHeader: 'Inbox',
      noteId: 'note-active',
      thoughtText: 'Currently processing',
    });

    expect(deleted).toBe(false);
    expect(ContextManager.removeThought).not.toHaveBeenCalled();
    expect(useAppStore.getState().status).toBe('Wait for this note to finish processing before deleting it');

    removePendingSpy.mockRestore();
  });

  it('deletes app-owned retained audio with its Inbox note but never deletes imported audio', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const removePendingSpy = jest.spyOn(ProcessingQueueManager, 'removePendingThoughtsByNoteId').mockReturnValue({
      removedCount: 0,
      blockedByActive: false,
    });
    (ContextManager.removeThought as jest.Mock).mockResolvedValue(true);
    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);

    await useAppStore.getState().deleteUnsynthesizedNote({
      sectionHeader: 'Inbox',
      noteId: 'voice-retained',
      thoughtText: 'Voice capture retained',
      audioFilePath: '/mock/path/retained-audio/contextengine-retained-owned.wav',
    });
    await useAppStore.getState().deleteUnsynthesizedNote({
      sectionHeader: 'Inbox',
      noteId: 'voice-imported',
      thoughtText: 'Imported voice transcript',
      audioFilePath: '/tmp/user-selected-import.m4a',
    });

    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledTimes(1);
    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(
      '/mock/path/retained-audio/contextengine-retained-owned.wav',
    );
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalledWith('/tmp/user-selected-import.m4a');

    removePendingSpy.mockRestore();
  });

  it('removes retained-audio metadata only through the guarded audio deletion action', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    (ContextManager.updateThought as jest.Mock).mockResolvedValueOnce(true);
    (ContextManager.readContext as jest.Mock).mockResolvedValueOnce([]);

    const deleted = await useAppStore.getState().deleteRetainedAudioFromNote({
      sectionHeader: 'Inbox',
      noteId: 'voice-retained',
      thoughtText: 'Voice capture retained',
      audioFilePath: '/mock/path/retained-audio/contextengine-retained-owned.wav',
    });

    expect(deleted).toBe(true);
    expect(ContextManager.updateThought).toHaveBeenCalledWith('Inbox', 'voice-retained', {
      sourceMetadata: { audioFilePath: null, transcriptionError: null },
    });
    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(
      '/mock/path/retained-audio/contextengine-retained-owned.wav',
    );
  });

  it('allows cleanup of an app-owned temporary recording but rejects unrelated files', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);

    const temporaryPath = '/mock/cache/contextengine-retained-temporary.wav';
    await expect(useAppStore.getState().deleteRetainedAudioFromNote({
      sectionHeader: 'Inbox', noteId: 'temporary-note', thoughtText: 'Voice capture retained', audioFilePath: temporaryPath,
    })).resolves.toBe(true);
    await expect(useAppStore.getState().deleteRetainedAudioFromNote({
      sectionHeader: 'Inbox', noteId: 'imported-note', thoughtText: 'Imported clip', audioFilePath: '/tmp/user-selected.wav',
    })).resolves.toBe(false);

    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(temporaryPath);
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalledWith('/tmp/user-selected.wav');
  });

  it('keeps partial transcript and original audio in Inbox when stop reports a real error', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue');
    const audioFilePath = '/mock/path/retained-audio/contextengine-retained-partial.wav';
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);

    mockStopRecording.mockResolvedValue({
      text: 'buy milk',
      confidence: 1,
      error: 'non-fatal stream warning',
      audioFilePath,
    });

    useAppStore.setState({ recordingState: 'recording' });
    await useAppStore.getState().stopCapture();

    const state = useAppStore.getState();
    expect(state.recordingState).toBe('error');
    expect(state.status).toBe('Partial transcript saved in Inbox; non-fatal stream warning');
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Voice capture retained', expect.objectContaining({
      sourceKind: 'voice',
      sourceMetadata: expect.objectContaining({
        kind: 'voice',
        audioFilePath,
      }),
    }));
    expect(ContextManager.updateThought).toHaveBeenCalledWith('Inbox', expect.any(String), expect.objectContaining({
      text: 'buy milk',
      sourceMetadata: expect.objectContaining({ transcriptionError: 'non-fatal stream warning', audioFilePath }),
    }));
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
    expect(addToQueueSpy).not.toHaveBeenCalled();
    addToQueueSpy.mockRestore();
  });

  it('keeps audio in Inbox when transcription exceeds the UI timeout, then updates and queues the same note', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const audioFilePath = '/mock/path/retained-audio/contextengine-retained-long-capture.wav';
    let resolveTranscription: (result: TranscriptionResult) => void = () => undefined;
    let retainedCallbackFinished!: () => void;
    const retained = new Promise<void>(resolve => { retainedCallbackFinished = resolve; });
    const transcription = new Promise<TranscriptionResult>(resolve => {
      resolveTranscription = resolve;
    });
    mockStopRecording.mockImplementation(async onAudioRetained => {
      await onAudioRetained?.(audioFilePath);
      retainedCallbackFinished();
      return transcription;
    });
    (ContextManager.updateThought as jest.Mock).mockResolvedValue(true);
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue');
    const queued = new Promise<void>(resolve => {
      addToQueueSpy.mockImplementation(() => {
        resolve();
        return 'queued-long-capture';
      });
    });

    jest.useFakeTimers();
    useAppStore.setState({ recordingState: 'recording' });
    const stopPromise = useAppStore.getState().stopCapture();
    await retained;
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30000);
    await stopPromise;

    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Inbox',
      'Voice capture retained',
      expect.objectContaining({ sourceMetadata: expect.objectContaining({ audioFilePath }) }),
    );
    expect(useAppStore.getState().recordingState).toBe('transcribing');
    expect(useAppStore.getState().status).toBe('Audio saved in Inbox; transcription continues');

    jest.useRealTimers();
    resolveTranscription({ text: 'schedule project review for tomorrow at ten', audioFilePath });
    await queued;

    const noteId = expect.stringMatching(/^voice-retained-/);
    expect(ContextManager.updateThought).toHaveBeenNthCalledWith(1, 'Inbox', noteId, expect.objectContaining({
      text: 'schedule project review for tomorrow at ten',
      sourceMetadata: expect.objectContaining({
        transcript: 'schedule project review for tomorrow at ten',
        audioFilePath,
      }),
    }));
    expect(ContextManager.updateThought).toHaveBeenNthCalledWith(2, 'Inbox', noteId, {
      sourceMetadata: { audioFilePath: null, transcriptionError: null },
    });
    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(audioFilePath);
    const retainedNoteId = (ContextManager.updateThought as jest.Mock).mock.calls[0][1];
    expect(addToQueueSpy).toHaveBeenCalledTimes(1);
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'schedule project review for tomorrow at ten',
      'voice',
      expect.objectContaining({ noteId: retainedNoteId, thoughtText: 'schedule project review for tomorrow at ten' }),
      expect.objectContaining({ noteId: retainedNoteId, selectedTopic: null }),
    );
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('allows a new recording attempt from the error state for widget callers', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    useAppStore.setState({
      recordingState: 'error',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      pushToRecordEnabled: true,
    });

    await useAppStore.getState().startCapture();

    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().recordingState).toBe('recording');
    expect(useAppStore.getState().status).toBe('Listening...');
  });

  it('shows which microphone route the recording uses', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    mockGetCaptureInputLabel.mockReturnValue('Bluetooth headset microphone');
    useAppStore.setState({
      recordingState: 'idle',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      pushToRecordEnabled: true,
    });

    await useAppStore.getState().startCapture();

    expect(useAppStore.getState().recordingState).toBe('recording');
    expect(useAppStore.getState().status).toBe('Listening with Bluetooth headset microphone');
  });

  it('keeps recording available when Android notification access is denied and tells the user how to stop', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    mockRequestRecordingNotificationPermission.mockResolvedValue(false);
    useAppStore.setState({
      recordingState: 'idle',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      pushToRecordEnabled: true,
    });

    await useAppStore.getState().startCapture();

    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().recordingState).toBe('recording');
    expect(useAppStore.getState().status).toBe('Listening... · stop from app');
  });

  it('persists a retained WAV when Whisper returns an aborted result', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');

    mockStopRecording.mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
      audioFilePath: '/mock/cache/contextengine-retained-aborted.wav',
    });

    useAppStore.setState({ recordingState: 'recording' });
    await useAppStore.getState().stopCapture();

    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Voice capture retained', expect.objectContaining({
      noteId: expect.stringMatching(/^voice-retained-/),
      sourceKind: 'voice',
      sourceTranscript: 'Voice capture retained',
      sourceMetadata: expect.objectContaining({
        kind: 'voice',
        transcript: 'Voice capture retained',
        audioFilePath: '/mock/cache/contextengine-retained-aborted.wav',
      }),
    }));
    expect(useAppStore.getState().recordingState).toBe('error');
    expect(useAppStore.getState().status).toBe('Temporary audio saved in Inbox; durable storage failed');
  });

  it('keeps the WAV and writes an Inbox recovery note when transcript persistence fails', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    mockStopRecording.mockResolvedValue({
      text: 'buy milk tomorrow',
      audioFilePath: '/mock/path/retained-audio/contextengine-retained-abc-123.wav',
    });
    (ContextManager.appendThought as jest.Mock)
      .mockRejectedValueOnce(new Error('Inbox storage unavailable'))
      .mockResolvedValueOnce(undefined);

    useAppStore.setState({ recordingState: 'recording' });
    const result = await useAppStore.getState().stopCapture();

    expect(result?.text).toBe('buy milk tomorrow');
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(
      2,
      'Inbox',
      'Voice capture retained',
      expect.objectContaining({
        sourceKind: 'voice',
        sourceMetadata: expect.objectContaining({
          audioFilePath: '/mock/path/retained-audio/contextengine-retained-abc-123.wav',
        }),
      }),
    );
    expect(mockDeleteRetainedAudioFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().status).toBe('Audio retained in Inbox');
  });

  it('requires Push to Record before arming lock-screen headset capture', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    useAppStore.setState({
      pushToRecordEnabled: false,
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
    });

    await useAppStore.getState().setCaptureSetting('lockScreenHeadsetTriggerEnabled', true);
    await Promise.resolve();

    expect(mockRequestAudioPermissions).not.toHaveBeenCalled();
    expect(mockSetLockScreenHeadsetCaptureEnabled).not.toHaveBeenCalled();
    expect(useAppStore.getState().lockScreenHeadsetTriggerEnabled).toBe(false);
    expect(useAppStore.getState().status).toBe('Enable Push to Record first to use lock-screen capture');
  });

  it('does not arm lock-screen capture when its required permissions are denied', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    mockRequestLockScreenCapturePermissions.mockResolvedValue(false);
    useAppStore.setState({
      pushToRecordEnabled: true,
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
    });

    await useAppStore.getState().setCaptureSetting('lockScreenHeadsetTriggerEnabled', true);
    await Promise.resolve();

    expect(mockRequestLockScreenCapturePermissions).toHaveBeenCalledTimes(1);
    expect(mockSetLockScreenHeadsetCaptureEnabled).not.toHaveBeenCalled();
    expect(useAppStore.getState().lockScreenHeadsetTriggerEnabled).toBe(false);
    expect(useAppStore.getState().status).toBe('Allow the requested permissions to use lock-screen capture');
  });
});

// This store suite opts into every capability to cover the guarded behavior independently of the release platform.
jest.mock('../releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: {
    voiceCapture: true,
    voiceImport: true,
    assistantCapture: true,
    headsetTrigger: true,
    wakeWord: true,
  },
}));
