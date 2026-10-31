import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';

// eslint-disable-next-line @react-native/no-deep-imports
const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;

export interface IncomingSharedContent {
  id: string;
  text: string;
}

interface IncomingShareNativeModule {
  getPendingSharedContent(): Promise<IncomingSharedContent[]>;
  acknowledgeSharedContent(id: string): Promise<boolean>;
}

export function useIncomingSharedContent() {
  const [pendingSharedContent, setPendingSharedContent] = useState<IncomingSharedContent | null>(null);
  const reading = useRef(false);
  const refreshQueued = useRef(false);
  const native = (Platform.OS === 'ios' || Platform.OS === 'android'
    ? NativeModules.EventEmitter
    : null) as IncomingShareNativeModule | null;

  const refresh = useCallback(async () => {
    if (!native) return;
    if (reading.current) {
      refreshQueued.current = true;
      return;
    }
    reading.current = true;
    try {
      do {
        refreshQueued.current = false;
        const entries = await native.getPendingSharedContent();
        setPendingSharedContent(current =>
          entries.find(entry => entry.id === current?.id) ?? entries[0] ?? null,
        );
      } while (refreshQueued.current);
    } catch (error) {
      console.error('Could not read shared text:', error);
    } finally {
      reading.current = false;
    }
  }, [native]);

  const acknowledge = useCallback(async (id: string): Promise<boolean> => {
    if (!native) return false;
    try {
      if (await native.acknowledgeSharedContent(id)) {
        setPendingSharedContent(current => current?.id === id ? null : current);
        await refresh();
        return true;
      }
    } catch (error) {
      console.error('Could not clear saved shared text:', error);
    }
    return false;
  }, [native, refresh]);

  useEffect(() => {
    if (!native) return;
    refresh();
    const stateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    const emitter = typeof NativeEventEmitterClass === 'function'
      ? new NativeEventEmitterClass(native)
      : null;
    const shareSubscription = emitter?.addListener('IncomingSharedContentAvailable', refresh);
    return () => {
      stateSubscription.remove();
      shareSubscription?.remove();
    };
  }, [native, refresh]);

  return { pendingSharedContent, acknowledgeSharedContent: acknowledge };
}
