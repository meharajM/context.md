export interface SourceCaptureView {
  id: string;
  noteId: string;
  typeLabel: 'VOICE NOTE' | 'TEXT ENTRY' | 'IMAGE OCR';
  timestampLabel: string;
  preview: string;
  sourceSectionHeader?: string;
  sourceNoteId?: string;
  sourceTranscript?: string;
  createdAt?: string;
  updatedAt?: string;
  icon: 'mic' | 'document' | 'image';
}

export interface ThreadDetailsView {
  id: string;
  title: string;
  summary: string;
  captures: SourceCaptureView[];
}
