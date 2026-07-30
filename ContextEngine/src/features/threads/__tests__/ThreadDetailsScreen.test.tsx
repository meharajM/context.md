import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { ThreadDetailsScreen } from '../ThreadDetailsScreen';
import type { ThreadDetailsView } from '../threadTypes';

const buildThread = (title: string, canDeleteRetainedAudio = false): ThreadDetailsView => ({
  id: title.toLowerCase(),
  title,
  summary: 'Summary',
  captures: [
    {
      id: `${title.toLowerCase()}-capture-0`,
      noteId: 'note-1',
      typeLabel: canDeleteRetainedAudio ? 'VOICE NOTE' : 'TEXT ENTRY',
      timestampLabel: 'Recent',
      preview: canDeleteRetainedAudio ? 'Voice capture retained' : 'Raw note',
      sourceSectionHeader: title,
      sourceMetadata: canDeleteRetainedAudio
        ? { audioFilePath: '/mock/path/retained-audio/contextengine-retained-owned.wav' }
        : undefined,
      canDeleteRetainedAudio,
      icon: canDeleteRetainedAudio ? 'mic' : 'document',
    },
  ],
});

describe('ThreadDetailsScreen unsynthesized note actions', () => {
  it('shows note deletion on Inbox captures and forwards the capture id', () => {
    const onDeleteCapture = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThreadDetailsScreen
          threadDetails={buildThread('Inbox')}
          onDeleteCapture={onDeleteCapture}
        />,
      );
    });

    ReactTestRenderer.act(() => {
      renderer!.root.findByProps({ testID: 'delete_capture_inbox-capture-0' }).props.onPress();
    });

    expect(onDeleteCapture).toHaveBeenCalledWith('inbox-capture-0');
  });

  it('does not expose unsynthesized deletion on categorized topic captures', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThreadDetailsScreen
          threadDetails={buildThread('Work')}
          onDeleteCapture={jest.fn()}
        />,
      );
    });

    expect(renderer!.root.findAllByProps({ testID: 'delete_capture_work-capture-0' })).toHaveLength(0);
  });

  it('shows retained-audio deletion only for an app-owned Inbox recording', () => {
    const onDeleteCaptureAudio = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThreadDetailsScreen
          threadDetails={buildThread('Inbox', true)}
          onDeleteCaptureAudio={onDeleteCaptureAudio}
        />,
      );
    });

    ReactTestRenderer.act(() => {
      renderer!.root.findByProps({ testID: 'delete_capture_audio_inbox-capture-0' }).props.onPress();
    });

    expect(onDeleteCaptureAudio).toHaveBeenCalledWith('inbox-capture-0');
  });
});
