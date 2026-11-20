import type { AudioReadiness } from './index';

export function getVoiceSetupState(
  readiness: AudioReadiness,
  setupError: string | null,
  downloading: boolean,
  platform: string,
) {
  const error = setupError ?? (downloading ? null : readiness.errors[0] ?? (
    platform === 'ios' && !readiness.transcriptionReady && readiness.missingModels.some(model => model.toLowerCase().includes('gemma'))
      ? 'Install Gemma 3n E2B from the Writing helper to enable voice transcription.'
      : platform === 'ios' && !readiness.transcriptionReady && readiness.missingModels.some(model => model.toLowerCase().includes('whisper'))
        ? 'The lightweight Whisper voice model is missing. Retry its download to enable voice transcription.'
      : null
  ));
  return {
    error,
    loading: downloading || (!readiness.transcriptionReady && error === null),
  };
}
