import { selectNoteSearchResults, selectRecentThreads } from '../reflectionsSelectors';
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

it('derives previews and counts from decoded multiline notes', () => {
  const section = {
    header: 'Multiline',
    content: '- [2026-10-24T10:00:00.000Z] <!-- thought-note:v2 {"noteId":"multi-note","createdAt":"2026-10-24T10:00:00.000Z"} -->\n  | First line\n  | \n  | - [2020-01-01] literal bullet\n  | Note id: literal text\n  <!-- /thought-note -->',
  };
  const thread = selectRecentThreads([section])[0];
  expect(thread.noteCountLabel).toBe('1 note');
  expect(thread.preview).toBe('First line - [2020-01-01] literal bullet Note id: literal text');
  expect(thread.preview).not.toContain('thought-note:v2');
  expect(selectNoteSearchResults([section], 'literal bullet')[0].id).toBe('multi-note');
});

describe('selectNoteSearchResults', () => {
  const sections: ContextSection[] = [{
    header: 'Project Atlas',
    content: [
      '- [2026-05-26T10:30:00.000Z] Prepare the client review notes.',
      '  Note id: atlas-review',
      '  Source kind: VOICE',
      '  Source transcript: ask Dana about launch timing',
      '- [2026-05-25T10:30:00.000Z] Book a quiet room.',
      '  Note id: room-booking',
    ].join('\n'),
  }];

  it('matches note text, source transcript, and topic names case-insensitively', () => {
    expect(selectNoteSearchResults(sections, '  CLIENT REVIEW  ').map(result => result.id)).toEqual(['atlas-review']);
    expect(selectNoteSearchResults(sections, 'launch timing').map(result => result.id)).toEqual(['atlas-review']);
    expect(selectNoteSearchResults(sections, 'atlas')).toHaveLength(2);
  });

  it('returns no results for an empty or unmatched query and links results to their topic', () => {
    expect(selectNoteSearchResults(sections, '   ')).toEqual([]);
    expect(selectNoteSearchResults(sections, 'no such note')).toEqual([]);
    expect(selectNoteSearchResults(sections, 'quiet room')[0]).toMatchObject({
      threadId: 'topic:Project%20Atlas',
      topic: 'Project Atlas',
      text: 'Book a quiet room.',
    });
  });
});


describe('topic identity', () => {
  it('keeps exact topics and search targets stable across reordering without slug collisions', () => {
    const sections = ['Work!', 'Work?', '工作'].map((header, index) => ({
      header,
      content: `- [2026-05-27T10:00:00.000Z] launch ${index}\n  Note id: note-${index}`,
    }));
    const initial = selectRecentThreads(sections);
    const reordered = selectRecentThreads([...sections].reverse());
    expect(new Set(initial.map(thread => thread.id)).size).toBe(3);
    for (const thread of initial) {
      expect(reordered.find(item => item.title === thread.title)?.id).toBe(thread.id);
      expect(selectNoteSearchResults([...sections].reverse(), thread.title)[0].threadId).toBe(thread.id);
    }
  });

  it('keeps generated legacy note IDs compatible when topic position changes', () => {
    const topic = { header: 'Legacy Work', content: '- Old note' };
    const initial = selectNoteSearchResults([topic], 'Old note')[0];
    const reordered = selectNoteSearchResults([{ header: 'Inbox', content: '- Other' }, topic], 'Old note')[0];
    expect(reordered).toMatchObject({ id: initial.id, threadId: initial.threadId });
    expect(initial.id).toBe('legacy-work-0');
  });
});
