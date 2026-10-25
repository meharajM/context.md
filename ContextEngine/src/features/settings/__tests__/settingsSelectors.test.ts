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
      contextPath: '/path/to/topics',
      sectionCount: 3,
    });

    expect(result.audioStatus).toEqual({
      label: 'Voice notes',
      value: 'Ready to turn speech into text',
      status: 'good',
    });
  });

  it('maps unavailable audio state correctly', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessMissing,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/path/to/topics',
      sectionCount: 3,
    });

    expect(result.audioStatus).toEqual({
      label: 'Voice notes',
      value: "Voice notes aren't ready yet",
      status: 'warning',
    });
  });

  it('maps model status when LiteRT is disabled', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: false,
      selectedModelInstalled: true,
      contextPath: '/path/to/topics',
      sectionCount: 3,
    });

    expect(result.modelStatus).toEqual({
      label: 'Writing assistant',
      value: 'Off · new notes stay in Inbox',
      status: 'warning',
    });
  });

  it('maps model status when model is not downloaded', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: false,
      contextPath: '/path/to/topics',
      sectionCount: 3,
    });

    expect(result.modelStatus).toEqual({
      label: 'Writing assistant',
      value: 'Download needed',
      status: 'warning',
    });
  });

  it('shows the writing assistant as available when enabled and installed', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady, liteRtEnabled: true, selectedModelInstalled: true,
      contextPath: '/path/to/topics', sectionCount: 1,
    });
    expect(result.modelStatus.value).toBe('Ready to organize notes');
    expect(result.modelStatus.status).toBe('good');
  });

  it('maps storage status and counts correctly', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/Users/test/topics',
      sectionCount: 5,
    });

    expect(result.storageStatus).toEqual({
      label: 'Topics',
      value: '5 saved on this phone',
      status: 'good',
    });
  });

  it('handles singular topic formatting in storage status', () => {
    const result = selectSettingsViewModel({
      audioReadiness: mockAudioReadinessReady,
      liteRtEnabled: true,
      selectedModelInstalled: true,
      contextPath: '/Users/test/my-topics',
      sectionCount: 1,
    });

    expect(result.storageStatus.value).toBe('1 saved on this phone');
  });
});
