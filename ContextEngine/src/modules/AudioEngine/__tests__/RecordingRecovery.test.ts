import { Buffer } from 'buffer';

jest.mock('react-native-fs', () => {
  const files = new Map<string, string>();
  return {
    DocumentDirectoryPath: '/documents',
    __files: files,
    mkdir: jest.fn(async () => undefined),
    exists: jest.fn(async (path: string) => files.has(path) || path === '/documents/retained-audio'),
    writeFile: jest.fn(async (path: string, data: string) => { files.set(path, data); }),
    moveFile: jest.fn(async (from: string, to: string) => {
      const content = files.get(from);
      if (content === undefined) throw new Error('missing staged file');
      files.set(to, content);
      files.delete(from);
    }),
    readFile: jest.fn(async (path: string) => files.get(path)),
    stat: jest.fn(async (path: string) => ({ size: path.endsWith('.json')
      ? files.get(path)!.length : require('buffer').Buffer.from(files.get(path), 'base64').length })),
    read: jest.fn(async (path: string, length: number) => require('buffer').Buffer.from(files.get(path), 'base64').subarray(0, length).toString('base64')),
    write: jest.fn(async (path: string, data: string) => {
      const { Buffer: NativeBuffer } = require('buffer');
      const wav = NativeBuffer.from(files.get(path), 'base64');
      NativeBuffer.from(data, 'base64').copy(wav);
      files.set(path, wav.toString('base64'));
    }),
    unlink: jest.fn(async (path: string) => { files.delete(path); }),
    readDir: jest.fn(async () => [...files.keys()].map(path => ({ path, name: path.split('/').pop() }))),
  };
});

jest.mock('../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter', () => ({ AudioPcmStreamAdapter: jest.fn() }));
jest.mock('../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter', () => ({ WavFileWriter: jest.fn() }));
jest.mock('../../../../node_modules/whisper.rn/lib/module/index', () => ({ initWhisper: jest.fn() }));

import RNFS from 'react-native-fs';
import { describeRecording, recordingNoteId, repairRecordingHeader } from '../../../shared/audio/recordingRecovery';
import { AudioEngineImpl } from '../AudioEngineImpl';

