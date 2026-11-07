import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
// eslint-disable-next-line @react-native/no-deep-imports
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';
import { NativeModules, Platform } from 'react-native';

import { runBackgroundSynthesisTask } from '../../../modules/BackgroundSynthesis/runBackgroundSynthesisTask';
import { useBackgroundSynthesisTask } from '../useBackgroundSynthesisTask';

jest.mock('../../../modules/BackgroundSynthesis/runBackgroundSynthesisTask', () => ({
  runBackgroundSynthesisTask: jest.fn(async () => undefined),
}));

describe('useBackgroundSynthesisTask', () => {
  const originalPlatform = Platform.OS;
  const nativeModule = NativeModules.EventEmitter as {
    takePendingBackgroundSynthesisRequest: jest.Mock;
  };

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    nativeModule.takePendingBackgroundSynthesisRequest.mockReset().mockResolvedValue(false);
    (runBackgroundSynthesisTask as jest.Mock).mockClear();
    (NativeEventEmitter as unknown as jest.Mock).mockClear();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('drains a pending iOS synthesis request after receiving the native event', async () => {
    let onRequest: (() => Promise<void>) | null = null;
    const remove = jest.fn();
    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_name: string, callback: () => Promise<void>) => {
        onRequest = callback;
        return { remove };
      }),
    }));

    const Harness = () => {
      useBackgroundSynthesisTask();
      return null;
    };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    expect(nativeModule.takePendingBackgroundSynthesisRequest).toHaveBeenCalledTimes(1);

    nativeModule.takePendingBackgroundSynthesisRequest.mockResolvedValueOnce(true);
    await ReactTestRenderer.act(async () => {
      await onRequest?.();
    });
    expect(runBackgroundSynthesisTask).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => renderer!.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to the iOS task event on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const Harness = () => {
      useBackgroundSynthesisTask();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });

    expect(NativeEventEmitter).not.toHaveBeenCalled();
    expect(runBackgroundSynthesisTask).not.toHaveBeenCalled();
  });
});
