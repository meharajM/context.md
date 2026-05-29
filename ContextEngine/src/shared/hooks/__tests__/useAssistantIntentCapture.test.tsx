jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return jest.fn().mockImplementation(() => ({
    addListener: jest.fn((_eventName: string, callback: (payload: unknown) => void) => ({
      remove: jest.fn(),
      callback,
    })),
  }));
});

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';

import { useAppStore } from '../../../core/store';
import { useAssistantIntentCapture } from '../useAssistantIntentCapture';

describe('useAssistantIntentCapture', () => {
  it('normalizes assistant payloads and queues them through addThought', async () => {
    const addThought = jest.fn(async () => undefined);
    let capturedCallback: ((payload: unknown) => void) | null = null;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        addThought,
      } as any);
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: (payload: unknown) => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useAssistantIntentCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });

    expect(capturedCallback).not.toBeNull();

    await ReactTestRenderer.act(async () => {
      capturedCallback?.({ content: '  Add\nthis   to  my context  ' });
    });

    expect(addThought).toHaveBeenCalledWith('Add this to my context', 'text');
  });

  it('ignores empty assistant payloads', async () => {
    const addThought = jest.fn(async () => undefined);
    let capturedCallback: ((payload: unknown) => void) | null = null;

    await ReactTestRenderer.act(async () => {
      useAppStore.setState({
        addThought,
      } as any);
    });

    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_eventName: string, callback: (payload: unknown) => void) => {
        capturedCallback = callback;
        return { remove: jest.fn() };
      }),
    }));

    const Harness = () => {
      useAssistantIntentCapture();
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness />);
    });

    await ReactTestRenderer.act(async () => {
      capturedCallback?.({ content: '   ' });
    });

    expect(addThought).not.toHaveBeenCalled();
  });
});
