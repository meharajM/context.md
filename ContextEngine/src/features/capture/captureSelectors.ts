import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import type { RecordingState } from './captureTypes';
import type { AudioReadiness } from '../../modules/AudioEngine';

export function selectCanRecord({
  pushToRecordEnabled,
  audioReadiness,
}: {
  pushToRecordEnabled: boolean;
  audioReadiness: AudioReadiness;
}) {
  return RELEASE_CAPABILITIES.voiceCapture && pushToRecordEnabled && audioReadiness.transcriptionReady;
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
      return 'Starting voice note';
    case 'recording':
      return 'Stop recording';
    case 'stopping':
      return 'Saving recording';
    case 'transcribing':
      return 'Getting words from recording';
    case 'error':
      return canRecord ? 'Try recording again' : 'Voice notes off';
    default:
      return canRecord ? 'Record a voice note' : 'Voice notes off';
  }
}
