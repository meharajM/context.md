import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
// eslint-disable-next-line @react-native/no-deep-imports
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';

import { CaptureComposerContainer } from '../../features/capture/CaptureComposerContainer';
import { CaptureModesSection } from '../../features/settings/CaptureModesSection';
import { ReflectionsScreen } from '../../features/reflections/ReflectionsScreen';
import { ImportScreen } from '../../features/import/ImportScreen';
import { useAssistantIntentCapture } from '../../shared/hooks/useAssistantIntentCapture';
import { useHeadsetTripleTapCapture } from '../../shared/hooks/useHeadsetTripleTapCapture';
import { useAppStore } from '../../core/store';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';

describe('platform release surfaces', () => {
  it('keeps typing available and shows only the voice features supported by this platform', async () => {
    const state = useAppStore.getState();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<>
        <CaptureComposerContainer />
        <CaptureModesSection {...state} transcriptionProbeStatus={state.status} />
        <ImportScreen />
        <ReflectionsScreen threads={[]} canRecord={false} onOpenThread={() => undefined} />
      </>);
    });
    for (const testID of ['thought_input', 'switch_manual', 'switch_litert', 'import_text_input']) {
      expect(renderer!.root.findAll(node => node.props?.testID === testID).length).toBeGreaterThan(0);
    }
    for (const testID of ['switch_wakeword', 'switch_lockscreen_trigger', 'import_source_voice_button', 'import_voice_pick_button']) {
      expect(renderer!.root.findAll(node => node.props?.testID === testID)).toHaveLength(0);
    }
    const recordButtons = renderer!.root.findAll(node => node.props?.testID === 'record_button');
    const recordSettings = renderer!.root.findAll(node => node.props?.testID === 'switch_record');
    if (RELEASE_CAPABILITIES.voiceCapture) {
      expect(recordButtons.length).toBeGreaterThan(0);
      expect(recordSettings.length).toBeGreaterThan(0);
    } else {
      expect(recordButtons).toHaveLength(0);
      expect(recordSettings).toHaveLength(0);
    }
    expect(renderer!.root.findByProps({ testID: 'thought_input' }).props.editable).toBe(true);
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('does not subscribe to the deferred headset event in the v1 release', async () => {
    (NativeEventEmitter as unknown as jest.Mock).mockClear();
    function Harness() {
      useAssistantIntentCapture();
      useHeadsetTripleTapCapture();
      return null;
    }
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    expect(NativeEventEmitter).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer!.unmount());
  });
});
