jest.mock('../../../shared/utils/permissions', () => ({
  requestAudioPermissions: jest.fn(),
}));

jest.mock('../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter', () => ({
  AudioPcmStreamAdapter: jest.fn(),
}));

jest.mock('../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter', () => ({
  WavFileWriter: jest.fn(),
}));

jest.mock('../../../../node_modules/whisper.rn/lib/module/index', () => ({
  initWhisper: jest.fn(),
}));

jest.mock('../../../modules/ContextManager', () => ({
  ContextManager: {
    appendThought: jest.fn(async () => undefined),
    readContext: jest.fn(async () => []),
    getInboxThoughts: jest.fn(() => []),
    updateThought: jest.fn(async () => true),
  },
}));

import { requestAudioPermissions } from '../../../shared/utils/permissions';
import { useAppStore } from '../../../core/store';
import { ContextManager } from '../../../modules/ContextManager';
import { AudioEngineImpl } from '../AudioEngineImpl';

const EMPTY_AUDIO_READINESS = {
  transcriptionReady: false,
  wakeWordReady: false,
  missingModels: [],
  errors: [],
};

describe('audio capture store gating', () => {
  let startRecordingSpy: jest.SpyInstance;
  let stopRecordingSpy: jest.SpyInstance;
  let initializeModelsSpy: jest.SpyInstance;
  let addThoughtMock: jest.Mock;

  beforeEach(() => {
    jest.useRealTimers();
    initializeModelsSpy = jest.spyOn(AudioEngineImpl.prototype, 'initializeModels').mockResolvedValue({
      ...EMPTY_AUDIO_READINESS,
      transcriptionReady: false,
    });
    startRecordingSpy = jest.spyOn(AudioEngineImpl.prototype, 'startRecording').mockResolvedValue(undefined);
    stopRecordingSpy = jest.spyOn(AudioEngineImpl.prototype, 'stopRecording').mockResolvedValue({
      text: '',
      confidence: 0,
    });
    addThoughtMock = jest.fn(async () => undefined);

    useAppStore.setState({
      sections: [],
      isRecording: false,
      recordingState: 'idle',
      status: 'Idle',
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
      addThought: addThoughtMock,
    });

    (requestAudioPermissions as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    initializeModelsSpy.mockRestore();
    startRecordingSpy.mockRestore();
    stopRecordingSpy.mockRestore();
    jest.useRealTimers();
  });

  it('blocks record capture when transcription is unavailable', async () => {
    await useAppStore.getState().startCapture();

    expect(useAppStore.getState().recordingState).toBe('idle');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Recording unavailable');
    expect(startRecordingSpy).not.toHaveBeenCalled();
  });

  it('rejects wake-word enablement when wake-word readiness is false', () => {
    useAppStore.getState().setCaptureSetting('wakeWordEnabled', true);

    expect(useAppStore.getState().wakeWordEnabled).toBe(false);
    expect(useAppStore.getState().status).toBe('Wake word unavailable');
  });

  it('requests microphone permission before starting capture', async () => {
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    (requestAudioPermissions as jest.Mock).mockResolvedValue(false);

    await useAppStore.getState().startCapture();

    expect(requestAudioPermissions).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().recordingState).toBe('idle');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Microphone access needed');
  });

  it('moves through starting and recording states on successful capture start', async () => {
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });

    await useAppStore.getState().startCapture();

    expect(startRecordingSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().recordingState).toBe('recording');
    expect(useAppStore.getState().isRecording).toBe(true);
    expect(useAppStore.getState().status).toBe('Listening...');
  });

  it('captures start failures as an error state', async () => {
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    startRecordingSpy.mockRejectedValueOnce(new Error('native start failed'));

    await useAppStore.getState().startCapture();

    expect(useAppStore.getState().recordingState).toBe('error');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Mic Error: native start failed');
  });

  it('stops capture, persists the transcript, and returns to idle', async () => {
    const { ProcessingQueueManager } = require('../../../modules/SynthesisEngine/ProcessingQueueManager') as typeof import('../../../modules/SynthesisEngine/ProcessingQueueManager');
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

    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    stopRecordingSpy.mockResolvedValueOnce({ text: 'hello world', confidence: 1 });

    await useAppStore.getState().startCapture();
    await useAppStore.getState().stopCapture();

    expect(stopRecordingSpy).toHaveBeenCalledTimes(1);
    expect(addThoughtMock).not.toHaveBeenCalled();
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'hello world', expect.objectContaining({
      sourceKind: 'voice',
      sourceTranscript: 'hello world',
    }));
    expect(addToQueueSpy).toHaveBeenCalledWith(
      'hello world',
      'voice',
      expect.objectContaining({
        sectionHeader: 'Inbox',
        thoughtText: 'hello world',
        noteId: expect.any(String),
      }),
      expect.objectContaining({
        noteId: expect.any(String),
        selectedTopic: null,
      }),
    );
    expect(useAppStore.getState().recordingState).toBe('idle');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Voice note queued');

    addToQueueSpy.mockRestore();
  });

  it('persists retained audio failures instead of labeling them as no speech', async () => {
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    stopRecordingSpy.mockResolvedValueOnce({
      text: '',
      confidence: 0,
      error: 'native transcription failed',
      audioFilePath: '/tmp/contextengine-voice.wav',
    });

    await useAppStore.getState().startCapture();
    await useAppStore.getState().stopCapture();

    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Voice capture retained', {
      sourceKind: 'voice',
      sourceMetadata: {
        audioFilePath: '/tmp/contextengine-voice.wav',
      },
    });
    expect(useAppStore.getState().recordingState).toBe('error');
    expect(useAppStore.getState().status).toBe('Audio retained in Inbox');
  });

  it('returns to idle without queuing empty speech', async () => {
    jest.useFakeTimers();
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    stopRecordingSpy.mockResolvedValueOnce({ text: '', confidence: 0 });

    await useAppStore.getState().startCapture();
    await useAppStore.getState().stopCapture();
    await jest.advanceTimersByTimeAsync(2000);

    expect(addThoughtMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().recordingState).toBe('idle');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Idle');
  });

  it('surfaces stop failures as an error state', async () => {
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    stopRecordingSpy.mockRejectedValueOnce(new Error('native stop failed'));

    await useAppStore.getState().startCapture();
    await useAppStore.getState().stopCapture();

    expect(addThoughtMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().recordingState).toBe('error');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Process Error: native stop failed');
  });

  it('times out a hanging stop and clears the busy state', async () => {
    jest.useFakeTimers();
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    stopRecordingSpy.mockImplementationOnce(
      () => new Promise(() => undefined) as Promise<{ text: string; confidence: number }>,
    );

    await useAppStore.getState().startCapture();
    const stopPromise = useAppStore.getState().stopCapture();
    await jest.advanceTimersByTimeAsync(30000);
    await stopPromise;

    expect(addThoughtMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().recordingState).toBe('error');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Process Error: Capture stop timed out');
  });
});
