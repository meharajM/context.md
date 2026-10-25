import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NativeModules, Platform, Text } from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';

import { useQuickCaptureRequest } from '../useQuickCaptureRequest';
import { useAppStore } from '../../../core/store';

const originalStopCapture = useAppStore.getState().stopCapture;

describe('useQuickCaptureRequest', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    useAppStore.setState({ recordingState: 'idle', stopCapture: originalStopCapture });
    jest.clearAllMocks();
  });

  it('tracks the Type and Record actions from the Android widget', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const callbacks: Record<string, () => void> = {};
    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((name: string, callback: () => void) => {
        callbacks[name] = callback;
        return { remove: jest.fn() };
      }),
    }));

    function Harness() {
      const requests = useQuickCaptureRequest();
      return <Text testID="request">{`${requests.type}:${requests.record}`}</Text>;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => callbacks.QuickCaptureRequested?.());
    await ReactTestRenderer.act(async () => callbacks.QuickRecordRequested?.());

    expect(NativeEventEmitter).toHaveBeenCalledWith(NativeModules.EventEmitter);
    expect(renderer!.root.findByProps({ testID: 'request' }).props.children).toBe('1:1');
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('does not subscribe to the Android widget event on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    (NativeEventEmitter as unknown as jest.Mock).mockClear();

    function Harness() {
      useQuickCaptureRequest();
      return null;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    expect(NativeEventEmitter).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('routes the recording notification Stop action through store capture finalization', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const callbacks: Record<string, () => void> = {};
    const stopCapture = jest.fn(async () => undefined);
    useAppStore.setState({ recordingState: 'recording', stopCapture });
    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((name: string, callback: () => void) => {
        callbacks[name] = callback;
        return { remove: jest.fn() };
      }),
    }));

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<CaptureRequestHarness />);
    });
    await ReactTestRenderer.act(async () => callbacks.ActiveRecordingStopRequested?.());

    expect(stopCapture).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('holds a Stop request received during startup until recording is active', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const callbacks: Record<string, () => void> = {};
    const stopCapture = jest.fn(async () => undefined);
    useAppStore.setState({ recordingState: 'starting', stopCapture });
    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((name: string, callback: () => void) => {
        callbacks[name] = callback;
        return { remove: jest.fn() };
      }),
    }));

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<CaptureRequestHarness />);
    });
    await ReactTestRenderer.act(async () => callbacks.ActiveRecordingStopRequested?.());
    expect(stopCapture).not.toHaveBeenCalled();
    await ReactTestRenderer.act(async () => useAppStore.setState({ recordingState: 'recording' }));

    expect(stopCapture).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => renderer!.unmount());
  });
});

function CaptureRequestHarness() {
  const requests = useQuickCaptureRequest();
  return <Text testID="request">{`${requests.type}:${requests.record}`}</Text>;
}
