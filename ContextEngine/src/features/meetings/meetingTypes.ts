import type { MeetingRetention } from '../../core/appPreferences';

export type { MeetingRetention } from '../../core/appPreferences';

export interface MeetingTranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface MeetingActionSuggestion {
  id: string;
  text: string;
  startMs: number;
  confirmed: boolean;
  dismissed: boolean;
}

export type MeetingSummarySource = 'on-device' | 'transcript';

export interface MeetingSession {
  id: string;
  revision: number;
  title: string;
  status: 'recording' | 'summarizing' | 'complete' | 'error' | 'interrupted';
  startedAt: number;
  endedAt?: number;
  transcriptSavedAt?: number;
  transcriptionComplete?: boolean;
  transcript: MeetingTranscriptSegment[];
  summary?: string;
  summarySource?: MeetingSummarySource;
  actions: MeetingActionSuggestion[];
  savedNoteId?: string;
  audioFilePath?: string;
  deleteAudioAt?: number;
  error?: string;
}

export const meetingAudioRetentionMs = (retention: MeetingRetention): number | null => {
  if (retention === '5m') return 5 * 60 * 1000;
  if (retention === '1h') return 60 * 60 * 1000;
  if (retention === '1d') return 24 * 60 * 60 * 1000;
  return null;
};
