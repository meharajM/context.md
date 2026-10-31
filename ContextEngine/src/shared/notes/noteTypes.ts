export type NoteSourceKind = 'voice' | 'text' | 'image';

export interface NoteSourceMetadata {
  kind?: NoteSourceKind;
  transcript?: string;
  summary?: string;
  noteId?: string;
  sectionHeader?: string;
  text?: string;
  audioFilePath?: string | null;
  transcriptionError?: string | null;
}

export interface NoteIdentity {
  noteId: string;
}

export const createNoteId = (prefix = 'note'): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeNoteSourceKind = (kind?: string | null): NoteSourceKind | undefined => {
  const normalized = kind?.trim().toLowerCase();
  if (normalized === 'voice' || normalized === 'text' || normalized === 'image') {
    return normalized;
  }

  return undefined;
};

export const newestNotesFirst = <T extends { createdAt?: string; updatedAt?: string }>(notes: readonly T[]): T[] =>
  [...notes].reverse().sort((a, b) =>
    (Date.parse(b.updatedAt ?? b.createdAt ?? '') || 0) - (Date.parse(a.updatedAt ?? a.createdAt ?? '') || 0),
  );
