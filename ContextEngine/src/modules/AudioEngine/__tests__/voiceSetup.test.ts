import { getVoiceSetupState } from '../voiceSetup';

const readiness = {
  transcriptionReady: false,
  wakeWordReady: false,
  missingModels: [],
  errors: [],
};

describe('getVoiceSetupState', () => {
  it('shows iOS bundled model initialization as loading', () => {
    expect(getVoiceSetupState(readiness, null, false, 'ios')).toEqual({ error: null, loading: true });
  });

  it('shows an iOS bundled model error as retryable', () => {
    expect(getVoiceSetupState({ ...readiness, missingModels: ['whisper-tiny.en.bin'] }, null, false, 'ios'))
      .toEqual({ error: 'The bundled voice model is missing.', loading: false });
  });

  it('keeps stale readiness errors out of an active download', () => {
    expect(getVoiceSetupState({ ...readiness, errors: ['previous initialization failed'] }, null, true, 'android'))
      .toEqual({ error: null, loading: true });
  });
});
