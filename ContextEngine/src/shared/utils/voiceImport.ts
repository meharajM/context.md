import type { VoiceFileSelection } from './voiceFilePicker';

export const ALLOWED_VOICE_IMPORT_EXTENSIONS = ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'opus'] as const;

export const ALLOWED_VOICE_IMPORT_LABEL = '.m4a, .mp3, .wav, .aac, .ogg, .opus';

export const normalizeVoiceImportPath = (filePath: string): string =>
  filePath.trim().replace(/^file:\/\//i, '');

export const isSupportedVoiceImportPath = (filePath: string): boolean => {
  const normalized = normalizeVoiceImportPath(filePath).toLowerCase();
  const lastDot = normalized.lastIndexOf('.');
  const extension = lastDot >= 0 ? normalized.slice(lastDot + 1) : '';

  return ALLOWED_VOICE_IMPORT_EXTENSIONS.includes(extension as (typeof ALLOWED_VOICE_IMPORT_EXTENSIONS)[number]);
};

export const describeVoiceImportSource = (source: string | number | null | undefined): string => {
  if (typeof source === 'number') {
    return 'Bundled sample voice clip';
  }

  if (!source) {
    return 'No voice file selected';
  }

  const normalized = normalizeVoiceImportPath(source);
  const leaf = normalized.split(/[\\/]/).filter(Boolean).pop();
  return leaf ?? normalized;
};

export const toVoiceFilePath = (selection: VoiceFileSelection | string | number | null | undefined): string | number | null => {
  if (selection == null) {
    return null;
  }

  if (typeof selection === 'string' || typeof selection === 'number') {
    return selection;
  }

  return selection.path;
};
