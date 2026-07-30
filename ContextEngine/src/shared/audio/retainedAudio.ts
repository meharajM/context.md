import RNFS from 'react-native-fs';

const RETAINED_AUDIO_FILENAME_PATTERN = /^contextengine-retained-[a-z0-9-]+\.wav$/i;

export const RETAINED_AUDIO_DIRECTORY = `${RNFS.DocumentDirectoryPath.replace(/\/+$/, '')}/retained-audio`;

export const normalizeLocalAudioPath = (filePath: string): string =>
  filePath.trim().replace(/^file:\/\//i, '');

export const isAppOwnedRetainedAudioPath = (filePath?: string | null): filePath is string => {
  if (!filePath?.trim()) {
    return false;
  }

  const normalizedPath = normalizeLocalAudioPath(filePath);
  const retainedPrefix = `${RETAINED_AUDIO_DIRECTORY}/`;
  if (!normalizedPath.startsWith(retainedPrefix)) {
    return false;
  }

  const filename = normalizedPath.slice(retainedPrefix.length);
  return !filename.includes('/') && RETAINED_AUDIO_FILENAME_PATTERN.test(filename);
};
