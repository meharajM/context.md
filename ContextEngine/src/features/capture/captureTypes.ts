export type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'transcribing' | 'error';

export interface CaptureComposerViewProps {
  value: string;
  canType: boolean;
  canRecord: boolean;
  recordingState: RecordingState;
  onChangeValue: (value: string) => void;
  onRecordPress: () => void;
  onSavePress: () => void;
}
