import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { CaptureComposerView, refocusInputForQuickCapture } from '../CaptureComposerView';

describe('CaptureComposerView', () => {
  it('reopens the keyboard for quick capture after returning from the home screen', () => {
    const blur = jest.fn();
    const focus = jest.fn();

    jest.useFakeTimers();
    try {
      refocusInputForQuickCapture({ blur, focus });
      expect(blur).toHaveBeenCalledTimes(1);
      expect(focus).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      expect(focus).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('changes record button state across the recording lifecycle', () => {
    const scenarios = [
      { recordingState: 'starting' as const, expectedLabel: 'Starting voice note', expectedDisabled: true },
      { recordingState: 'recording' as const, expectedLabel: 'Stop recording', expectedDisabled: false },
      { recordingState: 'stopping' as const, expectedLabel: 'Saving recording', expectedDisabled: true },
      { recordingState: 'transcribing' as const, expectedLabel: 'Getting words from recording', expectedDisabled: true },
    ];

    for (const scenario of scenarios) {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <CaptureComposerView
            value=""
            canType={true}
            canRecord={true}
            recordingState={scenario.recordingState}
            onChangeValue={() => undefined}
            onRecordPress={() => undefined}
            onSavePress={() => undefined}
          />,
        );
      });

      const recordButton = renderer.root.find(
        node => node.props.testID === 'record_button' && typeof node.props.accessibilityRole === 'string',
      );

      expect(recordButton.props.accessibilityLabel).toBe(scenario.expectedLabel);
      expect(recordButton.props.disabled).toBe(scenario.expectedDisabled);
    }
  });

  it('shows a liquid glass recording indicator while recording is active', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureComposerView
          value=""
          canType={true}
          canRecord={true}
          recordingState="recording"
          onChangeValue={() => undefined}
          onRecordPress={() => undefined}
          onSavePress={() => undefined}
        />,
      );
    });

    const indicator = renderer.root.find(node => node.props.testID === 'recording_indicator');
    expect(indicator.props.accessibilityLabel).toBe('Recording');

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it('shows the stop fallback when Android notification permission is denied', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureComposerView
          value=""
          canType={true}
          canRecord={true}
          recordingState="recording"
          recordingMessage="Listening... · stop from app"
          onChangeValue={() => undefined}
          onRecordPress={() => undefined}
          onSavePress={() => undefined}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'recording_indicator' }).props.accessibilityLabel)
      .toBe('Recording · stop from app');
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('keeps Stop visible alongside Save while recording with typed text', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureComposerView
          value="A quick reminder"
          canType={true}
          canRecord={false}
          recordingState="recording"
          onChangeValue={() => undefined}
          onRecordPress={() => undefined}
          onSavePress={() => undefined}
        />,
      );
    });

    expect(renderer.root.findAllByProps({ testID: 'save_button' }).length).toBeGreaterThan(0);
    const stopButton = renderer.root.find(node => node.props.testID === 'record_button' && node.props.accessibilityRole === 'button');
    expect(stopButton.props.accessibilityLabel).toBe('Stop recording');
    expect(stopButton.props.disabled).toBe(false);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('shows the Inbox fallback while transcription continues after the UI timeout', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureComposerView
          value=""
          canType={true}
          canRecord={true}
          recordingState="transcribing"
          recordingMessage="Audio saved in Inbox; transcription continues"
          onChangeValue={() => undefined}
          onRecordPress={() => undefined}
          onSavePress={() => undefined}
        />,
      );
    });

    const indicator = renderer.root.find(node => node.props.testID === 'recording_indicator');
    expect(indicator.props.accessibilityLabel).toBe('Recording saved in Inbox · getting the words');

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it('submits typed capture from the keyboard Done key and disables prediction features', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const onSavePress = jest.fn();

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureComposerView
          value=""
          canType={true}
          canRecord={true}
          recordingState="idle"
          onChangeValue={() => undefined}
          onRecordPress={() => undefined}
          onSavePress={onSavePress}
        />,
      );
    });

    const input = renderer.root.find(node => node.props.testID === 'thought_input');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.spellCheck).toBe(false);
    expect(input.props.textContentType).toBe('none');
    expect(input.props.blurOnSubmit).toBe(true);
    expect(input.props.returnKeyType).toBe('done');
    ReactTestRenderer.act(() => input.props.onSubmitEditing());
    expect(onSavePress).toHaveBeenCalledTimes(1);

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
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
