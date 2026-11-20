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
      .toEqual({ error: 'Install Gemma 3n E2B from the Writing helper to enable voice transcription.', loading: false });
  });

  it('explains the lightweight iOS transcription download', () => {
    expect(getVoiceSetupState({ ...readiness, missingModels: ['Whisper tiny.en'] }, null, false, 'ios'))
      .toEqual({ error: 'The lightweight Whisper voice model is missing. Retry its download to enable voice transcription.', loading: false });
  });

  it('keeps stale readiness errors out of an active download', () => {
    expect(getVoiceSetupState({ ...readiness, errors: ['previous initialization failed'] }, null, true, 'android'))
      .toEqual({ error: null, loading: true });
  });
});
