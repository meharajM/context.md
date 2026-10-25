import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Platform } from 'react-native';

import { CaptureModesSection } from '../CaptureModesSection';

jest.mock('../../../core/releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: {
    voiceCapture: true,
    voiceImport: false,
    assistantCapture: false,
    headsetTrigger: false,
    wakeWord: false,
  },
}));

describe('Android headset capture settings', () => {
  it('keeps on-demand recording available and hides unverified headset triggers', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureModesSection
          audioReadiness={{ transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] }}
          transcriptionProbeStatus="Idle"
          runTranscriptionProbe={jest.fn()}
          liteRtEnabled
          manualCaptureEnabled
          pushToRecordEnabled
          wakeWordEnabled={false}
          lockScreenHeadsetTriggerEnabled={false}
          recordingState="idle"
          setCaptureSetting={jest.fn()}
        />,
      );
    });

    expect(renderer!.root.findAllByProps({ testID: 'switch_record' }).length).toBeGreaterThan(0);
    expect(renderer!.root.findByProps({ testID: 'switch_record' }).props.description)
      .toContain('manage access in Android Settings');
    expect(renderer!.root.findAllByProps({ testID: 'switch_lockscreen_trigger' })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ testID: 'switch_wakeword' })).toHaveLength(0);
    ReactTestRenderer.act(() => renderer!.unmount());
  });
});
