import type { AudioReadiness } from './index';

export function getVoiceSetupState(
  readiness: AudioReadiness,
  setupError: string | null,
  downloading: boolean,
  platform: string,
) {
  const error = setupError ?? (downloading ? null : readiness.errors[0] ?? (
    platform === 'ios' && !readiness.transcriptionReady && readiness.missingModels.some(model => model.toLowerCase().includes('gemma'))
      ? 'Select and install Gemma 3n E2B in Settings to enable voice transcription.'
      : null
  ));
  return {
    error,
    loading: downloading || (!readiness.transcriptionReady && error === null),
  };
}
