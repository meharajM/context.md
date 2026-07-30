import { NativeModules } from 'react-native';

export interface VoiceFileSelection {
  path: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

interface VoiceFilePickerNativeModule {
  pickVoiceFile: () => Promise<VoiceFileSelection>;
}

const { VoiceFilePickerModule } = NativeModules as {
  VoiceFilePickerModule?: VoiceFilePickerNativeModule;
};

export const VOICE_FILE_PICKER_CANCELLED = 'VOICE_PICKER_CANCELLED';

export const pickVoiceFile = async (): Promise<VoiceFileSelection> => {
  if (!VoiceFilePickerModule?.pickVoiceFile) {
    throw new Error('Voice file picker is unavailable on this device');
  }

  return VoiceFilePickerModule.pickVoiceFile();
};
