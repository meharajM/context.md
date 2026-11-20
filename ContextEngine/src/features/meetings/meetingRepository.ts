import RNFS from 'react-native-fs';
import { createNoteId } from '../../shared/notes/noteTypes';
import type { MeetingSession } from './meetingTypes';

const DIRECTORY = RNFS.DocumentDirectoryPath + '/meetings';
let writes: Promise<unknown> = Promise.resolve();

const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = writes.then(operation);
  writes = result.catch(() => undefined);
  return result;
};

const sessionPaths = (id: string) => [0, 1].map(slot => DIRECTORY + '/' + id + '-' + slot + '.json');

function isMeetingSession(value: unknown): value is MeetingSession {
  const meeting = value as MeetingSession | null;
  return Boolean(meeting && typeof meeting.id === 'string' && /^meeting-[a-z0-9-]+$/i.test(meeting.id) &&
    Number.isSafeInteger(meeting.revision) && meeting.revision >= 0 && typeof meeting.title === 'string' &&
    ['recording', 'summarizing', 'complete', 'error', 'interrupted'].includes(meeting.status) &&
    Number.isSafeInteger(meeting.startedAt) &&
    (meeting.endedAt === undefined || Number.isSafeInteger(meeting.endedAt)) &&
    (meeting.transcriptSavedAt === undefined || Number.isSafeInteger(meeting.transcriptSavedAt)) &&
    (meeting.transcriptionComplete === undefined || typeof meeting.transcriptionComplete === 'boolean') &&
    (meeting.summarySource === undefined || ['on-device', 'transcript'].includes(meeting.summarySource)) &&
    (meeting.savedNoteId === undefined || typeof meeting.savedNoteId === 'string') &&
    (meeting.deleteAudioAt === undefined || Number.isSafeInteger(meeting.deleteAudioAt)) &&
    Array.isArray(meeting.transcript) &&
    meeting.transcript.every(segment => typeof segment.id === 'string' &&
      Number.isFinite(segment.startMs) && segment.startMs >= 0 &&
      Number.isFinite(segment.endMs) && segment.endMs >= segment.startMs && typeof segment.text === 'string') &&
    Array.isArray(meeting.actions) && meeting.actions.every(action => typeof action.id === 'string' &&
      typeof action.text === 'string' && Number.isFinite(action.startMs) && action.startMs >= 0 &&
      typeof action.confirmed === 'boolean' && typeof action.dismissed === 'boolean'));
}

async function readSession(id: string): Promise<MeetingSession | null> {
  const records: MeetingSession[] = [];
  for (const path of sessionPaths(id)) {
    if (!(await RNFS.exists(path))) continue;
    try {
      const value = JSON.parse(await RNFS.readFile(path, 'utf8'));
      if (isMeetingSession(value) && value.id === id) records.push(value);
    } catch {
      // The other slot remains available after an interrupted write.
    }
  }
  return records.sort((a, b) => b.revision - a.revision)[0] ?? null;
}

async function writeSession(session: MeetingSession): Promise<MeetingSession> {
  await RNFS.mkdir(DIRECTORY);
  const next = { ...session, revision: session.revision + 1 };
  await RNFS.writeFile(sessionPaths(next.id)[next.revision % 2], JSON.stringify(next), 'utf8');
  return next;
}

export function createMeeting(title?: string): Promise<MeetingSession> {
  return serialize(async () => {
    const startedAt = Date.now();
    return writeSession({
      id: createNoteId('meeting'),
      revision: -1,
      title: title?.trim() || 'Meeting ' + new Date(startedAt).toLocaleString(),
      status: 'recording',
      startedAt,
      transcript: [],
      actions: [],
    });
  });
}

export function updateMeeting(
  id: string,
  update: (session: MeetingSession) => MeetingSession,
): Promise<MeetingSession | null> {
  if (!/^meeting-[a-z0-9-]+$/i.test(id)) return Promise.reject(new Error('Invalid meeting identity'));
  return serialize(async () => {
    const current = await readSession(id);
    if (!current) return null;
    const updated = update(current);
    if (updated.id !== id) throw new Error('Meeting identity cannot change');
    return writeSession(updated);
  });
}

export async function listMeetings(): Promise<MeetingSession[]> {
  await writes;
  if (!(await RNFS.exists(DIRECTORY))) return [];
  const ids = new Set((await RNFS.readDir(DIRECTORY))
    .map(entry => /^(.+)-[01]\.json$/.exec(entry.name)?.[1])
    .filter((id): id is string => Boolean(id)));
  const meetings = await Promise.all([...ids].map(readSession));
  return meetings.filter((meeting): meeting is MeetingSession => Boolean(meeting))
    .sort((a, b) => b.startedAt - a.startedAt);
}
