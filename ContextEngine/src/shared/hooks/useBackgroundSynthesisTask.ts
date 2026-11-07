import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { runBackgroundSynthesisTask } from '../../modules/BackgroundSynthesis/runBackgroundSynthesisTask';
import { takePendingBackgroundSynthesisRequest } from '../../modules/BackgroundSynthesis';

// eslint-disable-next-line @react-native/no-deep-imports
const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;

export function useBackgroundSynthesisTask() {
  useEffect(() => {
    const nativeModule = NativeModules.EventEmitter;
    if (Platform.OS !== 'ios' || !nativeModule || typeof NativeEventEmitterClass !== 'function') return;

    let disposed = false;
    let running = false;
    let rerun = false;
    const drain = async () => {
      if (disposed) return;
      if (running) {
        rerun = true;
        return;
      }

      running = true;
      try {
        do {
          rerun = false;
          if (!(await takePendingBackgroundSynthesisRequest()) || disposed) break;
          await runBackgroundSynthesisTask();
        } while (rerun);
      } catch (error) {
        console.error('iOS background synthesis did not finish:', error);
      } finally {
        running = false;
        if (rerun && !disposed) void drain();
      }
    };

    const emitter = new NativeEventEmitterClass(nativeModule);
    const subscription = emitter.addListener('BackgroundSynthesisRequested', drain);
    void drain();
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);
}
