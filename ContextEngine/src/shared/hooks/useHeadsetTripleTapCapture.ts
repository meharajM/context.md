import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { useAppStore } from '../../core/store';
import { RELEASE_CAPABILITIES } from '../../core/releaseCapabilities';
import { setHeadsetTriggerEnabled } from '../../modules/HeadsetTrigger';

// React Native's top-level NativeEventEmitter is not constructible in this Jest/native setup yet.
// eslint-disable-next-line @react-native/no-deep-imports
const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;
const VOICE_CAPTURE_EVENT = 'VoiceCaptureRequested';
const LOCK_SCREEN_CAPTURE_DISABLED_EVENT = 'LockScreenCaptureDisabled';

const createHeadsetEventEmitter = () =>
  (Platform.OS === 'ios' || Platform.OS === 'android') && NativeModules.EventEmitter && typeof NativeEventEmitterClass === 'function'
    ? new NativeEventEmitterClass(NativeModules.EventEmitter)
    : null;

const announceGuidance = async (message: string) => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }

  const announcer = (NativeModules.EventEmitter as { announceGuidance?: (text: string) => Promise<void> } | undefined)
    ?.announceGuidance;

  if (typeof announcer !== 'function') {
    return;
  }

  try {
    await announcer(message);
  } catch (error) {
    console.error('Failed to announce headset guidance:', error);
  }
};

export function useHeadsetTripleTapCapture() {
  useEffect(() => {
    if (!RELEASE_CAPABILITIES.headsetTrigger) return;
    if (Platform.OS === 'android') {
      setHeadsetTriggerEnabled(useAppStore.getState().pushToRecordEnabled).catch(error => {
        console.error('Failed to sync headset trigger setting:', error);
      });
    }
    const headsetEventEmitter = createHeadsetEventEmitter();
    if (!headsetEventEmitter) {
      return;
    }

    const subscription = headsetEventEmitter.addListener(VOICE_CAPTURE_EVENT, async () => {
      const state = useAppStore.getState();
      const recordingState = state.recordingState;

      if (recordingState === 'recording') {
        await state.stopCapture();
        await announceGuidance('Recording stopped');
        return;
      }

      if (recordingState !== 'idle' && recordingState !== 'error') {
        return;
      }

      if (!state.pushToRecordEnabled) {
        const message = 'Enable Push to Record in Settings to use headset trigger';
        state.setStatus(message);
        await announceGuidance(message);
        return;
      }

      if (!state.audioReadiness.transcriptionReady) {
        const message = 'Voice capture is unavailable. Open Settings to complete audio setup';
        state.setStatus(message);
        await announceGuidance(message);
        return;
      }

      if (recordingState === 'error') {
        useAppStore.setState({ recordingState: 'idle', status: 'Capture Ready' });
      }

      await state.startCapture();
      if (useAppStore.getState().recordingState === 'recording') {
        await announceGuidance('Recording started');
      }
    });
    const disarmSubscription = headsetEventEmitter.addListener(LOCK_SCREEN_CAPTURE_DISABLED_EVENT, async () => {
      const state = useAppStore.getState();
      if (state.recordingState === 'recording') {
        await state.stopCapture();
      }
      useAppStore.setState({
        lockScreenHeadsetTriggerEnabled: false,
        status: 'Lock-screen headset capture disabled',
      });
    });

    return () => {
      subscription.remove();
      disarmSubscription.remove();
    };
  }, []);
}
