import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { runBackgroundSynthesisTask } from '../../modules/BackgroundSynthesis/runBackgroundSynthesisTask';
import { takePendingBackgroundSynthesisRequest } from '../../modules/BackgroundSynthesis';

export function useBackgroundSynthesisTask() {
  useEffect(() => {
    const nativeModule = NativeModules.EventEmitter;
    if (Platform.OS !== 'ios' || !nativeModule) return;

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

    const emitter = new NativeEventEmitter(nativeModule);
    const subscription = emitter.addListener('BackgroundSynthesisRequested', drain);
    void drain();
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);
}
