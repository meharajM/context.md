import { extractMeetingHighlights } from '../meetingSummary';

describe('extractMeetingHighlights', () => {
  it('skips sound labels and duplicate text while sampling the transcript', () => {
    expect(extractMeetingHighlights([
      { id: '1', startMs: 0, endMs: 1, text: '[Sound Effects]' },
      { id: '2', startMs: 1, endMs: 2, text: 'The team agreed to send the proposal by Friday.' },
      { id: '3', startMs: 2, endMs: 3, text: 'Plan the weekly review and confirm the owner.' },
      { id: '4', startMs: 3, endMs: 4, text: '(water splashing)' },
      { id: '5', startMs: 4, endMs: 5, text: 'Prepare launch notes before the Monday review.' },
      { id: '6', startMs: 5, endMs: 6, text: 'We will share the customer update after approval.' },
      { id: '7', startMs: 6, endMs: 7, text: 'Close by reviewing the pending risks before launch.' },
      { id: '8', startMs: 7, endMs: 8, text: 'The team agreed to send the proposal by Friday.' },
    ])).toBe('The team agreed to send the proposal by Friday. Prepare launch notes before the Monday review. Close by reviewing the pending risks before launch.');
  });

  it('returns no fallback for audio labels and short fragments alone', () => {
    expect(extractMeetingHighlights([
      { id: '1', startMs: 0, endMs: 1, text: '[Sound Effects]' },
      { id: '2', startMs: 1, endMs: 2, text: '(mumbling)' },
      { id: '3', startMs: 2, endMs: 3, text: 'Ready?' },
    ])).toBeUndefined();
  });

  it('bounds highlight text for long transcripts', () => {
    expect(extractMeetingHighlights([
      { id: '1', startMs: 0, endMs: 1, text: `We agreed to review this plan ${'carefully '.repeat(100)}.` },
    ])?.length).toBeLessThanOrEqual(600);
  });
});
