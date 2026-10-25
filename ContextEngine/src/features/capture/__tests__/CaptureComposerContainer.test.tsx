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

  it('preserves a newer draft even when it returns to the submitted text', async () => {
    let resolveSave!: () => void;
    const addThought = jest.fn(() => new Promise<void>(resolve => { resolveSave = resolve; }));
    useAppStore.setState({ addThought });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CaptureComposerContainer />); });
    const input = () => renderer!.root.findByProps({ testID: 'thought_input' });
    ReactTestRenderer.act(() => input().props.onChangeText('A'));
    ReactTestRenderer.act(() => { renderer!.root.find(node => node.props.testID === 'save_button' && node.props.accessibilityRole === 'button').props.onPress(); });
    ReactTestRenderer.act(() => input().props.onChangeText('B'));
    ReactTestRenderer.act(() => input().props.onChangeText('A'));
    await ReactTestRenderer.act(async () => resolveSave());
    expect(addThought).toHaveBeenCalledWith('A');
    expect(input().props.value).toBe('A');
  });

  it('retains the draft after a save failure', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    useAppStore.setState({ addThought: jest.fn(async () => { throw new Error('disk full'); }) });
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CaptureComposerContainer />); });
    ReactTestRenderer.act(() => renderer!.root.findByProps({ testID: 'thought_input' }).props.onChangeText('Keep this'));
    await ReactTestRenderer.act(async () => renderer!.root.find(node => node.props.testID === 'save_button' && node.props.accessibilityRole === 'button').props.onPress());
    expect(renderer!.root.findByProps({ testID: 'thought_input' }).props.value).toBe('Keep this');
    expect(error).toHaveBeenCalled();
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

  it('stops active recording despite a recent save and unavailable recording readiness', async () => {
    const startCapture = jest.fn(async () => undefined);
    const stopCapture = jest.fn(async () => undefined);
    jest.spyOn(Date, 'now').mockReturnValue(1000);
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
      stopCapture,
    });

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<CaptureComposerContainer />);
    });

    const input = renderer!.root.find(node => node.props.testID === 'thought_input');
    ReactTestRenderer.act(() => input.props.onChangeText('save before stop'));
    const saveButton = renderer!.root.find(node => node.props.testID === 'save_button' && node.props.accessibilityRole === 'button');
    await ReactTestRenderer.act(async () => saveButton.props.onPress());

    ReactTestRenderer.act(() => {
      useAppStore.setState({
        recordingState: 'recording',
        pushToRecordEnabled: false,
        audioReadiness: { transcriptionReady: false, wakeWordReady: false, missingModels: [], errors: [] },
      });
    });
    const stopButton = renderer!.root.find(node => node.props.testID === 'record_button' && node.props.accessibilityRole === 'button');
    expect(stopButton.props.disabled).toBe(false);

    await ReactTestRenderer.act(async () => stopButton.props.onPress());

    expect(stopCapture).toHaveBeenCalledTimes(1);
    expect(startCapture).not.toHaveBeenCalled();
  });
});

// Retained future-voice behavior is exercised only with explicit capability opt-in.
jest.mock('../../../core/releaseCapabilities', () => ({
  RELEASE_CAPABILITIES: {
    voiceCapture: true,
    voiceImport: true,
    assistantCapture: true,
    headsetTrigger: true,
    wakeWord: true,
  },
}));
