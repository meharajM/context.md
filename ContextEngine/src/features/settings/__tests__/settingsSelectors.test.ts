import { selectSettingsViewModel } from '../settingsSelectors';

describe('selectSettingsViewModel', () => {
  const mockAudioReadinessReady = {
    transcriptionReady: true,
    wakeWordReady: true,
    missingModels: [],
    errors: [],
  };

  const mockAudioReadinessMissing = {
    transcriptionReady: false,
    wakeWordReady: false,
    missingModels: ['whisper-tiny.en.bin'],
    errors: ['Model file missing'],
  };

  it('maps operational audio state correctly', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/path/to/context.md',
      sectionCount: 3,
    });

    expect(result.audioStatus).toEqual({
      label: 'Audio Subsystem',
      value: 'Operational (Whisper ready)',
      status: 'good',
    });
  });

  it('maps unavailable audio state correctly', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessMissing,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/path/to/context.md',
      sectionCount: 3,
    });

    expect(result.audioStatus).toEqual({
      label: 'Audio Subsystem',
      value: 'Unavailable (Model missing)',
      status: 'warning',
    });
  });

  it('maps model status when LiteRT is disabled', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: false,
      selectedModelInstalled: true,
      contextPath: '/path/to/context.md',
      sectionCount: 3,
    });

    expect(result.modelStatus).toEqual({
      label: 'Model Engine',
      value: 'Heuristics (Offline)',
      status: 'warning',
    });
  });

  it('maps model status when model is not downloaded', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: false,
      contextPath: '/path/to/context.md',
      sectionCount: 3,
    });

    expect(result.modelStatus).toEqual({
      label: 'Model Engine',
      value: 'Download Required',
      status: 'warning',
    });
  });

  it('maps storage status and counts correctly', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/Users/test/context.md',
      sectionCount: 5,
    });

    expect(result.storageStatus).toEqual({
      label: 'Storage',
      value: 'context.md (5 topics)',
      status: 'good',
    });
  });

  it('handles singular topic formatting in storage status', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/Users/test/my-personal-context.md',
      sectionCount: 1,
    });

    expect(result.storageStatus.value).toBe('my-personal-context.md (1 topic)');
  });
});
