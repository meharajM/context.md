import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { useAppStore } from '../../../core/store';
import { CaptureComposerContainer } from '../CaptureComposerContainer';

describe('CaptureComposerContainer', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    useAppStore.setState({
      manualCaptureEnabled: true,
      pushToRecordEnabled: false,
      audioReadiness: {
        transcriptionReady: false,
        wakeWordReady: false,
        missingModels: [],
        errors: [],
      },
      recordingState: 'idle',
      addThought: jest.fn(async () => undefined),
      startCapture: jest.fn(async () => undefined),
      stopCapture: jest.fn(async () => undefined),
    });
  });

  afterEach(() => {
    if (renderer) {
      ReactTestRenderer.act(() => {
        renderer?.unmount();
      });
      renderer = null;
    }
    jest.restoreAllMocks();
  });

  it('ignores repeated save presses while a typed thought is already saving', async () => {
    let resolveSave!: () => void;
    const addThought = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSave = resolve;
        }),
    );
    useAppStore.setState({ addThought });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<CaptureComposerContainer />);
    });

    const input = renderer!.root.find(node => node.props.testID === 'thought_input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText(' repeated input ');
    });

    const saveButton = renderer!.root.find(
      node => node.props.testID === 'save_button' && node.props.accessibilityRole === 'button',
    );
    ReactTestRenderer.act(() => {
      saveButton.props.onPress();
      saveButton.props.onPress();
    });

    expect(addThought).toHaveBeenCalledTimes(1);
    expect(addThought).toHaveBeenCalledWith('repeated input');

    await ReactTestRenderer.act(async () => {
      resolveSave();
    });

    expect(renderer!.root.find(node => node.props.testID === 'thought_input').props.value).toBe('');
  });

  it('does not turn a rapid post-save tap into an accidental recording start', async () => {
    const startCapture = jest.fn(async () => undefined);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    useAppStore.setState({
      pushToRecordEnabled: true,
      audioReadiness: {
        transcriptionReady: true,
        wakeWordReady: false,
        missingModels: [],
        errors: [],
      },
      addThought: jest.fn(async () => undefined),
      startCapture,
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<CaptureComposerContainer />);
    });

    const input = renderer!.root.find(node => node.props.testID === 'thought_input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('save then tap');
    });

    const saveButton = renderer!.root.find(
      node => node.props.testID === 'save_button' && node.props.accessibilityRole === 'button',
    );
    await ReactTestRenderer.act(async () => {
      await saveButton.props.onPress();
    });

    const recordButton = renderer!.root.find(
      node => node.props.testID === 'record_button' && node.props.accessibilityRole === 'button',
    );
    await ReactTestRenderer.act(async () => {
      await recordButton.props.onPress();
    });

    expect(startCapture).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(2000);
    await ReactTestRenderer.act(async () => {
      await recordButton.props.onPress();
    });

    expect(startCapture).toHaveBeenCalledTimes(1);
  });
});
