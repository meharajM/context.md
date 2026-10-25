export type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'transcribing' | 'error';

export interface CaptureComposerViewProps {
  focusRequest?: number;
  keyboardDismissRequest?: number;
  value: string;
  canType: boolean;
  canRecord: boolean;
  recordingState: RecordingState;
  recordingMessage?: string;
  onChangeValue: (value: string) => void;
  onRecordPress: () => void;
  onSavePress: () => void;
}
