import { useEffect, useState } from 'react';
import RNFS from 'react-native-fs';

import { useAppStore } from '../core/store';
import { RELEASE_CAPABILITIES } from '../core/releaseCapabilities';
import { ContextManager } from '../modules/ContextManager';
import { drainQuickTextOutbox } from '../modules/BackgroundSynthesis/quickTextCapture';

export const CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/topics`;
export const LEGACY_CONTEXT_PATH = `${RNFS.DocumentDirectoryPath}/context.md`;

export function useAppBootstrap() {
  const loadContext = useAppStore(state => state.loadContext);
  const initializeEngine = useAppStore(state => state.initializeEngine);
  const hydratePreferences = useAppStore(state => state.hydratePreferences);
  const [bootMessage, setBootMessage] = useState('Preparing local context');

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      ContextManager.setPath(CONTEXT_PATH, { legacyPath: LEGACY_CONTEXT_PATH });
      await hydratePreferences();
      try {
        await drainQuickTextOutbox();
      } catch (error) {
        console.error('Saved quick text will be retried on the next launch:', error);
      }
      await loadContext();

      try {
        await initializeEngine({ eagerAudio: RELEASE_CAPABILITIES.voiceCapture, eagerSynthesis: true });
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
  }, [hydratePreferences, initializeEngine, loadContext]);

  return {
    bootMessage,
    contextPath: CONTEXT_PATH,
  };
}
