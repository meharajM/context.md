import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import { isAppOwnedCaptureAudioPath, isAppOwnedRetainedAudioPath, RETAINED_AUDIO_DIRECTORY } from './retainedAudio';

export type RetainedRecordingCallback = (audioFilePath: string, noteId?: string) => Promise<void>;
const DESCRIPTOR_SUFFIX = '.capture.json';
export const RECORDING_PCM_FORMAT = { sampleRate: 16000, channels: 1, bitsPerSample: 16 } as const;

export const recordingNoteId = (audioPath: string): string =>
  `voice-retained-${audioPath.slice(audioPath.lastIndexOf('/') + 1).replace(/^contextengine-retained-/, '').replace(/\.wav$/, '')}`;

export async function describeRecording(audioPath: string): Promise<void> {
  if (!isAppOwnedRetainedAudioPath(audioPath)) throw new Error('Recording is outside durable audio storage');
  await RNFS.mkdir(RETAINED_AUDIO_DIRECTORY);
  const descriptorPath = `${audioPath}${DESCRIPTOR_SUFFIX}`;
  const temporaryPath = `${descriptorPath}.tmp`;
  await RNFS.writeFile(temporaryPath, JSON.stringify({
    version: 1,
    noteId: recordingNoteId(audioPath),
    audioPath,
    ...RECORDING_PCM_FORMAT,
  }), 'utf8');
  try {
    await RNFS.moveFile(temporaryPath, descriptorPath);
  } catch (error) {
    await RNFS.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

/** Repair only the header; a rejected append may still have flushed bytes to disk. */
export async function repairRecordingHeader(audioPath: string): Promise<void> {
  if (!isAppOwnedCaptureAudioPath(audioPath)) throw new Error('Recording is outside app-owned capture storage');
  const size = Number((await RNFS.stat(audioPath)).size);
  if (!Number.isSafeInteger(size) || size < 44 || size - 8 > 0xffffffff || (size - 44) % 2 !== 0) {
    throw new Error('Recording has an incomplete PCM frame or invalid WAV length; original audio preserved');
  }
  const header = Buffer.from(await RNFS.read(audioPath, 44, 0, 'base64'), 'base64');
  if (header.length !== 44 || header.toString('ascii', 0, 4) !== 'RIFF' ||
      header.toString('ascii', 8, 16) !== 'WAVEfmt ' || header.readUInt32LE(16) !== 16 ||
      header.readUInt16LE(20) !== 1 || header.readUInt16LE(22) !== 1 ||
      header.readUInt32LE(24) !== 16000 || header.readUInt32LE(28) !== 32000 ||
      header.readUInt16LE(32) !== 2 || header.readUInt16LE(34) !== 16 ||
      header.toString('ascii', 36, 40) !== 'data') {
    throw new Error('Recording PCM format is invalid; original audio preserved');
  }
  header.writeUInt32LE(size - 8, 4);
  header.writeUInt32LE(size - 44, 40);
  await RNFS.write(audioPath, header.toString('base64'), 0, 'base64');
}

export async function acknowledgeRecording(audioPath: string): Promise<void> {
  const descriptorPath = `${audioPath}${DESCRIPTOR_SUFFIX}`;
  if (await RNFS.exists(descriptorPath)) await RNFS.unlink(descriptorPath);
}

export async function recoverRecordings(onRetained: RetainedRecordingCallback): Promise<number> {
  if (!(await RNFS.exists(RETAINED_AUDIO_DIRECTORY))) return 0;
  let recovered = 0;
  const errors: string[] = [];
  for (const entry of await RNFS.readDir(RETAINED_AUDIO_DIRECTORY)) {
    if (!entry.name.endsWith(DESCRIPTOR_SUFFIX)) continue;
    const audioPath = `${RETAINED_AUDIO_DIRECTORY}/${entry.name.slice(0, -DESCRIPTOR_SUFFIX.length)}`;
    try {
      if (!isAppOwnedRetainedAudioPath(audioPath)) {
        throw new Error('Invalid recording recovery descriptor');
      }
      const descriptorSize = Number((await RNFS.stat(entry.path)).size);
      let descriptorIsValid = false;
      let noteId = recordingNoteId(audioPath);
      if (descriptorSize <= 4096) {
        try {
          const descriptor = JSON.parse(await RNFS.readFile(entry.path, 'utf8'));
          descriptorIsValid = descriptor.version === 1 && descriptor.audioPath === audioPath &&
            descriptor.noteId === recordingNoteId(audioPath) && descriptor.sampleRate === 16000 &&
            descriptor.channels === 1 && descriptor.bitsPerSample === 16;
          if (descriptorIsValid) noteId = descriptor.noteId;
        } catch {
          // A legacy descriptor may have been torn while it was written directly to its final path.
        }
      }
      if (!descriptorIsValid) console.warn('[AudioEngine] Recovering from an invalid recording descriptor:', entry.name);
      // Startup may have failed before the WAV was created; no recording exists yet.
      if (!(await RNFS.exists(audioPath))) {
        await acknowledgeRecording(audioPath);
        continue;
      }
      await repairRecordingHeader(audioPath);
      if (Number((await RNFS.stat(audioPath)).size) === 44) {
        await acknowledgeRecording(audioPath);
        await RNFS.unlink(audioPath);
        continue;
      }
      await onRetained(audioPath, noteId);
      // A crash before acknowledgement retries the same stable Inbox identity.
      await acknowledgeRecording(audioPath);
      recovered += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length) throw new Error(`Recording recovery incomplete: ${errors.join('; ')}`);
  return recovered;
}
