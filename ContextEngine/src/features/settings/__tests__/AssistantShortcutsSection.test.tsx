import React from 'react';
import { Linking, Platform } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { AssistantShortcutsSection } from '../AssistantShortcutsSection';

describe('AssistantShortcutsSection', () => {
  it('renders the assistant setup guidance', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<AssistantShortcutsSection />);
    });

    expect(renderer!.root.findAllByProps({ children: 'Use your voice assistant' }).length).toBeGreaterThan(0);
    expect(
      renderer!.root.findAllByProps({
        children: Platform.OS === 'ios' ? 'Save notes with Siri' : 'Save notes with your voice assistant',
      }).length,
    ).toBeGreaterThan(0);
    if (Platform.OS === 'ios') {
      expect(renderer!.root.findAll(node => node.props.label === 'Open Shortcuts')).toHaveLength(1);
    }
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

  it('renders Google Assistant binding guidance on Android', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    let renderer: ReactTestRenderer.ReactTestRenderer;

    try {
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(<AssistantShortcutsSection />);
      });

      expect(renderer!.root.findAllByProps({ children: 'Save notes with your voice assistant' }).length).toBeGreaterThan(0);
      expect(
        renderer!.root.findAllByProps({
          children: '2. Say “Add [your note] to my context.”',
        }).length,
      ).toBeGreaterThan(0);
      expect(renderer!.root.findAll(node => node.props.label === 'Open Shortcuts')).toHaveLength(0);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });
});
