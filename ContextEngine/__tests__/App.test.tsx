/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
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

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
  });
});
