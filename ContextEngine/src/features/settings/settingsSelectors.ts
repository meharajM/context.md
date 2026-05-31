import type { AudioReadiness } from '../../modules/AudioEngine';
import type { SettingsViewModel } from './settingsTypes';

export function selectSettingsViewModel({
  audioReadiness,
  liteRtEnabled,
  selectedModelInstalled,
  contextPath,
  sectionCount,
}: {
  audioReadiness: AudioReadiness;
  liteRtEnabled: boolean;
  selectedModelInstalled: boolean;
  contextPath: string;
  sectionCount: number;
}): SettingsViewModel {
  // 1. Audio Subsystem
  let audioValue = 'Operational (Whisper ready)';
  if (!audioReadiness.transcriptionReady) {
    audioValue = 'Unavailable (Model missing)';
  }
  const audioStatus = audioReadiness.transcriptionReady ? 'good' : 'warning';

  // 2. Model Engine
  let modelValue = 'Operational (LiteRT)';
  let modelStatus: 'good' | 'warning' | 'error' = 'good';

  if (!liteRtEnabled) {
    modelValue = 'Heuristics (Offline)';
    modelStatus = 'warning';
  } else if (!selectedModelInstalled) {
    modelValue = 'Download Required';
    modelStatus = 'warning';
  }

  // 3. Storage
  const filename = contextPath.split('/').pop() ?? 'context.md';
  const storageValue = `${filename} (${sectionCount} topic${sectionCount === 1 ? '' : 's'})`;

  return {
    audioStatus: {
      label: 'Audio Subsystem',
      value: audioValue,
      status: audioStatus,
    },
    modelStatus: {
      label: 'Model Engine',
      value: modelValue,
      status: modelStatus,
    },
    storageStatus: {
      label: 'Storage',
      value: storageValue,
      status: 'good',
    },
  };
}
