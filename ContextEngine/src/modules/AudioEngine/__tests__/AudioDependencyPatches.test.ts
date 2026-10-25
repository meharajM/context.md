import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { Buffer } from 'buffer';
import vm from 'vm';

const root = path.resolve(__dirname, '../../../..');
const pcmNative = 'node_modules/@fugood/react-native-audio-pcm-stream/android/src/main/java/com/imxiqi/rnliveaudiostream/RNLiveAudioStreamModule.java';
const pcmJs = 'node_modules/@fugood/react-native-audio-pcm-stream/index.js';
const adapterJs = 'node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter.js';
const wavJs = 'node_modules/whisper.rn/lib/module/utils/WavFileWriter.js';

const loadClass = (relativePath: string, injectedNames: string[], injectedValues: unknown[], name: string) => {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export class ', 'class ');
  // Execute the installed, postinstall-patched dependency, including its actual awaits.
  const factory = vm.runInNewContext(
    `(function(${injectedNames.join(', ')}) {\n${source}\nreturn ${name};\n})`,
    { Error },
  );
  return factory(...injectedValues);
};

describe('versioned audio dependency patches', () => {
  it('remains identical after applying both patches twice', () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'contextengine-audio-patch-'));
    const files = [pcmNative, pcmJs, adapterJs, wavJs];
    try {
      for (const relative of [...files, 'scripts/patch-rn-audio-pcm-stream.js', 'scripts/patch-rn-wav-writer.js']) {
        const target = path.join(fixtureRoot, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, relative), target);
      }
      const apply = () => {
        execFileSync(process.execPath, [path.join(fixtureRoot, 'scripts/patch-rn-audio-pcm-stream.js')]);
        execFileSync(process.execPath, [path.join(fixtureRoot, 'scripts/patch-rn-wav-writer.js')]);
      };
      apply();
      const first = files.map(relative => fs.readFileSync(path.join(fixtureRoot, relative), 'utf8'));
      apply();
      expect(files.map(relative => fs.readFileSync(path.join(fixtureRoot, relative), 'utf8'))).toEqual(first);
      expect(first[0]).toContain('public void start(Promise promise)');
      expect(first[0]).toContain('if (isRecording) eventEmitter.emit("error", "AudioRecord.read failed: " + bytesRead)');
      expect(first[0]).toContain('if (isRecording) eventEmitter.emit("error", "Audio recording failed: " + e.toString())');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('waits for native init and start acknowledgement, forwards terminal reader errors, removes listeners', async () => {
    let resolveInit!: () => void;
    let resolveStart!: () => void;
    const subscriptions = { data: { remove: jest.fn() }, error: { remove: jest.fn() } };
    const callbacks: Record<string, (data: string) => void> = {};
    const stream = {
      init: jest.fn(() => new Promise<void>(resolve => { resolveInit = resolve; })),
      start: jest.fn(() => new Promise<void>(resolve => { resolveStart = resolve; })),
      stop: jest.fn(async () => undefined),
      on: jest.fn((name: 'data' | 'error', callback: (data: string) => void) => {
        callbacks[name] = callback;
        return subscriptions[name];
      }),
    };
    const Adapter = loadClass(adapterJs, ['LiveAudioStream', 'base64ToUint8Array'], [stream, jest.fn()], 'AudioPcmStreamAdapter');
    const adapter = new Adapter();
    const onError = jest.fn();
    adapter.onError(onError);
    const initialized = adapter.initialize({ sampleRate: 16000 });
    expect(adapter.isInitialized).toBe(false);
    expect(stream.on).not.toHaveBeenCalled();
    resolveInit();
    await initialized;
    const started = adapter.start();
    expect(adapter.isRecording()).toBe(false);
    resolveStart();
    await started;
    expect(adapter.isRecording()).toBe(true);
    callbacks.error('AudioRecord.read failed: -6');
    expect(onError).toHaveBeenCalledWith('AudioRecord.read failed: -6');
    await adapter.release();
    expect(subscriptions.data.remove).toHaveBeenCalledTimes(1);
    expect(subscriptions.error.remove).toHaveBeenCalledTimes(1);
  });

  it('rejects native init/start failures instead of reporting recording', async () => {
    const stream = { init: jest.fn(), start: jest.fn(), on: jest.fn() };
    const Adapter = loadClass(adapterJs, ['LiveAudioStream', 'base64ToUint8Array'], [stream, jest.fn()], 'AudioPcmStreamAdapter');
    const adapter = new Adapter();
    stream.init.mockRejectedValueOnce(new Error('no microphone'));
    await expect(adapter.initialize({})).rejects.toThrow('no microphone');
    expect(adapter.isInitialized).toBe(false);
    stream.init.mockResolvedValue(undefined);
    await adapter.initialize({});
    stream.start.mockRejectedValueOnce(new Error('start denied'));
    await expect(adapter.start()).rejects.toThrow('start denied');
    expect(adapter.isRecording()).toBe(false);
  });

  it('sizes WAV from flushed bytes even when append rejected after reaching disk', async () => {
    let contents = Buffer.alloc(0);
    const filesystem = {
      writeFile: jest.fn(async (_file: string, data: string) => { contents = Buffer.from(data, 'base64'); }),
      appendFile: jest.fn(async (_file: string, data: string) => {
        contents = Buffer.concat([contents, Buffer.from(data, 'base64')]);
        throw new Error('append acknowledgement lost');
      }),
      stat: jest.fn(async () => ({ size: contents.length })),
      write: jest.fn(async (_file: string, data: string) => { Buffer.from(data, 'base64').copy(contents); }),
    };
    const Writer = loadClass(wavJs, ['uint8ArrayToBase64'], [(bytes: Uint8Array) => Buffer.from(bytes).toString('base64')], 'WavFileWriter');
    const writer = new Writer(filesystem, '/recording.wav', { sampleRate: 16000, channels: 1, bitsPerSample: 16 });
    await writer.initialize();
    await expect(writer.appendAudioData(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow('append acknowledgement lost');
    await writer.finalize();
    expect(contents.length).toBe(48);
    expect(contents.readUInt32LE(40)).toBe(4);
    expect(contents.subarray(44)).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(filesystem.appendFile).toHaveBeenCalledTimes(1);
  });
});
