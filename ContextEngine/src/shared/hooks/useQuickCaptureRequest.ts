import { useEffect, useState } from 'react';
import { AppState, Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { useAppStore } from '../../core/store';

export function useQuickCaptureRequest(): { type: number; record: number; meeting: number } {
  const [requests, setRequests] = useState({ type: 0, record: 0, meeting: 0 });

  useEffect(() => {
    const nativeModule = Platform.OS === 'android' || Platform.OS === 'ios' ? NativeModules.EventEmitter : null;
    if (!nativeModule) return;

    if (Platform.OS === 'ios') {
      let active = true;
      const applyMode = (mode: string | null) => {
        if (!active || !mode) return;
        if (mode === 'write') setRequests(value => ({ ...value, type: value.type + 1 }));
        if (mode === 'record') setRequests(value => ({ ...value, record: value.record + 1 }));
        if (mode === 'meeting') setRequests(value => ({ ...value, meeting: value.meeting + 1 }));
      };
      const applyWidgetURL = (url: string | null) => {
        const mode = url?.match(/^com\.meharaj\.contextengine:\/\/quick-capture\/(write|record|meeting)$/)?.[1] ?? null;
        applyMode(mode);
      };
      const readPendingRequest = async () => {
        try {
          const mode = await nativeModule.takePendingWidgetCaptureRequest?.();
          applyMode(mode);
        } catch (error) {
          console.error('Could not read the pending widget capture:', error);
        }
      };
      void readPendingRequest();
      void Linking.getInitialURL().then(applyWidgetURL).catch(error => {
        console.error('Could not read the widget launch URL:', error);
      });
      const linkSubscription = Linking.addEventListener('url', ({ url }) => applyWidgetURL(url));
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') void readPendingRequest();
      });
      return () => {
        active = false;
        linkSubscription.remove();
        subscription.remove();
      };
    }

    const emitter = new NativeEventEmitter(nativeModule);
    const typeSubscription = emitter.addListener('QuickCaptureRequested', () => {
      setRequests(value => ({ ...value, type: value.type + 1 }));
    });
    const recordSubscription = emitter.addListener('QuickRecordRequested', () => {
      setRequests(value => ({ ...value, record: value.record + 1 }));
    });
    const meetingSubscription = emitter.addListener('MeetingModeRequested', () => {
      setRequests(value => ({ ...value, meeting: value.meeting + 1 }));
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
      meetingSubscription.remove();
      stopSubscription.remove();
      unsubscribePendingStop?.();
    };
  }, []);

  return requests;
}
