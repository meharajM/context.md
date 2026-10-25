import { ContextManager, type ContextSection } from '../../modules/ContextManager';
import type { NoteSearchResult, RecentThreadIcon, RecentThreadView } from './reflectionTypes';

const THREAD_ICONS: RecentThreadIcon[] = ['reflections', 'document', 'spark'];

export function selectRecentThreads(sections: ContextSection[]): RecentThreadView[] {
  return sections.map((section, index) => {
    const notes = ContextManager.getThoughtsFromSection(section);
    const noteCount = notes.length;
    const lastNote = notes[notes.length - 1];
    const timestamp = lastNote?.updatedAt ?? lastNote?.createdAt ?? null;
    const preview = notes.map(note => note.text).join(' ').trim().replace(/\s+/g, ' ');

    return {
      id: buildThreadId(section.header),
      title: section.header,
      preview: preview.length > 140 ? `${preview.slice(0, 140).trimEnd()}…` : preview || 'No captured details yet.',
      noteCountLabel: `${noteCount} note${noteCount === 1 ? '' : 's'}`,
      updatedAtLabel: formatUpdatedAtLabel(timestamp),
      icon: THREAD_ICONS[index % THREAD_ICONS.length],
      sourceContent: section.content,
    };
  });
}

export function selectNoteSearchResults(sections: ContextSection[], query: string): NoteSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  return sections.flatMap(section =>
    ContextManager.getThoughtsFromSection(section)
      .filter(note => [section.header, note.text, note.sourceTranscript ?? '']
        .some(value => value.toLocaleLowerCase().includes(normalizedQuery)))
      .map(note => {
        const queryMatchedNote = note.text.toLocaleLowerCase().includes(normalizedQuery);
        const queryMatchedTopic = section.header.toLocaleLowerCase().includes(normalizedQuery);
        return {
          id: note.noteId,
          threadId: buildThreadId(section.header),
          topic: section.header,
          text: queryMatchedNote || queryMatchedTopic ? note.text : note.sourceTranscript ?? note.text,
          dateLabel: formatUpdatedAtLabel(note.createdAt ?? null),
        };
      }),
  ).slice(0, 50);
}

function buildThreadId(header: string): string {
  return `topic:${encodeURIComponent(header)}`;
}

function formatUpdatedAtLabel(timestamp: string | null): string {
  if (!timestamp) {
    return 'Recently';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  const now = new Date();
  if (sameDay(now, date)) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(yesterday, date)) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
