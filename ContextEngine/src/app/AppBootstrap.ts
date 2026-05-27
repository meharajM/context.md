import { useEffect, useState } from 'react';
import RNFS from 'react-native-fs';

import { useAppStore } from '../core/store';
import { ContextManager } from '../modules/ContextManager';

export const CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/context.md`;

export function useAppBootstrap() {
  const loadContext = useAppStore(state => state.loadContext);
  const initializeEngine = useAppStore(state => state.initializeEngine);
  const [bootMessage, setBootMessage] = useState('Preparing local context');

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      ContextManager.setPath(CONTEXT_PATH);
      await loadContext();

      try {
        await initializeEngine();
        if (isMounted) {
          setBootMessage('Ready for local capture');
        }
      } catch {
        if (isMounted) {
          setBootMessage('Capture works; AI runtime unavailable');
        }
      }
    };

    boot().catch(error => {
      console.error('Failed to bootstrap app shell:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [initializeEngine, loadContext]);

  return {
    bootMessage,
    contextPath: CONTEXT_PATH,
  };
}
