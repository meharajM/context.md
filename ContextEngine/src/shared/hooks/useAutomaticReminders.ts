import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../core/store';
import { scanAutomaticReminders } from '../../modules/AutomaticReminders';

export function useAutomaticReminders() {
  const sections = useAppStore(state => state.sections);
  const installed = useAppStore(state => state.selectedModelInstalled);
  const resources = useAppStore(state => state.deviceReadiness?.resourcesAvailable);
  useEffect(() => {
    void scanAutomaticReminders(resources !== false);
  }, [sections, installed, resources]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void scanAutomaticReminders(resources !== false);
    });
    return () => listener.remove();
  }, [resources]);
}
