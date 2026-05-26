jest.mock('../../../shared/utils/permissions', () => ({
  requestAudioPermissions: jest.fn(),
}));

import { requestAudioPermissions } from '../../../shared/utils/permissions';
import { useAppStore } from '../../../core/store';

const EMPTY_AUDIO_READINESS = {
  transcriptionReady: false,
  wakeWordReady: false,
  missingModels: [],
  errors: [],
};

describe('audio capture store gating', () => {
  beforeEach(() => {
    useAppStore.setState({
      sections: [],
      isRecording: false,
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
    });
    (requestAudioPermissions as jest.Mock).mockResolvedValue(true);
  });

  it('blocks record capture when transcription is unavailable', async () => {
    await useAppStore.getState().startCapture();

    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Recording unavailable');
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
    expect(useAppStore.getState().isRecording).toBe(false);
    expect(useAppStore.getState().status).toBe('Microphone access needed');
  });
});
