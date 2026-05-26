import type { RecordingState } from './captureTypes';
import type { AudioReadiness } from '../../modules/AudioEngine';

export function selectCanRecord({
  pushToRecordEnabled,
  audioReadiness,
}: {
  pushToRecordEnabled: boolean;
  audioReadiness: AudioReadiness;
}) {
  return pushToRecordEnabled && audioReadiness.transcriptionReady;
}

export function selectVoiceLabel({
  canRecord,
  recordingState,
}: {
  canRecord: boolean;
  recordingState: RecordingState;
}) {
  switch (recordingState) {
    case 'starting':
      return 'Starting Recording';
    case 'recording':
      return 'Stop Recording';
    case 'stopping':
      return 'Stopping Recording';
    case 'transcribing':
      return 'Transcribing Audio';
    case 'error':
      return canRecord ? 'Retry Recording' : 'Voice Off';
    default:
      return canRecord ? 'Start Recording' : 'Voice Off';
  }
}
