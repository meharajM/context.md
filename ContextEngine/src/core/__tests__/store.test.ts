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
const mockTranscribeFile = jest.fn(async () => ({ text: '', confidence: 0 }));
const mockDeleteRetainedAudioFile = jest.fn(async () => true);

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
    transcribeFile: mockTranscribeFile,
    deleteRetainedAudioFile: mockDeleteRetainedAudioFile,
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
    updateThought: jest.fn(),
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    mockStopRecording.mockResolvedValue({ text: '', confidence: 0 });
    mockDeleteRetainedAudioFile.mockResolvedValue(true);
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
      undefined,
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
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'finish the report',
      'text',
      undefined,
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
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'Voice import transcript.',
      'voice',
      undefined,
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
      sourceMetadata: { audioFilePath: null },
    });
    expect(mockDeleteRetainedAudioFile).toHaveBeenCalledWith(
      '/mock/path/retained-audio/contextengine-retained-owned.wav',
    );
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
      clarification: null,
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

  it('persists a retained WAV when Whisper returns an aborted result', async () => {
    const { useAppStore } = require('../store') as typeof import('../store');
    const { ContextManager } = require('../../modules/ContextManager') as typeof import('../../modules/ContextManager');

    mockStopRecording.mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
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
