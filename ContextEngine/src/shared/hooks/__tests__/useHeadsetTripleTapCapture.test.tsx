import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NativeModules, Platform } from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';

import { useAppStore } from '../../../core/store';
import { useHeadsetTripleTapCapture } from '../useHeadsetTripleTapCapture';

describe('useHeadsetTripleTapCapture', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    jest.clearAllMocks();
  });

  it('syncs the Push to Record setting to Android media-key handling', async () => {
    const setHeadsetTriggerEnabled = jest.fn(async () => undefined);
    NativeModules.EventEmitter.setHeadsetTriggerEnabled = setHeadsetTriggerEnabled;
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({ pushToRecordEnabled: false });
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    }));

    const Harness = () => {
      useHeadsetTripleTapCapture();
      return null;
    };
    let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness />);
    });

    expect(setHeadsetTriggerEnabled).toHaveBeenCalledWith(false);
    await ReactTestRenderer.act(async () => {
      await useAppStore.getState().setCaptureSetting('pushToRecordEnabled', true);
    });
    expect(setHeadsetTriggerEnabled).toHaveBeenLastCalledWith(true);

    await ReactTestRenderer.act(async () => renderer?.unmount());
    delete NativeModules.EventEmitter.setHeadsetTriggerEnabled;
  });

  it('starts capture on triple tap when ready', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    const setStatus = jest.fn();
    let capturedCallback: (() => void) | null = null;
    let capturedEventName = '';

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
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'VoiceCaptureRequested') {
          capturedEventName = eventName;
          capturedCallback = callback;
        }
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
    expect(capturedEventName).toBe('VoiceCaptureRequested');
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
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'VoiceCaptureRequested') capturedCallback = callback;
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
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'VoiceCaptureRequested') capturedCallback = callback;
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
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'VoiceCaptureRequested') capturedCallback = callback;
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
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'VoiceCaptureRequested') capturedCallback = callback;
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
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'VoiceCaptureRequested') capturedCallback = callback;
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

  it('stops an active capture when lock-screen capture is disabled', async () => {
    const stopCapture = jest.fn(async () => undefined);
    let disabledCallback: (() => void) | null = null;
    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        recordingState: 'recording',
        lockScreenHeadsetTriggerEnabled: true,
        stopCapture,
      } as any);
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((eventName: string, callback: () => void) => {
        if (eventName === 'LockScreenCaptureDisabled') disabledCallback = callback;
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
      await disabledCallback?.();
    });

    expect(stopCapture).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().lockScreenHeadsetTriggerEnabled).toBe(false);
    expect(useAppStore.getState().status).toBe('Lock-screen headset capture disabled');
  });
});

// Retained future-voice behavior is exercised only with explicit capability opt-in.
jest.mock('../../../core/releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: {
    voiceCapture: true,
    voiceImport: true,
    assistantCapture: true,
    headsetTrigger: true,
    wakeWord: true,
  },
}));
