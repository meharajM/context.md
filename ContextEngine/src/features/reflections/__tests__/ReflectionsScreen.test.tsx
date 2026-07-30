import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { ReflectionsScreen } from '../ReflectionsScreen';

describe('ReflectionsScreen capture guidance', () => {
  it('shows actionable microphone guidance while preserving typed capture messaging', () => {
    const onOpenCaptureSettings = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={false}
          displayStatus="Microphone access needed"
          onOpenCaptureSettings={onOpenCaptureSettings}
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Microphone access needed' })).toBeTruthy();
    expect(
      renderer.root.findByProps({
        children: 'Allow microphone access in system Settings, then check Capture modes. Typed capture still works.',
      }),
    ).toBeTruthy();

    const settingsButton = renderer.root.find(
      node => node.props.testID === 'capture_settings_button' && node.props.accessibilityRole === 'button',
    );
    ReactTestRenderer.act(() => settingsButton.props.onPress());
    expect(onOpenCaptureSettings).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('surfaces recording errors instead of reporting voice as ready', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ReflectionsScreen
          threads={[]}
          canRecord={true}
          recordingState="error"
          displayStatus="Mic Error: recorder unavailable"
          onOpenThread={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Voice capture needs attention' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Mic Error: recorder unavailable' })).toBeTruthy();

    ReactTestRenderer.act(() => renderer.unmount());
  });
});
