import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { useAppStore } from '../../core/store';
import { normalizeAssistantCaptureText } from '../utils/text';

const NativeEventEmitterModule = require('react-native/Libraries/EventEmitter/NativeEventEmitter');
const NativeEventEmitterClass = NativeEventEmitterModule?.default ?? NativeEventEmitterModule;

type AssistantCapturePayload = string | { content?: unknown; text?: unknown; transcript?: unknown } | null | undefined;

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

    return () => {
      subscription.remove();
    };
  }, [addThought]);
}
