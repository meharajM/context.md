import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { ThreadDetailsScreen } from '../ThreadDetailsScreen';
import type { ThreadDetailsView } from '../threadTypes';

const buildThread = (
  title: string,
  canDeleteRetainedAudio = false,
  audioFilePath = canDeleteRetainedAudio ? '/mock/path/retained-audio/contextengine-retained-owned.wav' : undefined,
): ThreadDetailsView => ({
  id: title.toLowerCase(),
  title,
  summary: 'Summary',
  captures: [
    {
      id: `${title.toLowerCase()}-capture-0`,
      noteId: 'note-1',
      typeLabel: canDeleteRetainedAudio ? 'VOICE NOTE' : 'TEXT NOTE',
      timestampLabel: 'Recent',
      preview: canDeleteRetainedAudio ? 'Voice capture retained' : 'Raw note',
      sourceSectionHeader: title,
      sourceMetadata: audioFilePath ? { audioFilePath } : undefined,
      canDeleteRetainedAudio,
      icon: canDeleteRetainedAudio ? 'mic' : 'document',
    },
  ],
});

describe('ThreadDetailsScreen unsynthesized note actions', () => {
  it('keeps the original notes without repeating preview or body share controls', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<ThreadDetailsScreen threadDetails={buildThread('Work')} />);
    });
    const labels = renderer!.root.findAllByType(Text).map(node => node.props.children);
    expect(labels).toContain('Raw note');
    expect(labels).not.toContain('Recent notes');
    expect(renderer!.root.findAllByProps({ testID: 'btn_share_context' })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: 'btn_open_agent' })).toBeTruthy();
    ReactTestRenderer.act(() => renderer!.unmount());
  });

  it('does not say a transcript is missing when retained audio already has one', () => {
    const thread = buildThread('Inbox', true);
    thread.captures[0].sourceTranscript = 'The transcript is available.';
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<ThreadDetailsScreen threadDetails={thread} />);
    });

    const labels = renderer.root.findAllByType(Text).map(node => node.props.children).flat();
    expect(labels).toContain('Transcript is shown below.');
    expect(labels).toContain('The transcript is available.');
    expect(labels).not.toContain("We couldn't get the words, but the original recording is saved.");

    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('scrolls to the matching capture and briefly labels it without changing timeline order', () => {
    jest.useFakeTimers();
    const thread = buildThread('Work');
    thread.captures = [
      { ...thread.captures[0], id: 'first', noteId: 'note-first', preview: 'First note' },
      { ...thread.captures[0], id: 'matching', noteId: 'note-match', preview: 'Matching note' },
      { ...thread.captures[0], id: 'last', noteId: 'note-last', preview: 'Last note' },
    ];
    const onTargetLayout = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThreadDetailsScreen threadDetails={thread} targetNoteId="note-match" onTargetLayout={onTargetLayout} />,
      );
    });

    const target = renderer.root.findByProps({ testID: 'search_target_capture' });
    expect(target.findAllByType(Text).filter(node => node.props.children === 'Search result')).toHaveLength(1);
    expect(renderer.root.findAllByType(Text).map(node => node.props.children).filter(
      value => ['First note', 'Matching note', 'Last note'].includes(value),
    )).toEqual(['First note', 'Matching note', 'Last note']);

    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'source_capture_timeline' }).props.onLayout({ nativeEvent: { layout: { y: 24 } } });
      target.props.onLayout({ nativeEvent: { layout: { y: 180 } } });
      renderer.root.findByProps({ testID: 'original_notes_section' }).props.onLayout({ nativeEvent: { layout: { y: 40 } } });
    });
    expect(onTargetLayout).toHaveBeenCalledTimes(1);
    expect(onTargetLayout).toHaveBeenCalledWith(244);

    ReactTestRenderer.act(() => jest.advanceTimersByTime(3000));
    expect(target.findAllByType(Text).filter(node => node.props.children === 'Search result')).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.unmount());
    jest.useRealTimers();
  });

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

  it('offers retry transcription for owned Inbox audio and shows pending state', async () => {
    let resolveTranscription!: () => void;
    const onTranscribeCapture = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveTranscription = resolve;
        }),
    );
    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThreadDetailsScreen
          threadDetails={buildThread('Inbox', true)}
          onTranscribeCapture={onTranscribeCapture}
        />,
      );
    });

    const retryButton = renderer!.root.findByProps({ testID: 'transcribe_capture_audio_inbox-capture-0' });
    expect(retryButton.props.accessibilityRole).toBe('button');
    expect(retryButton.props.accessibilityLabel).toBe('Transcribe recording again for note: Voice capture retained');

    let transcription!: Promise<void>;
    ReactTestRenderer.act(() => {
      transcription = retryButton.props.onPress();
    });

    expect(onTranscribeCapture).toHaveBeenCalledWith('inbox-capture-0');
    expect(retryButton.props.disabled).toBe(true);
    expect(retryButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(retryButton.findByType(Text).props.children).toBe('Transcribing…');

    await ReactTestRenderer.act(async () => {
      resolveTranscription();
      await transcription;
    });

    expect(retryButton.props.disabled).toBe(false);
    expect(retryButton.findByType(Text).props.children).toBe('Transcribe again');
  });

  it('does not offer retry transcription outside Inbox or for non-owned audio', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    const onTranscribeCapture = jest.fn(async () => undefined);

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThreadDetailsScreen
          threadDetails={buildThread('Work', true)}
          onTranscribeCapture={onTranscribeCapture}
        />,
      );
    });
    expect(renderer!.root.findAllByProps({ testID: 'transcribe_capture_audio_work-capture-0' })).toHaveLength(0);

    ReactTestRenderer.act(() => {
      renderer!.update(
        <ThreadDetailsScreen
          threadDetails={buildThread('Inbox', false, '/tmp/imported/meeting.wav')}
          onTranscribeCapture={onTranscribeCapture}
        />,
      );
    });
    expect(renderer!.root.findAllByProps({ testID: 'transcribe_capture_audio_inbox-capture-0' })).toHaveLength(0);
  });
});
