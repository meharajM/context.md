import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { RecordingIndicator } from '../RecordingIndicator';

describe('RecordingIndicator', () => {
  it('says when an unrecognized recording was kept in Inbox', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <RecordingIndicator recordingState="error" message="Audio retained in Inbox" />,
      );
    });

    expect(renderer.root.findByProps({ children: 'Recording saved in Inbox' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('does not show a stale recording warning for a synthesis error', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <RecordingIndicator
          recordingState="error"
          message="LiteRT-LM synthesis timed out in JavaScript."
        />,
      );
    });

    expect(renderer.toJSON()).toBeNull();
    ReactTestRenderer.act(() => renderer.unmount());
  });
});
