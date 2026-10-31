import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NativeModules, Platform, Text } from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import NativeEventEmitter from 'react-native/Libraries/EventEmitter/NativeEventEmitter';

import { useIncomingSharedContent } from '../useIncomingSharedContent';

describe('useIncomingSharedContent', () => {
  const originalPlatform = Platform.OS;
  const native = NativeModules.EventEmitter;
  const originalRead = native.getPendingSharedContent;
  const originalAcknowledge = native.acknowledgeSharedContent;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    native.getPendingSharedContent = originalRead;
    native.acknowledgeSharedContent = originalAcknowledge;
    jest.clearAllMocks();
  });

  it('loads shared items on launch and advances after a saved item is acknowledged', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const entries = [
      { id: 'shared-first', text: 'First shared note' },
      { id: 'shared-second', text: 'Second shared note' },
    ];
    native.getPendingSharedContent = jest.fn(async () => entries);
    native.acknowledgeSharedContent = jest.fn(async id => {
      entries.splice(entries.findIndex(entry => entry.id === id), 1);
      return true;
    });
    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    }));

    function Harness() {
      const { pendingSharedContent, acknowledgeSharedContent } = useIncomingSharedContent();
      return <Text testID="share" onPress={() => pendingSharedContent && acknowledgeSharedContent(pendingSharedContent.id)}>
        {pendingSharedContent?.text ?? 'none'}
      </Text>;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<Harness />); });
    expect(renderer!.root.findByProps({ testID: 'share' }).props.children).toBe('First shared note');
    await ReactTestRenderer.act(async () => renderer!.root.findByProps({ testID: 'share' }).props.onPress());
    expect(native.acknowledgeSharedContent).toHaveBeenCalledWith('shared-first');
    expect(renderer!.root.findByProps({ testID: 'share' }).props.children).toBe('Second shared note');
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('rechecks when a new share arrives while the first read is still running', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const entries: { id: string; text: string }[] = [];
    let finishInitialRead!: (items: typeof entries) => void;
    let listener: (() => void) | undefined;
    native.getPendingSharedContent = jest.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishInitialRead = resolve; }))
      .mockImplementation(async () => entries);
    (NativeEventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      addListener: jest.fn((_event, callback) => {
        listener = callback;
        return { remove: jest.fn() };
      }),
    }));

    function Harness() {
      const { pendingSharedContent } = useIncomingSharedContent();
      return <Text testID="share">{pendingSharedContent?.text ?? 'none'}</Text>;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<Harness />); });
    await ReactTestRenderer.act(async () => {
      entries.push({ id: 'shared-late', text: 'Shared while the app opened' });
      listener?.();
      finishInitialRead([]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(native.getPendingSharedContent).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findByProps({ testID: 'share' }).props.children).toBe('Shared while the app opened');
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('keeps a shared item pending when acknowledgement fails', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const entries = [{ id: 'shared-pending', text: 'Still needs saving' }];
    native.getPendingSharedContent = jest.fn(async () => entries);
    native.acknowledgeSharedContent = jest.fn(async () => false);
    let acknowledgement: boolean | undefined;

    function Harness() {
      const { pendingSharedContent, acknowledgeSharedContent } = useIncomingSharedContent();
      return <Text testID="share" onPress={async () => {
        if (pendingSharedContent) acknowledgement = await acknowledgeSharedContent(pendingSharedContent.id);
      }}>{pendingSharedContent?.text ?? 'none'}</Text>;
    }

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<Harness />); });
    await ReactTestRenderer.act(async () => renderer!.root.findByProps({ testID: 'share' }).props.onPress());
    expect(acknowledgement).toBe(false);
    expect(renderer!.root.findByProps({ testID: 'share' }).props.children).toBe('Still needs saving');
    ReactTestRenderer.act(() => renderer!.unmount());
  });
});
