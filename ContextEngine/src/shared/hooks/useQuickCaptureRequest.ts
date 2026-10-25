import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useAppStore } from '../../core/store';

// React Native's top-level NativeEventEmitter export is not constructible in the current Jest setup.
// eslint-disable-next-line @react-native/no-deep-imports
const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;

export function useQuickCaptureRequest(): { type: number; record: number } {
  const [requests, setRequests] = useState({ type: 0, record: 0 });

  useEffect(() => {
    const nativeModule = Platform.OS === 'android' ? NativeModules.EventEmitter : null;
    if (!nativeModule || typeof NativeEventEmitterClass !== 'function') return;

    const emitter = new NativeEventEmitterClass(nativeModule);
    const typeSubscription = emitter.addListener('QuickCaptureRequested', () => {
      setRequests(value => ({ ...value, type: value.type + 1 }));
    });
    const recordSubscription = emitter.addListener('QuickRecordRequested', () => {
      setRequests(value => ({ ...value, record: value.record + 1 }));
    });
    let stopPending = false;
    let unsubscribePendingStop: (() => void) | null = null;
    const stopRecording = () => {
      if (stopPending) return;
      const state = useAppStore.getState();
      if (state.recordingState === 'starting') {
        stopPending = true;
        unsubscribePendingStop = useAppStore.subscribe(nextState => {
          if (nextState.recordingState === 'starting') return;
          unsubscribePendingStop?.();
          unsubscribePendingStop = null;
          if (nextState.recordingState === 'recording') {
            nextState.stopCapture().catch(error => console.error('Failed to stop the active voice note:', error))
              .finally(() => { stopPending = false; });
          } else {
            stopPending = false;
          }
        });
      } else if (state.recordingState === 'recording') {
        stopPending = true;
        state.stopCapture().catch(error => console.error('Failed to stop the active voice note:', error))
          .finally(() => { stopPending = false; });
      }
    };
    const stopSubscription = emitter.addListener('ActiveRecordingStopRequested', stopRecording);
    return () => {
      typeSubscription.remove();
      recordSubscription.remove();
      stopSubscription.remove();
      unsubscribePendingStop?.();
    };
  }, []);

  return requests;
}