const files = (RNFS as any).__files as Map<string, string>;
const audioPath = '/documents/retained-audio/contextengine-retained-process-death.wav';
const descriptorPath = `${audioPath}.capture.json`;
const wavWithStaleHeader = () => {
  const wav = Buffer.alloc(52);
  wav.write('RIFF'); wav.writeUInt32LE(36, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.fill(25, 44);
  return wav;
};

describe('durable recording recovery', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    files.clear();
    await describeRecording(audioPath);
    files.set(audioPath, wavWithStaleHeader().toString('base64'));
  });

  it('recovers process death with stable identity, repairs actual flushed length and acknowledges after Inbox save', async () => {
    const engineAfterRelaunch = new AudioEngineImpl();
    const onRetained = jest.fn(async (path: string, noteId?: string) => {
      expect(path).toBe(audioPath);
      expect(noteId).toBe(recordingNoteId(audioPath));
      expect(files.has(descriptorPath)).toBe(true);
      const wav = Buffer.from(files.get(path)!, 'base64');
      expect(wav.readUInt32LE(4)).toBe(44);
      expect(wav.readUInt32LE(40)).toBe(8);
      expect([...wav.subarray(44)]).toEqual(Array(8).fill(25));
    });
    await expect(engineAfterRelaunch.recoverInterruptedRecordings(onRetained)).resolves.toBe(1);
    expect(files.has(descriptorPath)).toBe(false);
    expect(files.has(audioPath)).toBe(true);
    await expect(engineAfterRelaunch.recoverInterruptedRecordings(onRetained)).resolves.toBe(0);
    expect(onRetained).toHaveBeenCalledTimes(1);
    expect(RNFS.read).toHaveBeenCalledWith(audioPath, 44, 0, 'base64');
    expect(RNFS.write).toHaveBeenCalledWith(audioPath, expect.any(String), 0, 'base64');
  });

  it('atomically stages recovery metadata and recovers a legacy torn descriptor from the validated WAV path', async () => {
    expect(files.has(descriptorPath)).toBe(true);
    expect(files.has(`${descriptorPath}.tmp`)).toBe(false);
    expect(RNFS.moveFile).toHaveBeenCalledWith(`${descriptorPath}.tmp`, descriptorPath);

    files.set(descriptorPath, '{"version":1');
    const onRetained = jest.fn(async () => undefined);
    await expect(new AudioEngineImpl().recoverInterruptedRecordings(onRetained)).resolves.toBe(1);
    expect(onRetained).toHaveBeenCalledWith(audioPath, recordingNoteId(audioPath));
    expect(files.has(descriptorPath)).toBe(false);
    expect(files.has(audioPath)).toBe(true);
  });

  it('serializes simultaneous startup recoveries and skips a live capture', async () => {
    const engine = new AudioEngineImpl();
    const onRetained = jest.fn(async () => undefined);
    await Promise.all([engine.recoverInterruptedRecordings(onRetained), engine.recoverInterruptedRecordings(onRetained)]);
    expect(onRetained).toHaveBeenCalledTimes(1);
    await describeRecording(audioPath);
    (engine as any).isRecording = true;
    await expect(engine.recoverInterruptedRecordings(onRetained)).resolves.toBe(0);
    expect(files.has(descriptorPath)).toBe(true);
  });

  it('keeps descriptor and only WAV when durable Inbox retention fails', async () => {
    const engine = new AudioEngineImpl();
    await expect(engine.recoverInterruptedRecordings(async () => { throw new Error('Inbox disk full'); })).rejects.toThrow('Inbox disk full');
    expect(files.has(descriptorPath)).toBe(true);
    expect(files.has(audioPath)).toBe(true);
    const onRetained = jest.fn(async () => undefined);
    await expect(engine.recoverInterruptedRecordings(onRetained)).resolves.toBe(1);
    expect(onRetained).toHaveBeenCalledWith(audioPath, recordingNoteId(audioPath));
  });

  it('retries interrupted acknowledgement with the same Inbox identity', async () => {
    (RNFS.unlink as jest.Mock).mockRejectedValueOnce(new Error('ack failed'));
    const ids = new Set<string>();
    const onRetained = jest.fn(async (_path: string, noteId?: string) => { ids.add(noteId!); });
    await expect(new AudioEngineImpl().recoverInterruptedRecordings(onRetained)).rejects.toThrow('ack failed');
    await expect(new AudioEngineImpl().recoverInterruptedRecordings(onRetained)).resolves.toBe(1);
    expect(ids.size).toBe(1);
    expect(onRetained).toHaveBeenCalledTimes(2);
  });

  it('preserves bytes and descriptor if header repair fails', async () => {
    (RNFS.write as jest.Mock).mockRejectedValueOnce(new Error('header disk full'));
    const before = files.get(audioPath);
    const onRetained = jest.fn();
    await expect(new AudioEngineImpl().recoverInterruptedRecordings(onRetained)).rejects.toThrow('header disk full');
    expect(onRetained).not.toHaveBeenCalled();
    expect(files.get(audioPath)).toBe(before);
    expect(files.has(descriptorPath)).toBe(true);
  });

  it('ignores tampered descriptor paths and recovers only the validated WAV path', async () => {
    const descriptor = JSON.parse(files.get(descriptorPath)!);
    files.set(descriptorPath, JSON.stringify({ ...descriptor, audioPath: '/documents/private.wav' }));
    const onRetained = jest.fn();
    await expect(new AudioEngineImpl().recoverInterruptedRecordings(onRetained)).resolves.toBe(1);
    expect(onRetained).toHaveBeenCalledWith(audioPath, recordingNoteId(audioPath));
    expect(RNFS.write).toHaveBeenCalledWith(audioPath, expect.any(String), 0, 'base64');
    expect(RNFS.read).toHaveBeenCalledWith(audioPath, 44, 0, 'base64');
  });

  it('rejects wrong sample format without changing original bytes', async () => {
    const wav = wavWithStaleHeader();
    wav.writeUInt32LE(48000, 24);
    files.set(audioPath, wav.toString('base64'));
    await expect(repairRecordingHeader(audioPath)).rejects.toThrow('PCM format is invalid');
    expect(files.get(audioPath)).toBe(wav.toString('base64'));
    expect(RNFS.write).not.toHaveBeenCalled();
  });

  it('repairs flushed partial audio when normal stop rejects before writer finalization', async () => {
    const engine = new AudioEngineImpl() as any;
    engine.isRecording = true;
    engine.currentAudioFilePath = audioPath;
    engine.currentAudioStream = { stop: jest.fn(async () => { throw new Error('reader died'); }), release: jest.fn() };
    engine.currentWavWriter = { finalize: jest.fn() };
    const onRetained = jest.fn(async () => undefined);
    const result = await engine.stopRecording(onRetained);
    expect(result).toEqual({ text: '', error: 'reader died', audioFilePath: audioPath });
    expect(Buffer.from(files.get(audioPath)!, 'base64').readUInt32LE(40)).toBe(8);
    expect(onRetained).toHaveBeenCalledWith(audioPath, recordingNoteId(audioPath));
    expect(files.has(audioPath)).toBe(true);
  });
});
