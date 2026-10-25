import { NativeModules } from 'react-native';

export interface VoiceFileSelection {
  path: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

interface VoiceFilePickerNativeModule {
  pickVoiceFile: () => Promise<VoiceFileSelection>;
  exportBackup: (content: string) => Promise<boolean>;
  pickBackupFile: () => Promise<{ content: string; name: string; size: number } | null>;
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

export const exportLibraryBackupFile = async (content: string): Promise<boolean> => {
  if (!VoiceFilePickerModule?.exportBackup) {
    throw new Error('Backup export is unavailable on this device');
  }
  return VoiceFilePickerModule.exportBackup(content);
};

export const pickLibraryBackupFile = async (): Promise<{ content: string; name: string; size: number } | null> => {
  if (!VoiceFilePickerModule?.pickBackupFile) {
    throw new Error('Backup import is unavailable on this device');
  }
  return VoiceFilePickerModule.pickBackupFile();
};
