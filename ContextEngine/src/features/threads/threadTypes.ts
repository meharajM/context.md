export interface SourceCaptureView {
  id: string;
  typeLabel: 'VOICE NOTE' | 'TEXT ENTRY' | 'IMAGE OCR';
  timestampLabel: string;
  preview: string;
  sourceTranscript?: string;
  icon: 'mic' | 'document' | 'image';
}

export interface ThreadDetailsView {
  id: string;
  title: string;
  summary: string;
  captures: SourceCaptureView[];
}
