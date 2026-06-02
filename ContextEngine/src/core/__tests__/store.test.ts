import RNFS from 'react-native-fs';
import type { TranscriptionResult } from '../../modules/AudioEngine';

const mockInitializeModels = jest.fn(async () => ({
  transcriptionReady: true,
  wakeWordReady: false,
  missingModels: [],
  errors: [],
}));
const mockStartRecording = jest.fn(async () => undefined);
const mockStopRecording = jest.fn<Promise<TranscriptionResult>, []>(async () => ({ text: '', confidence: 0 }));

const mockConfigure = jest.fn();
const mockInitialize = jest.fn(async () => ({
  available: true,
  status: 'ready',
  detail: 'LiteRT ready',
}));

jest.mock('../../modules/AudioEngine/AudioEngineImpl', () => ({
  AudioEngineImpl: jest.fn().mockImplementation(() => ({
    initializeModels: mockInitializeModels,
    stopWakeWordDetection: jest.fn(async () => undefined),
    startWakeWordDetection: jest.fn(async () => undefined),
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    transcribeFile: jest.fn(async () => ({ text: '', confidence: 0 })),
  })),
}));

jest.mock('../../modules/SynthesisEngine/SynthesisService', () => ({
  SynthesisService: {
    configure: mockConfigure,
    initialize: mockInitialize,
    synthesize: jest.fn(),
    getLiteRtReadiness: jest.fn(),
    resetForTests: jest.fn(),
  },
}));

jest.mock('../../modules/ContextManager', () => ({
  ContextManager: {
    setPath: jest.fn(),
    readContext: jest.fn(async () => []),
    appendThought: jest.fn(),
    getInboxThoughts: jest.fn(() => []),
    removeThought: jest.fn(),
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    mockStopRecording.mockResolvedValue({ text: '', confidence: 0 });
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    ProcessingQueueManager.resetForTests();
  });

  it('auto-queues Inbox synthesis silently during engine initialization when LiteRT is ready', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const queueInboxForSynthesis = jest.fn(async () => 2);

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
    storeState.queueInboxForSynthesis = queueInboxForSynthesis;

    await useAppStore.getState().initializeEngine();

    expect(mockInitializeModels).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(queueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(useAppStore.getState().status).toBe('Idle');
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

  it('persists and queues transcript when stop result has text even if error exists', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');
    const { ProcessingQueueManager } = require('../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../modules/SynthesisEngine/ProcessingQueueManager');
    const addToQueueSpy = jest.spyOn(ProcessingQueueManager, 'addToQueue').mockReturnValue('queued-1');
    jest.spyOn(ProcessingQueueManager, 'getState').mockReturnValue({
      pendingCount: 1,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
      blockedReason: null,
    });
    jest.spyOn(ProcessingQueueManager, 'getQueueSnapshot').mockReturnValue([]);

    mockStopRecording.mockResolvedValue({
      text: 'buy milk',
      confidence: 1,
      error: 'non-fatal stream warning',
      audioFilePath: '/tmp/voice.wav',
    });

    useAppStore.setState({ recordingState: 'recording' });
    await useAppStore.getState().stopCapture();

    const state = useAppStore.getState();
    expect(state.recordingState).toBe('idle');
    expect(state.status).toBe('Voice note queued');
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'buy milk', expect.objectContaining({
      sourceKind: 'voice',
      sourceTranscript: 'buy milk',
      sourceMetadata: expect.objectContaining({
        kind: 'voice',
        transcript: 'buy milk',
      }),
    }));
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'buy milk',
      'voice',
      expect.objectContaining({
        sectionHeader: 'Inbox',
        thoughtText: 'buy milk',
        noteId: expect.any(String),
      }),
      expect.objectContaining({
        noteId: expect.any(String),
        selectedTopic: null,
      }),
    );
  });

  it('keeps retained empty capture failures as explicit errors', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');

    mockStopRecording.mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'transcription produced no segments',
      audioFilePath: '/tmp/voice.wav',
    });

    useAppStore.setState({ recordingState: 'recording' });
    await useAppStore.getState().stopCapture();

    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Voice capture retained', {
      sourceKind: 'voice',
      sourceMetadata: {
        audioFilePath: '/tmp/voice.wav',
      },
    });
    expect(useAppStore.getState().recordingState).toBe('error');
    expect(useAppStore.getState().status).toBe('Audio retained in Inbox');
  });
});
