/**
 * @format
 */

import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import RNFS from 'react-native-fs';
import App from '../App';
import { useAppStore } from '../src/core/store';

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

describe('App', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    useAppStore.setState({
      sections: [],
      isRecording: false,
      status: 'Booting...',
      queueSize: 0,
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      lastQueueError: null,
      recordingState: 'idle',
      isInitialized: false,
      appIsActive: true,
      audioReadiness: {
        transcriptionReady: false,
        wakeWordReady: false,
        missingModels: [],
        errors: [],
      },
      manualCaptureEnabled: true,
      pushToRecordEnabled: true,
      wakeWordEnabled: false,
      liteRtEnabled: true,
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('renders a single shared composer on the first-time screen', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const inputs = renderer!.root.findAll(
      node => node.props.testID === 'thought_input' && typeof node.type === 'string',
    );
    const recordButtons = renderer!.root.findAll(
      node => node.props.testID === 'record_button' && typeof node.props.disabled === 'boolean',
    );

    expect(inputs).toHaveLength(1);
    expect(recordButtons.some(node => node.props.disabled === true)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('raises the composer above the keyboard when typing', async () => {
    const keyboardListeners: Record<string, (event: any) => void> = {};
    const removeListener = jest.fn();
    const keyboardSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, callback) => {
      keyboardListeners[eventName] = callback as (event: any) => void;
      return { remove: removeListener } as any;
    });
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });

    const composerShell = () => renderer!.root.find(node => node.props.testID === 'composer_shell');
    expect(StyleSheet.flatten(composerShell().props.style).bottom).toBe(76);

    await ReactTestRenderer.act(async () => {
      keyboardListeners.keyboardWillShow({
        endCoordinates: { height: 320 },
      });
    });

    expect(StyleSheet.flatten(composerShell().props.style).bottom).toBe(332);

    await ReactTestRenderer.act(async () => {
      keyboardListeners.keyboardWillHide({});
    });

    expect(StyleSheet.flatten(composerShell().props.style).bottom).toBe(76);

    keyboardSpy.mockRestore();
  });
});
