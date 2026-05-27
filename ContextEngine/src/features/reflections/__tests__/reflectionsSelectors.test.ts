import { selectRecentThreads } from '../reflectionsSelectors';
import type { ContextSection } from '../../../modules/ContextManager';

describe('selectRecentThreads', () => {
  it('keeps source metadata out of recent thread previews', () => {
    const sections: ContextSection[] = [
      {
        header: 'Test Recording',
        content: `
- [2026-05-26T10:30:00.000Z] This recording pertains specifically as test recording.
  Source kind: VOICE
  Source transcript: 1 2 3 testing testing 1 2 3
        `.trim(),
      },
    ];

    const [thread] = selectRecentThreads(sections);

    expect(thread.preview).toBe('This recording pertains specifically as test recording.');
    expect(thread.preview).not.toContain('Source kind');
    expect(thread.preview).not.toContain('Source transcript');
  });
});
