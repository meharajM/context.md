import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { useAppStore } from '../../core/store';

// React Native's top-level NativeEventEmitter is not constructible in this Jest/native setup yet.
// eslint-disable-next-line @react-native/no-deep-imports
const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;
const HEADSET_TRIPLE_TAP_EVENT = 'HeadsetTripleTapRequested';

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
    const headsetEventEmitter = createHeadsetEventEmitter();
    if (!headsetEventEmitter) {
      return;
    }

    const subscription = headsetEventEmitter.addListener(HEADSET_TRIPLE_TAP_EVENT, async () => {
      const state = useAppStore.getState();
      const recordingState = state.recordingState;

      if (recordingState === 'recording') {
        await state.stopCapture();
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
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
