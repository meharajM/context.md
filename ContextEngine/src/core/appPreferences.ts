import RNFS from 'react-native-fs';

import { SYNTHESIS_MODEL_CATALOG } from '../modules/SynthesisEngine/models';
import type { TranscriptionLanguage } from '../modules/AudioEngine/whisperModelManager';
import { RELEASE_CAPABILITIES } from './releaseCapabilities';

export interface AppPreferences {
  liteRtEnabled: boolean;
  selectedModelId: string;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  transcriptionLanguage: TranscriptionLanguage;
}

interface StoredPreferences extends AppPreferences {
  version: 3;
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
      if ((value?.version === 1 || value?.version === 2 || value?.version === 3) && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
        typeof value.liteRtEnabled === 'boolean' &&
        SYNTHESIS_MODEL_CATALOG.some(model => model.id === value.selectedModelId)) {
        const manualCaptureEnabled = value.version === 1 ? true : value.manualCaptureEnabled;
        const pushToRecordEnabled = value.version === 1 ? RELEASE_CAPABILITIES.voiceCapture : value.pushToRecordEnabled;
        if (typeof manualCaptureEnabled === 'boolean' && typeof pushToRecordEnabled === 'boolean') {
          records.push({
            version: 3,
            revision: value.revision,
            liteRtEnabled: value.liteRtEnabled,
            selectedModelId: value.selectedModelId,
            manualCaptureEnabled,
            pushToRecordEnabled: pushToRecordEnabled && RELEASE_CAPABILITIES.voiceCapture,
            transcriptionLanguage: value.transcriptionLanguage === 'hi' ? 'hi' : 'en',
          });
        }
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
  return saved ? {
    liteRtEnabled: saved.liteRtEnabled,
    selectedModelId: saved.selectedModelId,
    manualCaptureEnabled: saved.manualCaptureEnabled,
    pushToRecordEnabled: saved.pushToRecordEnabled,
    transcriptionLanguage: saved.transcriptionLanguage,
  } : null;
}

export function saveAppPreferences(preferences: AppPreferences): Promise<void> {
  const result = writes.then(async () => {
    const previous = await readLatest().catch(() => null);
    const revision = (previous?.revision ?? -1) + 1;
    await RNFS.mkdir(DIRECTORY);
    // Alternate slots so a partial write never truncates the last good choice.
    await RNFS.writeFile(paths[revision % 2], JSON.stringify({ version: 3, revision, ...preferences }), 'utf8');
  });
  writes = result.catch(() => undefined);
  return result;
}
