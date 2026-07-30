import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NativeModules } from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';

import { useAppStore } from '../../../core/store';
import { useHeadsetTripleTapCapture } from '../useHeadsetTripleTapCapture';

describe('useHeadsetTripleTapCapture', () => {
  it('starts capture on triple tap when ready', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    const setStatus = jest.fn();
    let capturedCallback: (() => void) | null = null;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'idle',
        pushToRecordEnabled: true,
        audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
        startCapture,
        stopCapture,
        setStatus,
      });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: () => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });

    await ReactTestRenderer.act(async () => {
      await capturedCallback?.();
    });

    expect(startCapture).toHaveBeenCalledTimes(1);
    expect(stopCapture).not.toHaveBeenCalled();
  });

  it('announces guidance when push-to-record is disabled', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    const setStatus = jest.fn();
    const announceGuidance = jest.fn(async () => undefined);
    let capturedCallback: (() => void) | null = null;

    NativeModules.EventEmitter.announceGuidance = announceGuidance;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'idle',
        pushToRecordEnabled: false,
        audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
        startCapture,
        stopCapture,
        setStatus,
      });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: () => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });

    await ReactTestRenderer.act(async () => {
      await capturedCallback?.();
    });

    expect(setStatus).toHaveBeenCalledWith('Enable Push to Record in Settings to use headset trigger');
    expect(announceGuidance).toHaveBeenCalledTimes(1);
    expect(startCapture).not.toHaveBeenCalled();
    expect(stopCapture).not.toHaveBeenCalled();
  });

  it('stops capture on triple tap while recording', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    let capturedCallback: (() => void) | null = null;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'recording',
        pushToRecordEnabled: true,
        audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
        startCapture,
        stopCapture,
      });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: () => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await capturedCallback?.();
    });

    expect(stopCapture).toHaveBeenCalledTimes(1);
    expect(startCapture).not.toHaveBeenCalled();
  });

  it('ignores a trigger while capture is transitioning', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    let capturedCallback: (() => void) | null = null;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'starting',
        pushToRecordEnabled: true,
        audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
        startCapture,
        stopCapture,
      });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: () => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await capturedCallback?.();
    });

    expect(startCapture).not.toHaveBeenCalled();
    expect(stopCapture).not.toHaveBeenCalled();
  });

  it('announces guidance when transcription is not ready', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    const setStatus = jest.fn();
    const announceGuidance = jest.fn(async () => undefined);
    let capturedCallback: (() => void) | null = null;

    NativeModules.EventEmitter.announceGuidance = announceGuidance;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'idle',
        pushToRecordEnabled: true,
        audioReadiness: {
          transcriptionReady: false,
          wakeWordReady: false,
          missingModels: ['whisper'],
          errors: ['Whisper unavailable'],
        },
        startCapture,
        stopCapture,
        setStatus,
      });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: () => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await capturedCallback?.();
    });

    expect(setStatus).toHaveBeenCalledWith('Voice capture is unavailable. Open Settings to complete audio setup');
    expect(announceGuidance).toHaveBeenCalledWith(
      'Voice capture is unavailable. Open Settings to complete audio setup',
    );
    expect(startCapture).not.toHaveBeenCalled();
    expect(stopCapture).not.toHaveBeenCalled();
  });

  it('clears a recoverable error state before starting capture', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    let capturedCallback: (() => void) | null = null;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'error',
        status: 'Previous capture failed',
        pushToRecordEnabled: true,
        audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
        startCapture,
        stopCapture,
      });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: () => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await capturedCallback?.();
    });

    expect(useAppStore.getState().recordingState).toBe('idle');
    expect(useAppStore.getState().status).toBe('Capture Ready');
    expect(startCapture).toHaveBeenCalledTimes(1);
    expect(stopCapture).not.toHaveBeenCalled();
  });
});
