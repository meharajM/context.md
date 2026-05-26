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
  isRecording,
}: {
  canRecord: boolean;
  isRecording: boolean;
}) {
  if (isRecording) {
    return 'Listening';
  }

  return canRecord ? 'Voice ready' : 'Voice off';
}
