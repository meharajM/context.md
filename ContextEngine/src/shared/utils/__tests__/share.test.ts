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
        typeLabel: 'TEXT ENTRY',
        timestampLabel: 'Today, 10:00 AM',
        preview: 'Ship the roadmap update.',
        sourceTranscript: 'ship roadmap',
        icon: 'document',
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
    expect(formatThreadContext(thread)).toContain('Source transcript: ship roadmap');
  });

  it('shares an AI-oriented prompt through the native share sheet', async () => {
    await shareThreadWithAiPrompt(thread);

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Analyze Work',
        message: expect.stringContaining('Analyze this local ContextEngine thread'),
      }),
    );
  });
});
