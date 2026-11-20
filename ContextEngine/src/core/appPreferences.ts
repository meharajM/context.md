import RNFS from 'react-native-fs';

import { SENSIBLE_DEFAULT_MODEL_ID, SYNTHESIS_MODEL_CATALOG } from '../modules/SynthesisEngine/models';
import { RELEASE_CAPABILITIES } from './releaseCapabilities';

export type MeetingRetention = '5m' | '1h' | '1d' | 'keep';

export interface AppPreferences {
  liteRtEnabled: boolean;
  selectedModelId: string;
  modelSelectionIsAutomatic: boolean;
  manualCaptureEnabled: boolean;
  pushToRecordEnabled: boolean;
  meetingAudioRetention: MeetingRetention;
}

interface StoredPreferences extends AppPreferences {
  version: 5;
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
      if ((value?.version === 1 || value?.version === 2 || value?.version === 3 || value?.version === 4 || value?.version === 5) && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
        typeof value.liteRtEnabled === 'boolean' &&
        SYNTHESIS_MODEL_CATALOG.some(model => model.id === value.selectedModelId)) {
        const manualCaptureEnabled = value.version === 1 ? true : value.manualCaptureEnabled;
        const pushToRecordEnabled = value.version === 1 ? RELEASE_CAPABILITIES.voiceCapture : value.pushToRecordEnabled;
        const meetingAudioRetention = ['5m', '1h', '1d', 'keep'].includes(value.meetingAudioRetention)
          ? value.meetingAudioRetention
          : '5m';
        const modelSelectionIsAutomatic = value.version === 5
          ? value.modelSelectionIsAutomatic
          : value.selectedModelId === SENSIBLE_DEFAULT_MODEL_ID ||
            SYNTHESIS_MODEL_CATALOG.find(model => model.id === value.selectedModelId)?.supportsAudio === true;
        if (typeof manualCaptureEnabled === 'boolean' && typeof pushToRecordEnabled === 'boolean') {
          if (typeof modelSelectionIsAutomatic === 'boolean') records.push({
            version: 5,
            revision: value.revision,
            liteRtEnabled: value.liteRtEnabled,
            selectedModelId: value.selectedModelId,
            modelSelectionIsAutomatic,
            manualCaptureEnabled,
            pushToRecordEnabled: pushToRecordEnabled && RELEASE_CAPABILITIES.voiceCapture,
            meetingAudioRetention,
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
    modelSelectionIsAutomatic: saved.modelSelectionIsAutomatic,
    manualCaptureEnabled: saved.manualCaptureEnabled,
    pushToRecordEnabled: saved.pushToRecordEnabled,
    meetingAudioRetention: saved.meetingAudioRetention,
  } : null;
}

export function saveAppPreferences(preferences: AppPreferences): Promise<void> {
  const result = writes.then(async () => {
    const previous = await readLatest().catch(() => null);
    const revision = (previous?.revision ?? -1) + 1;
    await RNFS.mkdir(DIRECTORY);
    // Alternate slots so a partial write never truncates the last good choice.
    await RNFS.writeFile(paths[revision % 2], JSON.stringify({ version: 5, revision, ...preferences }), 'utf8');
  });
  writes = result.catch(() => undefined);
  return result;
}
