export type RecentThreadIcon = 'document' | 'reflections' | 'spark';

export interface RecentThreadView {
  id: string;
  title: string;
  preview: string;
  noteCountLabel: string;
  updatedAtLabel: string;
  icon: RecentThreadIcon;
  sourceContent: string;
}

export interface NoteSearchResult {
  id: string;
  threadId: string;
  topic: string;
  text: string;
  dateLabel: string;
}
