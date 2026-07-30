import { useEffect, useState } from 'react';
import RNFS from 'react-native-fs';

import { useAppStore } from '../core/store';
import { ContextManager } from '../modules/ContextManager';

export const CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/topics`;
export const LEGACY_CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/context.md`;

export function useAppBootstrap() {
  const loadContext = useAppStore(state => state.loadContext);
  const initializeEngine = useAppStore(state => state.initializeEngine);
  const startCapture = useAppStore(state => state.startCapture);
  const stopCapture = useAppStore(state => state.stopCapture);
  const setCaptureSetting = useAppStore(state => state.setCaptureSetting);
  const [bootMessage, setBootMessage] = useState('Preparing local context');

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      ContextManager.setPath(CONTEXT_PATH, { legacyPath: LEGACY_CONTEXT_PATH });
      await loadContext();

      try {
        console.log('[Bootstrap] Enabling pushToRecordEnabled...');
        setCaptureSetting('pushToRecordEnabled', true);
        await initializeEngine({ eagerAudio: true, eagerSynthesis: true });
        if (isMounted) {
          setBootMessage('Ready for local capture');
        }
      } catch (err) {
        console.error('[Bootstrap] Init failed:', err);
        if (isMounted) {
          setBootMessage('Ready for local capture');
        }
      }
    };

    boot().catch(error => {
      console.error('Failed to bootstrap app shell:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [initializeEngine, loadContext, startCapture, stopCapture, setCaptureSetting]);

  return {
    bootMessage,
    contextPath: CONTEXT_PATH,
  };
}
