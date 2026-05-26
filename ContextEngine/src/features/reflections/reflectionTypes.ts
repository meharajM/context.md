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
