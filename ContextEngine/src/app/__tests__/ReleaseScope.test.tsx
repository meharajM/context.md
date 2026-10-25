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

describe('platform release surfaces', () => {
  it('keeps text entry and hides recording, audio settings and voice import', async () => {
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
    for (const testID of ['record_button', 'switch_record', 'switch_wakeword', 'switch_lockscreen_trigger', 'import_source_voice_button', 'import_voice_pick_button']) {
      expect(renderer!.root.findAll(node => node.props?.testID === testID)).toHaveLength(0);
    }
    expect(renderer!.root.findAllByProps({ children: 'Voice capture is off' })).toHaveLength(0);
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
