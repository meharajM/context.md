import RNFS from 'react-native-fs';

import { loadAppPreferences, saveAppPreferences } from '../appPreferences';

describe('app preferences', () => {
  const files = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => files.has(path));
    (RNFS.readFile as jest.Mock).mockImplementation(async (path: string) => {
      const value = files.get(path);
      if (value === undefined) throw new Error('File not found');
      return value;
    });
    (RNFS.writeFile as jest.Mock).mockImplementation(async (path: string, value: string) => {
      files.set(path, value);
    });
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('saves and reloads assistant and model choices across module use', async () => {
    const saved = {
      liteRtEnabled: false,
      selectedModelId: 'gemma4-e2b-it',
      manualCaptureEnabled: false,
      pushToRecordEnabled: false,
      transcriptionLanguage: 'hi' as const,
    };
    await saveAppPreferences(saved);

    await expect(loadAppPreferences()).resolves.toEqual(saved);
  });

  it('migrates older assistant settings with capture modes enabled by default', async () => {
    files.set(`${RNFS.DocumentDirectoryPath}/setup/preferences-0.json`, JSON.stringify({
      version: 1,
      revision: 3,
      liteRtEnabled: false,
      selectedModelId: 'gemma3-1b-it',
    }));

    await expect(loadAppPreferences()).resolves.toEqual({
      liteRtEnabled: false,
      selectedModelId: 'gemma3-1b-it',
      manualCaptureEnabled: true,
      pushToRecordEnabled: true,
      transcriptionLanguage: 'en',
    });
  });

  it('keeps the last good slot when the newest write is interrupted', async () => {
    await saveAppPreferences({
      liteRtEnabled: true,
      selectedModelId: 'gemma3-1b-it',
      manualCaptureEnabled: true,
      pushToRecordEnabled: true,
      transcriptionLanguage: 'en',
    });
    const interruptedPath = `${RNFS.DocumentDirectoryPath}/setup/preferences-1.json`;
    files.set(interruptedPath, '{partial');

    await expect(loadAppPreferences()).resolves.toEqual({
      liteRtEnabled: true,
      selectedModelId: 'gemma3-1b-it',
      manualCaptureEnabled: true,
      pushToRecordEnabled: true,
      transcriptionLanguage: 'en',
    });
  });

  it('rejects when saved settings exist but neither slot is valid', async () => {
    files.set(`${RNFS.DocumentDirectoryPath}/setup/preferences-0.json`, '{partial');
    files.set(`${RNFS.DocumentDirectoryPath}/setup/preferences-1.json`, JSON.stringify({
      version: 1,
      revision: 4,
      liteRtEnabled: true,
      selectedModelId: 'unknown-model',
    }));

    await expect(loadAppPreferences()).rejects.toThrow('Saved assistant settings could not be read');
  });

  it('serializes concurrent saves and loads the final user choice', async () => {
    await Promise.all([
      saveAppPreferences({ liteRtEnabled: false, selectedModelId: 'gemma3-1b-it', manualCaptureEnabled: true, pushToRecordEnabled: true, transcriptionLanguage: 'en' }),
      saveAppPreferences({ liteRtEnabled: true, selectedModelId: 'gemma4-e2b-it', manualCaptureEnabled: true, pushToRecordEnabled: true, transcriptionLanguage: 'hi' }),
    ]);

    await expect(loadAppPreferences()).resolves.toEqual({
      liteRtEnabled: true,
      selectedModelId: 'gemma4-e2b-it',
      manualCaptureEnabled: true,
      pushToRecordEnabled: true,
      transcriptionLanguage: 'hi',
    });
  });
});
