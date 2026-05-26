jest.mock('../../../shared/utils/permissions', () => ({
  requestAudioPermissions: jest.fn(),
}));

import { requestAudioPermissions } from '../../../shared/utils/permissions';
import { useAppStore } from '../../../core/store';
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
  let addThoughtMock: jest.Mock;

  beforeEach(() => {
    jest.useRealTimers();
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

  it('stops capture, queues the transcript, and returns to idle', async () => {
    useAppStore.setState({
      audioReadiness: { ...EMPTY_AUDIO_READINESS, transcriptionReady: true },
    });
    stopRecordingSpy.mockResolvedValueOnce({ text: 'hello world', confidence: 1 });

    await useAppStore.getState().startCapture();
    await useAppStore.getState().stopCapture();

    expect(stopRecordingSpy).toHaveBeenCalledTimes(1);
    expect(addThoughtMock).toHaveBeenCalledWith('hello world');
    expect(useAppStore.getState().recordingState).toBe('idle');
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Stored for later');
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
