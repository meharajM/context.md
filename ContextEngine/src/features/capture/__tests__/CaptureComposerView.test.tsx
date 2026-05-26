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
});
