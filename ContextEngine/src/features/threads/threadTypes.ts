export interface SourceCaptureView {
  id: string;
  noteId: string;
  typeLabel: 'VOICE NOTE' | 'TEXT NOTE' | 'PHOTO NOTE';
  timestampLabel: string;
  preview: string;
  sourceSectionHeader?: string;
  sourceNoteId?: string;
  sourceTranscript?: string;
  originalSourceTranscript?: string;
  sourceMetadata?: {
    audioFilePath?: string | null;
    transcriptionError?: string | null;
  };
  canDeleteRetainedAudio: boolean;
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
