export interface CaptureComposerViewProps {
  value: string;
  canType: boolean;
  canRecord: boolean;
  isRecording: boolean;
  onChangeValue: (value: string) => void;
  onRecordPress: () => void;
  onSavePress: () => void;
}
