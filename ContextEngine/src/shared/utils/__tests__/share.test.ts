import { Share } from 'react-native';

import { formatThreadContext, shareThreadWithAiPrompt } from '../share';
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
});
