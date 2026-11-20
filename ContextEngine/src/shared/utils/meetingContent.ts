export interface MeetingShareContent {
  title: string;
  startedAt: number;
  endedAt?: number;
  transcriptionComplete?: boolean;
  summary?: string;
  summarySource?: 'on-device' | 'transcript';
  transcript: Array<{ startMs: number; text: string }>;
  actions: Array<{
    text: string;
    startMs: number;
    confirmed: boolean;
    dismissed: boolean;
  }>;
}

export type MeetingSharePart = 'summary' | 'transcript' | 'actions' | 'all';

const clock = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const minutes = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0');
  const hours = Math.floor(totalSeconds / 3600);
  return hours ? `${String(hours).padStart(2, '0')}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
};

export const formatMeetingContent = (
  meeting: MeetingShareContent,
  part: MeetingSharePart = 'all',
): string => {
  const duration = Math.max(0, (meeting.endedAt ?? meeting.startedAt) - meeting.startedAt);
  const metadata = [
    `# ${meeting.title}`,
    `Started: ${new Date(meeting.startedAt).toLocaleString()}`,
    `Duration: ${clock(duration)}`,
  ];
  const actions = meeting.actions.length
    ? meeting.actions.map(action => {
        const state = action.dismissed ? 'dismissed' : action.confirmed ? 'kept' : 'needs review';
        return `- [${clock(action.startMs)}] [${state}] ${action.text}`;
      }).join('\n')
    : 'No suggested actions.';
  const transcript = meeting.transcript.length
    ? meeting.transcript.map(segment => `- [${clock(segment.startMs)}] ${segment.text}`).join('\n')
    : 'No transcript saved.';
  const summaryHeading = meeting.summarySource === 'transcript'
    ? '## Summary (transcript highlights)'
    : '## Summary';

  if (part === 'summary') {
    return [...metadata, '', summaryHeading, meeting.summary?.trim() || 'Not generated.'].join('\n');
  }
  if (part === 'actions') {
    return [...metadata, '', '## Suggested actions', actions].join('\n');
  }
  if (part === 'transcript') {
    return [
      ...metadata,
      `Transcript status: ${meeting.transcriptionComplete ? 'Complete' : 'Partial'}`,
      '',
      '## Transcript',
      transcript,
    ].join('\n');
  }

  return [
    ...metadata,
    `Transcript status: ${meeting.transcriptionComplete ? 'Complete' : 'Partial'}`,
    '',
    summaryHeading,
    meeting.summary?.trim() || 'Not generated.',
    '',
    '## Suggested actions',
    actions,
    '',
    '## Transcript',
    transcript,
  ].join('\n');
};
