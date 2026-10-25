import type { AudioReadiness } from '../../modules/AudioEngine';
import type { SettingsViewModel } from './settingsTypes';

export function selectSettingsViewModel({
  audioReadiness,
  liteRtEnabled,
  selectedModelInstalled,
  sectionCount,
}: {
  audioReadiness: AudioReadiness;
  liteRtEnabled: boolean;
  selectedModelInstalled: boolean;
  contextPath: string;
  sectionCount: number;
}): SettingsViewModel {
  let audioValue = 'Ready to turn speech into text';
  if (!audioReadiness.transcriptionReady) {
    audioValue = "Voice notes aren't ready yet";
  }
  const audioStatus = audioReadiness.transcriptionReady ? 'good' : 'warning';

  let modelValue = 'Ready to organize notes';
  let modelStatus: 'good' | 'warning' | 'error' = 'good';

  if (!liteRtEnabled) {
    modelValue = 'Off · new notes stay in Inbox';
    modelStatus = 'warning';
  } else if (!selectedModelInstalled) {
    modelValue = 'Download needed';
    modelStatus = 'warning';
  }

  const storageValue = `${sectionCount} saved on this phone`;

  return {
    audioStatus: {
      label: 'Voice notes',
      value: audioValue,
      status: audioStatus,
    },
    modelStatus: {
      label: 'Writing assistant',
      value: modelValue,
      status: modelStatus,
    },
    storageStatus: {
      label: 'Topics',
      value: storageValue,
      status: 'good',
    },
  };
}
