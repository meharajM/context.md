import type { ContextSection } from '../../modules/ContextManager';
import { formatSectionPreview } from '../../ui/design';
import type { RecentThreadIcon, RecentThreadView } from './reflectionTypes';

const THREAD_ICONS: RecentThreadIcon[] = ['reflections', 'document', 'spark'];

export function selectRecentThreads(sections: ContextSection[]): RecentThreadView[] {
  return sections.slice(0, 4).map((section, index) => {
    const noteCount = countNotes(section.content);
    const timestamp = extractLatestTimestamp(section.content);

    return {
      id: buildThreadId(section.header, index),
      title: section.header,
      preview: formatSectionPreview(section.content),
      noteCountLabel: `${noteCount} note${noteCount === 1 ? '' : 's'}`,
      updatedAtLabel: formatUpdatedAtLabel(timestamp),
      icon: THREAD_ICONS[index % THREAD_ICONS.length],
      sourceContent: section.content,
    };
  });
}

function buildThreadId(header: string, index: number): string {
  const slug = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `${slug}-${index}` : `thread-${index}`;
}

function countNotes(content: string): number {
  const matches = content.match(/^\s*-\s+/gm);
  return matches?.length ?? 1;
}

function extractLatestTimestamp(content: string): string | null {
  const matches = [...content.matchAll(/\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]/g)];
  return matches.length > 0 ? matches[matches.length - 1]?.[1] ?? null : null;
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
