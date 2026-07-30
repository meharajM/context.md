import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { useAppStore } from '../../core/store';
import { normalizeAssistantCaptureText } from '../utils/text';

// React Native's top-level NativeEventEmitter is not constructible in this Jest/native setup yet.
// eslint-disable-next-line @react-native/no-deep-imports
const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;

type AssistantCapturePayload = string | { content?: unknown; text?: unknown; transcript?: unknown } | null | undefined;

type AssistantNativeModule = {
  consumePendingAssistantCapture?: () => Promise<string | null>;
};

const createAssistantEventEmitter = () =>
  (Platform.OS === 'ios' || Platform.OS === 'android') && NativeModules.EventEmitter && typeof NativeEventEmitterClass === 'function'
    ? new NativeEventEmitterClass(NativeModules.EventEmitter)
    : null;

const parseAssistantPayload = (payload: AssistantCapturePayload): string => {
  if (typeof payload === 'string') {
    return normalizeAssistantCaptureText(payload);
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = payload.content ?? payload.text ?? payload.transcript;
  return typeof candidate === 'string' ? normalizeAssistantCaptureText(candidate) : '';
};

export function useAssistantIntentCapture() {
  const addThought = useAppStore(state => state.addThought);

  useEffect(() => {
    const assistantEventEmitter = createAssistantEventEmitter();
    if (!assistantEventEmitter) {
      return;
    }

    const subscription = assistantEventEmitter.addListener('AssistantCaptureRequested', (payload: AssistantCapturePayload) => {
      const normalized = parseAssistantPayload(payload);
      if (!normalized) {
        return;
      }

      addThought(normalized, 'text').catch(error => {
        console.error('Failed to queue assistant capture:', error);
      });
    });

    const nativeModule = NativeModules.EventEmitter as AssistantNativeModule;
    nativeModule.consumePendingAssistantCapture?.().then(payload => {
      const normalized = parseAssistantPayload(payload);
      if (normalized) {
        addThought(normalized, 'text').catch(error => {
          console.error('Failed to queue pending assistant capture:', error);
        });
      }
    }).catch(error => {
      console.error('Failed to read pending assistant capture:', error);
    });

    return () => {
      subscription.remove();
    };
  }, [addThought]);
}
