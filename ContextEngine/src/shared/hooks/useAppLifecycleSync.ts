import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../core/store';

export function useAppLifecycleSync() {
  const setAppLifecycleState = useAppStore(state => state.setAppLifecycleState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      setAppLifecycleState(nextState).catch(error => {
        console.error('Failed to sync app lifecycle state:', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [setAppLifecycleState]);
}
