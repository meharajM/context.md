import { Share } from 'react-native';

import { formatThreadContext, shareMeeting, shareMeetingWithAiPrompt, shareThreadWithAiPrompt } from '../share';
import type { ThreadDetailsView } from '../../../features/threads/threadTypes';

describe('share utilities', () => {
  const thread: ThreadDetailsView = {
    id: 'work-1',
    title: 'Work',
    summary: 'A short project summary.',
    captures: [
      {
        id: 'work-1-capture-0',
        noteId: 'work-note-1',
        typeLabel: 'VOICE NOTE',
        timestampLabel: 'Today, 10:00 AM',
        preview: 'Ship the roadmap update.',
        sourceTranscript: 'ship roadmap',
        canDeleteRetainedAudio: false,
        icon: 'mic',
      },
    ],
  };

  beforeEach(() => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats thread context for native sharing', () => {
    expect(formatThreadContext(thread)).toContain('# Work');
    expect(formatThreadContext(thread)).toContain('A short project summary.');
    expect(formatThreadContext(thread)).toContain('Ship the roadmap update.');
    expect(formatThreadContext(thread)).toContain('Words from recording: ship roadmap');
  });

  it('does not append typed note content as a recording transcript', () => {
    const textThread = {
      ...thread,
      captures: [{ ...thread.captures[0], typeLabel: 'TEXT NOTE' as const, icon: 'document' as const }],
    };
    expect(formatThreadContext(textThread)).not.toContain('Words from recording: ship roadmap');
  });

  it('shares an AI-oriented prompt through the native share sheet', async () => {
    await shareThreadWithAiPrompt(thread);

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Review Work',
        message: expect.stringContaining('Please review these notes'),
      }),
    );
  });

  it('shares the complete meeting text, including summary, transcript, and action review state', async () => {
    const meeting = {
      title: 'Weekly planning',
      startedAt: new Date(2026, 10, 8, 10).getTime(),
      endedAt: new Date(2026, 10, 8, 10, 1).getTime(),
      transcriptionComplete: true,
      summary: 'We agreed to ship the update.',
      summarySource: 'transcript' as const,
      transcript: [{ startMs: 12_000, text: 'Please send the update.' }],
      actions: [
        { text: 'Send the update', startMs: 12_000, confirmed: false, dismissed: false },
        { text: 'Close old issue', startMs: 30_000, confirmed: false, dismissed: true },
      ],
    };

    await shareMeeting(meeting);

    const sharedMessage = (Share.share as jest.Mock).mock.calls[0][0].message;
    expect(sharedMessage).toContain('We agreed to ship the update.');
    expect(sharedMessage).toContain('## Summary (transcript highlights)');
    expect(sharedMessage).toContain('[00:12] Please send the update.');
    expect(sharedMessage).toContain('[needs review] Send the update');
    expect(sharedMessage).toContain('[dismissed] Close old issue');
  });

  it('shares a meeting with an assistant prompt and the full meeting content', async () => {
    await shareMeetingWithAiPrompt({
      title: 'Weekly planning',
      startedAt: 1_000,
      endedAt: 2_000,
      transcriptionComplete: true,
      summary: 'Short summary.',
      transcript: [{ startMs: 0, text: 'Meeting transcript.' }],
      actions: [],
    });

    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Review Weekly planning',
      message: expect.stringContaining('Please review this meeting'),
    }));
    expect((Share.share as jest.Mock).mock.calls[0][0].message).toContain('Meeting transcript.');
  });

  it('shares summary, transcript, or action items without including the other sections', async () => {
    const meeting = {
      title: 'Weekly planning',
      startedAt: new Date(2026, 10, 8, 10).getTime(),
      endedAt: new Date(2026, 10, 8, 10, 1).getTime(),
      transcriptionComplete: true,
      summary: 'We agreed to ship the update.',
      transcript: [{ startMs: 12_000, text: 'Please send the update.' }],
      actions: [{ text: 'Send the update', startMs: 12_000, confirmed: true, dismissed: false }],
    };

    await shareMeeting(meeting, 'summary');
    await shareMeeting(meeting, 'transcript');
    await shareMeeting(meeting, 'actions');

    const messages = (Share.share as jest.Mock).mock.calls.map(call => call[0].message as string);
    expect(messages[0]).toContain('We agreed to ship the update.');
    expect(messages[0]).not.toContain('Please send the update.');
    expect(messages[0]).not.toContain('Send the update');
    expect(messages[1]).toContain('[00:12] Please send the update.');
    expect(messages[1]).not.toContain('We agreed to ship the update.');
    expect(messages[1]).not.toContain('Send the update');
    expect(messages[2]).toContain('[kept] Send the update');
    expect(messages[2]).not.toContain('We agreed to ship the update.');
    expect(messages[2]).not.toContain('Please send the update.');
  });
});
