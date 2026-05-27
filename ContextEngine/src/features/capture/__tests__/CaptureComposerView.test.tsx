import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { CaptureComposerView } from '../CaptureComposerView';

describe('CaptureComposerView', () => {
  it('changes record button state across the recording lifecycle', () => {
    const scenarios = [
      { recordingState: 'starting' as const, expectedLabel: 'Starting Recording', expectedDisabled: true },
      { recordingState: 'recording' as const, expectedLabel: 'Stop Recording', expectedDisabled: false },
      { recordingState: 'stopping' as const, expectedLabel: 'Stopping Recording', expectedDisabled: true },
      { recordingState: 'transcribing' as const, expectedLabel: 'Transcribing Audio', expectedDisabled: true },
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

  it('disables keyboard prediction features for typed capture stability', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CaptureComposerView
          value=""
          canType={true}
          canRecord={true}
          recordingState="idle"
          onChangeValue={() => undefined}
          onRecordPress={() => undefined}
          onSavePress={() => undefined}
        />,
      );
    });

    const input = renderer.root.find(node => node.props.testID === 'thought_input');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.spellCheck).toBe(false);
    expect(input.props.textContentType).toBe('none');
    expect(input.props.blurOnSubmit).toBe(true);
    expect(input.props.returnKeyType).toBe('done');
    expect(input.props.onSubmitEditing).toBeUndefined();

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
