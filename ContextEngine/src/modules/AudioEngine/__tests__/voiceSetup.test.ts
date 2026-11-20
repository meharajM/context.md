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
    expect(getVoiceSetupState({ ...readiness, missingModels: ['Gemma 3n E2B'] }, null, false, 'ios'))
      .toEqual({ error: 'Select and install Gemma 3n E2B in Settings to enable voice transcription.', loading: false });
  });

  it('keeps stale readiness errors out of an active download', () => {
    expect(getVoiceSetupState({ ...readiness, errors: ['previous initialization failed'] }, null, true, 'android'))
      .toEqual({ error: null, loading: true });
  });
});
