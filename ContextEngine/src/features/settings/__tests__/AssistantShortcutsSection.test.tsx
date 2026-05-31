import React from 'react';
import { Linking } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { AssistantShortcutsSection } from '../AssistantShortcutsSection';

describe('AssistantShortcutsSection', () => {
  it('renders the assistant setup guidance', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AssistantShortcutsSection />);
    });

    expect(renderer!.root.findAllByProps({ children: 'Assistant shortcuts' }).length).toBeGreaterThan(0);
    expect(renderer!.root.findAllByProps({ children: 'Capture with Siri or Shortcuts' }).length).toBeGreaterThan(0);
    expect(renderer!.root.findAllByProps({ children: 'Open Shortcuts' }).length).toBeGreaterThan(0);
  });

  it('opens the Shortcuts surface from the setup button', async () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AssistantShortcutsSection />);
    });

    const button = renderer!.root.find(node => node.props.label === 'Open Shortcuts');

    await ReactTestRenderer.act(async () => {
      button.props.onPress();
    });

    expect(openUrlSpy).toHaveBeenCalledWith('shortcuts://');
    openUrlSpy.mockRestore();
  });
});
