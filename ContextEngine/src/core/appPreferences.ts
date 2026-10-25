import RNFS from 'react-native-fs';

import { SYNTHESIS_MODEL_CATALOG } from '../modules/SynthesisEngine/models';

export interface AppPreferences {
  liteRtEnabled: boolean;
  selectedModelId: string;
}

interface StoredPreferences extends AppPreferences {
  version: 1;
  revision: number;
}

const DIRECTORY = `${RNFS.DocumentDirectoryPath}/setup`;
const paths = [0, 1].map(slot => `${DIRECTORY}/preferences-${slot}.json`);
let writes: Promise<unknown> = Promise.resolve();

async function readLatest(): Promise<StoredPreferences | null> {
  const records: StoredPreferences[] = [];
  let foundFile = false;
  for (const path of paths) {
    if (!(await RNFS.exists(path))) continue;
    foundFile = true;
    try {
      const value = JSON.parse(await RNFS.readFile(path, 'utf8'));
      if (value?.version === 1 && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
        typeof value.liteRtEnabled === 'boolean' &&
        SYNTHESIS_MODEL_CATALOG.some(model => model.id === value.selectedModelId)) {
        records.push(value);
      }
    } catch {
      // The other slot remains authoritative after an interrupted write.
    }
  }
  if (!records.length && foundFile) throw new Error('Saved assistant settings could not be read');
  return records.sort((a, b) => b.revision - a.revision)[0] ?? null;
}

export async function loadAppPreferences(): Promise<AppPreferences | null> {
  await writes;
  const saved = await readLatest();
  return saved ? { liteRtEnabled: saved.liteRtEnabled, selectedModelId: saved.selectedModelId } : null;
}

export function saveAppPreferences(preferences: AppPreferences): Promise<void> {
  const result = writes.then(async () => {
    const previous = await readLatest().catch(() => null);
    const revision = (previous?.revision ?? -1) + 1;
    await RNFS.mkdir(DIRECTORY);
    // Alternate slots so a partial write never truncates the last good choice.
    await RNFS.writeFile(paths[revision % 2], JSON.stringify({ version: 1, revision, ...preferences }), 'utf8');
  });
  writes = result.catch(() => undefined);
  return result;
}
