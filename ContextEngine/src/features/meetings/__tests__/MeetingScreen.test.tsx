import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { useAppStore } from '../../../core/store';
import { MeetingScreen } from '../MeetingScreen';

describe('MeetingScreen', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const initialState = useAppStore.getInitialState();

  afterEach(() => {
    ReactTestRenderer.act(() => renderer?.unmount());
    useAppStore.setState(initialState, true);
  });

  it('shows the start failure result instead of stale app status and leaves retry available', async () => {
    const message = 'Microphone access is needed for Meeting mode';
    const startMeeting = jest.fn(async () => message);
    useAppStore.setState({
      ...initialState,
      meetings: [],
      activeMeetingId: null,
      recordingState: 'idle',
      status: 'Saved in Inbox. It will be sorted when your device is ready.',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      loadMeetings: jest.fn(async () => undefined),
      startMeeting,
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });

    expect(renderer.root.findAllByProps({ testID: 'meeting_start_error' })).toHaveLength(0);
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID: 'meeting_start_button' }).props.onPress();
    });

    expect(startMeeting).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ testID: 'meeting_start_error' })).toBeTruthy();
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === message)).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Saved in Inbox. It will be sorted when your device is ready.')).toBe(false);
    expect(renderer.root.findByProps({ testID: 'meeting_start_button' }).props.disabled).toBe(false);
  });

  it('keeps Start disabled and explains setup while Whisper is downloading', () => {
    useAppStore.setState({
      ...initialState,
      meetings: [],
      activeMeetingId: null,
      recordingState: 'idle',
      audioReadiness: { transcriptionReady: false, wakeWordReady: false, missingModels: [], errors: [] },
      whisperModelDownloading: true,
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'meeting_start_button' }).props.disabled).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Transcription not ready')).toBe(true);
  });

  it('prevents a second recording while a recovered meeting is being transcribed', () => {
    useAppStore.setState({
      ...initialState,
      meetings: [],
      activeMeetingId: null,
      meetingTranscriptionRetryActive: true,
      recordingState: 'idle',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'meeting_start_button' }).props.disabled).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Transcribing…')).toBe(true);
  });

  it('explains that meeting summaries need the on-device writing helper', () => {
    useAppStore.setState({
      ...initialState,
      meetings: [],
      activeMeetingId: null,
      recordingState: 'idle',
      liteRtEnabled: true,
      selectedModelInstalled: false,
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'meeting_summary_setup_notice' })).toBeTruthy();
    expect(renderer.root.findAllByType(Text).some(node =>
      node.props.children === 'On-device AI summaries need the writing helper. Transcript highlights are generated automatically even when it is unavailable.',
    )).toBe(true);
  });

  it('shows automatic summary status without a manual create button', () => {
    const meeting = {
      id: 'meeting-summary-auto',
      revision: 1,
      title: 'Weekly planning',
      status: 'complete' as const,
      startedAt: 1_000,
      endedAt: 61_000,
      transcriptSavedAt: 62_000,
      transcriptionComplete: true,
      transcript: [{ id: 'segment-1', startMs: 0, endMs: 1_000, text: 'The team will prepare the release notes.' }],
      actions: [{ id: 'action-1', text: 'prepare the release notes', startMs: 0, confirmed: false, dismissed: false }],
    };
    useAppStore.setState({
      ...initialState,
      meetings: [meeting],
      activeMeetingId: null,
      recordingState: 'idle',
      liteRtEnabled: true,
      selectedModelInstalled: true,
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'meeting_history_meeting-summary-auto' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'meeting_summary_auto_notice' })).toBeTruthy();
    expect(renderer.root.findAll(node => node.props.label === 'Create summary and actions')).toHaveLength(0);
  });

  it('shows hours in meeting durations and transcript timestamps', () => {
    const meeting = {
      id: 'meeting-hour-format',
      revision: 1,
      title: 'Long planning session',
      status: 'complete' as const,
      startedAt: 1_000,
      endedAt: 3_662_000,
      transcriptSavedAt: 3_663_000,
      transcriptionComplete: true,
      transcript: [{ id: 'segment-hour', startMs: 3_661_000, endMs: 3_662_000, text: 'Closing remarks.' }],
      actions: [],
    };
    useAppStore.setState({
      ...initialState,
      meetings: [meeting],
      activeMeetingId: null,
      recordingState: 'idle',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'meeting_history_meeting-hour-format' }).props.onPress();
    });

    const visibleText = renderer.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children)
      .join(' ');
    expect(visibleText).toContain('01:01:01');
  });

  it('sends only the selected meeting section to the share handler', () => {
    const meeting = {
      id: 'meeting-share-test',
      revision: 1,
      title: 'Weekly planning',
      status: 'summarizing' as const,
      startedAt: 1_000,
      endedAt: 61_000,
      transcriptSavedAt: 62_000,
      transcriptionComplete: true,
      transcript: [{ id: 'segment-1', startMs: 12_000, endMs: 20_000, text: 'Please send the update.' }],
      summary: 'We agreed to ship the update.',
      summarySource: 'transcript' as const,
      actions: [{ id: 'action-1', text: 'Send the update', startMs: 12_000, confirmed: true, dismissed: false }],
    };
    const onShareMeeting = jest.fn();
    useAppStore.setState({
      ...initialState,
      meetings: [meeting],
      activeMeetingId: null,
      recordingState: 'idle',
      audioReadiness: { transcriptionReady: true, wakeWordReady: false, missingModels: [], errors: [] },
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={onShareMeeting}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });

    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'meeting_history_meeting-share-test' }).props.onPress();
    });

    const visibleText = renderer.root.findAllByType(Text)
      .map(node => Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children)
      .join(' ');
    expect(visibleText).toContain('Transcript highlights');
    expect(visibleText).toContain('Selected from recognized speech. Check names and details against the transcript.');

    for (const [testID, part] of [
      ['meeting_share_summary_button', 'summary'],
      ['meeting_share_transcript_button', 'transcript'],
      ['meeting_share_actions_button', 'actions'],
      ['meeting_share_all_button', 'all'],
    ] as const) {
      ReactTestRenderer.act(() => {
        renderer.root.findByProps({ testID }).props.onPress();
      });
      expect(onShareMeeting).toHaveBeenLastCalledWith(meeting, part);
    }
  });

  it('keeps action and full-content sharing available when transcript is empty', () => {
    const meeting = {
      id: 'meeting-content-only',
      revision: 1,
      title: 'Meeting content',
      status: 'complete' as const,
      startedAt: 1_000,
      endedAt: 2_000,
      transcriptionComplete: false,
      transcript: [],
      summary: '',
      actions: [{ id: 'action-1', text: 'Send the update', startMs: 0, confirmed: false, dismissed: false }],
    };
    useAppStore.setState({
      ...initialState,
      meetings: [meeting],
      activeMeetingId: null,
      recordingState: 'idle',
      loadMeetings: jest.fn(async () => undefined),
    });

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <MeetingScreen
          onBack={jest.fn()}
          onShareMeeting={jest.fn()}
          onShareMeetingWithAi={jest.fn()}
          onSaveMeetingToNotes={jest.fn(async () => undefined)}
        />,
      );
    });
    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'meeting_history_meeting-content-only' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'meeting_share_summary_button' }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: 'meeting_share_transcript_button' }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: 'meeting_share_actions_button' }).props.disabled).toBe(false);
    expect(renderer.root.findByProps({ testID: 'meeting_share_all_button' }).props.disabled).toBeFalsy();
  });
});
