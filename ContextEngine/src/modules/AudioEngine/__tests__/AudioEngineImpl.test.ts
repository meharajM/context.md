jest.mock('react-native', () => ({
  NativeModules: { EventEmitter: { startActiveRecordingService: jest.fn(), stopActiveRecordingService: jest.fn() } },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-fs', () => ({
  MainBundlePath: '/bundle',
  TemporaryDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/documents',
  exists: jest.fn(async () => true),
  stat: jest.fn(async () => ({ size: 48 })),
  writeFile: jest.fn(async () => undefined),
  write: jest.fn(async () => undefined),
  readFile: jest.fn(async () => ''),
  read: jest.fn(async () => {
    const { Buffer } = require('buffer');
    const header = Buffer.alloc(44);
    header.write('RIFF'); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24);
    header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36);
    return header.toString('base64');
  }),
  readDir: jest.fn(async () => []),
  unlink: jest.fn(async () => undefined),
  mkdir: jest.fn(async () => undefined),
  moveFile: jest.fn(async () => undefined),
  copyFile: jest.fn(async () => undefined),
}));

jest.mock('../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter', () => ({
  AudioPcmStreamAdapter: jest.fn(),
}));

jest.mock('../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter', () => ({
  WavFileWriter: jest.fn(),
}));

jest.mock('../../../../node_modules/whisper.rn/lib/module/index', () => ({
  initWhisper: jest.fn(),
}));

import RNFS from 'react-native-fs';
import { NativeModules, Platform } from 'react-native';
import { AudioEngineImpl } from '../AudioEngineImpl';

const { initWhisper } = jest.requireMock('../../../../node_modules/whisper.rn/lib/module/index') as {
  initWhisper: jest.Mock;
};

describe('AudioEngineImpl.stopRecording', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === '/bundle/whisper-tiny.en.bin' || path === '/tmp/capture.wav',
    );
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
    (RNFS.moveFile as jest.Mock).mockResolvedValue(undefined);
    (RNFS.copyFile as jest.Mock).mockResolvedValue(undefined);
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
    (NativeModules.EventEmitter.startActiveRecordingService as jest.Mock).mockResolvedValue(undefined);
    (NativeModules.EventEmitter.stopActiveRecordingService as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('falls back to file transcription when realtime stop times out', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const engine = new AudioEngineImpl() as any;
    const transcribeSpy = jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: 'final transcript',
      confidence: 1,
    });
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = {};
    engine.isRecording = true;
    engine.androidRecordingServiceStarted = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(() => new Promise(() => undefined)),
      release,
    };
    engine.currentWavWriter = {
      finalize,
    };

    const stopPromise = engine.stopRecording();
    await jest.advanceTimersByTimeAsync(12000);
    const result = await stopPromise;

    expect(result).toEqual({
      text: '',
      error: 'Transcription stop timed out',
      audioFilePath: expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    });
    expect(transcribeSpy).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(NativeModules.EventEmitter.stopActiveRecordingService).toHaveBeenCalledTimes(1);
  });

  it('starts the Android service before PCM and stops it after WAV finalization before transcription', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const events: string[] = [];
    let resolveServiceStop!: () => void;
    let notifyServiceStopStarted!: () => void;
    const serviceStopStarted = new Promise<void>(resolve => {
      notifyServiceStopStarted = resolve;
    });
    const serviceStopAcknowledged = new Promise<void>(resolve => {
      resolveServiceStop = resolve;
    });
    (initWhisper as jest.Mock).mockResolvedValue({ release: jest.fn(async () => undefined) });
    (NativeModules.EventEmitter.startActiveRecordingService as jest.Mock).mockImplementation(async () => {
      events.push('service-start');
    });
    (NativeModules.EventEmitter.stopActiveRecordingService as jest.Mock).mockImplementation(async () => {
      events.push('service-stop');
      notifyServiceStopStarted();
      await serviceStopAcknowledged;
    });
    const { AudioPcmStreamAdapter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter',
    );
    const { WavFileWriter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter',
    );
    AudioPcmStreamAdapter.mockImplementation(() => {
      events.push('pcm-created');
      return {
        onData: jest.fn(),
        onError: jest.fn(),
        initialize: jest.fn(async () => undefined),
        start: jest.fn(async () => undefined),
        stop: jest.fn(async () => undefined),
        release: jest.fn(async () => undefined),
      };
    });
    WavFileWriter.mockImplementation(() => ({
      initialize: jest.fn(async () => undefined),
      appendAudioData: jest.fn(async () => undefined),
      finalize: jest.fn(async () => { events.push('wav-finalized'); }),
    }));

    const engine = new AudioEngineImpl();
    jest.spyOn(engine, 'transcribeFile').mockImplementation(async () => {
      events.push('transcribe');
      return { text: 'final transcript' };
    });

    await engine.startRecording();
    const stopPromise = engine.stopRecording();
    await serviceStopStarted;

    expect(events).toContain('wav-finalized');
    expect(events).toContain('service-stop');
    expect(events).not.toContain('transcribe');

    resolveServiceStop();
    await stopPromise;

    expect(events.indexOf('service-start')).toBeLessThan(events.indexOf('pcm-created'));
    expect(events.indexOf('wav-finalized')).toBeLessThan(events.indexOf('service-stop'));
    expect(events.indexOf('service-stop')).toBeLessThan(events.indexOf('transcribe'));
  });

  it('does not open PCM when Android cannot start the foreground service', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    (initWhisper as jest.Mock).mockResolvedValue({ release: jest.fn(async () => undefined) });
    (NativeModules.EventEmitter.startActiveRecordingService as jest.Mock).mockRejectedValue(
      new Error('foreground start denied'),
    );
    const { AudioPcmStreamAdapter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter',
    );

    await expect(new AudioEngineImpl().startRecording()).rejects.toThrow('foreground start denied');

    expect(AudioPcmStreamAdapter).not.toHaveBeenCalled();
    expect(NativeModules.EventEmitter.stopActiveRecordingService).not.toHaveBeenCalled();
  });

  it('stops the Android service when PCM stop fails', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const engine = new AudioEngineImpl() as any;
    const transcribe = jest.spyOn(engine, 'transcribeFile');
    engine.whisperContext = {};
    engine.isRecording = true;
    engine.androidRecordingServiceStarted = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => { throw new Error('PCM stop failed'); }),
      release: jest.fn(async () => undefined),
    };
    engine.currentWavWriter = { finalize: jest.fn(async () => undefined) };

    const result = await engine.stopRecording();

    expect(result.error).toBe('PCM stop failed');
    expect(NativeModules.EventEmitter.stopActiveRecordingService).toHaveBeenCalledTimes(1);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('stops the Android service and releases the PCM stream when stream startup fails', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    (initWhisper as jest.Mock).mockResolvedValue({ release: jest.fn(async () => undefined) });
    const release = jest.fn(async () => undefined);
    const { AudioPcmStreamAdapter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter',
    );
    const { WavFileWriter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter',
    );
    AudioPcmStreamAdapter.mockImplementation(() => ({
      onData: jest.fn(),
      onError: jest.fn(),
      initialize: jest.fn(async () => undefined),
      start: jest.fn(async () => { throw new Error('PCM start failed'); }),
      release,
    }));
    WavFileWriter.mockImplementation(() => ({
      initialize: jest.fn(async () => undefined),
      appendAudioData: jest.fn(async () => undefined),
    }));

    await expect(new AudioEngineImpl().startRecording()).rejects.toThrow('PCM start failed');

    expect(NativeModules.EventEmitter.startActiveRecordingService).toHaveBeenCalledTimes(1);
    expect(NativeModules.EventEmitter.stopActiveRecordingService).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('retains finalized audio until the transcript is persisted by the store', async () => {
    const engine = new AudioEngineImpl() as any;
    const transcribeSpy = jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: 'final transcript',
      confidence: 1,
    });
    const releaseWhisper = jest.fn(async () => undefined);
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = { release: releaseWhisper };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release,
    };
    engine.currentWavWriter = {
      finalize,
    };

    const result = await engine.stopRecording();

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(transcribeSpy).toHaveBeenCalledWith(expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/));
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(RNFS.moveFile).toHaveBeenCalledWith(
      '/tmp/capture.wav',
      expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    );
    expect(RNFS.copyFile).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(releaseWhisper).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      text: 'final transcript',
      confidence: 1,
      audioFilePath: expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    });
  });

  it('awaits Inbox retention before starting transcription', async () => {
    const engine = new AudioEngineImpl() as any;
    const events: string[] = [];
    let retainedAudioPath = '';
    const transcribeSpy = jest.spyOn(engine, 'transcribeFile').mockImplementation(async () => {
      events.push('transcribe');
      return { text: 'final transcript', confidence: 1 };
    });
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);
    const onAudioRetained = jest.fn(async (path: string) => {
      retainedAudioPath = path;
      events.push('retained');
    });

    engine.whisperContext = {};
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release,
    };
    engine.currentWavWriter = { finalize };

    await engine.stopRecording(onAudioRetained);

    expect(events).toEqual(['retained', 'transcribe']);
    expect(onAudioRetained).toHaveBeenCalledWith(
      expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
      expect.stringMatching(/^voice-retained-/),
    );
    expect(transcribeSpy).toHaveBeenCalledWith(retainedAudioPath);
  });

  it('serializes PCM writes and drains them before WAV finalization', async () => {
    const engine = new AudioEngineImpl() as any;
    const transcribeSpy = jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: 'final transcript',
      confidence: 1,
    });
    let onData: ((streamData: { data: Uint8Array }) => void) | undefined;
    let resolveFirstWrite: () => void = () => {};
    let resolveSecondWrite: () => void = () => {};
    const firstWrite = new Promise<void>(resolve => { resolveFirstWrite = resolve; });
    const secondWrite = new Promise<void>(resolve => { resolveSecondWrite = resolve; });
    const appendAudioData = jest.fn()
      .mockReturnValueOnce(firstWrite)
      .mockReturnValueOnce(secondWrite);
    const finalize = jest.fn(async () => undefined);
    const { AudioPcmStreamAdapter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter',
    );
    const { WavFileWriter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter',
    );

    AudioPcmStreamAdapter.mockImplementation(() => ({
      onData: jest.fn((callback: typeof onData) => { onData = callback; }),
      onError: jest.fn(),
      initialize: jest.fn(async () => undefined),
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    }));
    WavFileWriter.mockImplementation(() => ({
      initialize: jest.fn(async () => undefined),
      appendAudioData,
      finalize,
    }));
    engine.whisperContext = { release: jest.fn(async () => undefined) };

    await engine.startRecording();
    onData?.({ data: new Uint8Array([1]) });
    onData?.({ data: new Uint8Array([2]) });
    const stopPromise = engine.stopRecording();
    const flushMicrotasks = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await Promise.resolve();
      }
    };

    await flushMicrotasks();
    expect(appendAudioData).toHaveBeenCalledTimes(1);
    expect(finalize).not.toHaveBeenCalled();

    resolveFirstWrite();
    await flushMicrotasks();
    expect(appendAudioData).toHaveBeenCalledTimes(2);
    expect(finalize).not.toHaveBeenCalled();

    resolveSecondWrite();
    await stopPromise;

    expect(finalize).toHaveBeenCalledTimes(1);
    expect(transcribeSpy).toHaveBeenCalledWith(expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/));
  });

  it('retains the audio path when file transcription fails after stop', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockRejectedValue(new Error('transcribe failed'));
    const releaseWhisper = jest.fn(async () => undefined);
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = { release: releaseWhisper };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release,
    };
    engine.currentWavWriter = {
      finalize,
    };

    const result = await engine.stopRecording();

    expect(result).toEqual({
      text: '',
      error: 'transcribe failed',
      audioFilePath: expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    });
    expect(RNFS.mkdir).toHaveBeenCalledWith('/documents/retained-audio');
    expect(RNFS.moveFile).toHaveBeenCalledWith(
      '/tmp/capture.wav',
      expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    );
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(releaseWhisper).toHaveBeenCalledTimes(1);
  });

  it('retains the audio path when file transcription returns an aborted result', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
    });
    const releaseWhisper = jest.fn(async () => undefined);
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = { release: releaseWhisper };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release,
    };
    engine.currentWavWriter = {
      finalize,
    };

    const result = await engine.stopRecording();

    expect(result).toEqual({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
      audioFilePath: expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    });
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(releaseWhisper).toHaveBeenCalledTimes(1);
  });

  it('retains audio when transcription returns no usable speech', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockResolvedValue({ text: '', confidence: 0 });
    engine.whisperContext = { release: jest.fn(async () => undefined) };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = { stop: jest.fn(async () => undefined), release: jest.fn(async () => undefined) };
    engine.currentWavWriter = { finalize: jest.fn(async () => undefined) };

    const result = await engine.stopRecording();

    expect(result).toEqual({
      text: '',
      confidence: 0,
      error: 'No speech detected',
      audioFilePath: expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    });
    expect(RNFS.moveFile).toHaveBeenCalledWith('/tmp/capture.wav', result.audioFilePath);
    expect(RNFS.unlink).not.toHaveBeenCalledWith('/tmp/capture.wav');
  });

  it('copies retained audio and only then cleans the temporary source when move fails', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
    });
    (RNFS.moveFile as jest.Mock).mockImplementation(async (sourcePath: string) => {
      if (sourcePath === '/tmp/capture.wav') throw new Error('move unsupported');
    });
    const releaseWhisper = jest.fn(async () => undefined);

    engine.whisperContext = { release: releaseWhisper };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    engine.currentWavWriter = {
      finalize: jest.fn(async () => undefined),
    };

    const result = await engine.stopRecording();
    const retainedPath = result.audioFilePath as string;

    expect(retainedPath).toMatch(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/);
    expect(RNFS.copyFile).toHaveBeenCalledWith('/tmp/capture.wav', retainedPath);
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/capture.wav');
    expect((RNFS.copyFile as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((RNFS.unlink as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('keeps the only source recording when durable move and copy both fail', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
    });
    (RNFS.moveFile as jest.Mock).mockImplementation(async (sourcePath: string) => {
      if (sourcePath === '/tmp/capture.wav') throw new Error('move failed');
    });
    (RNFS.copyFile as jest.Mock).mockRejectedValueOnce(new Error('copy failed'));

    engine.whisperContext = { release: jest.fn(async () => undefined) };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    engine.currentWavWriter = {
      finalize: jest.fn(async () => undefined),
    };

    const result = await engine.stopRecording();

    expect(result.audioFilePath).toBe('/tmp/capture.wav');
    expect(RNFS.unlink).not.toHaveBeenCalledWith('/tmp/capture.wav');
  });

  it('allocates another filename when a retained-audio candidate already exists', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
    });
    let retainedCandidateChecks = 0;
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
      if (path.includes('/contextengine-retained-')) {
        retainedCandidateChecks += 1;
        return retainedCandidateChecks === 1;
      }
      return path === '/bundle/whisper-tiny.en.bin' ||
        path === '/tmp/capture.wav' ||
        path === '/documents/retained-audio';
    });

    engine.whisperContext = { release: jest.fn(async () => undefined) };
    engine.isRecording = true;
    engine.currentAudioFilePath = '/tmp/capture.wav';
    engine.currentAudioStream = {
      stop: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    engine.currentWavWriter = {
      finalize: jest.fn(async () => undefined),
    };

    const result = await engine.stopRecording();

    expect(retainedCandidateChecks).toBe(2);
    expect(result.audioFilePath).toMatch(/-1\.wav$/);
    expect(RNFS.moveFile).toHaveBeenCalledWith('/tmp/capture.wav', result.audioFilePath);
  });

  it('reinitializes whisper lazily before starting a new recording when context was released', async () => {
    const initializedContext = { release: jest.fn(async () => undefined) };
    (initWhisper as jest.Mock).mockResolvedValue(initializedContext);
    const engine = new AudioEngineImpl() as any;
    const wavInitialize = jest.fn(async () => undefined);
    const audioInitialize = jest.fn(async () => undefined);
    const audioStart = jest.fn(async () => undefined);

    const { AudioPcmStreamAdapter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter',
    );
    const { WavFileWriter } = jest.requireMock(
      '../../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter',
    );

    AudioPcmStreamAdapter.mockImplementation(() => ({
      onData: jest.fn(),
      onError: jest.fn(),
      initialize: audioInitialize,
      start: audioStart,
    }));
    WavFileWriter.mockImplementation(() => ({
      initialize: wavInitialize,
      appendAudioData: jest.fn(async () => undefined),
    }));

    engine.whisperContext = null;

    await engine.startRecording();

    expect(initWhisper).toHaveBeenCalled();
    expect(wavInitialize).toHaveBeenCalledTimes(1);
    expect(audioInitialize).toHaveBeenCalledTimes(1);
    expect(audioStart).toHaveBeenCalledTimes(1);
  });

  it('normalizes repeated file transcription output', async () => {
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve({
        result: 'Buy milk tomorrow at 5 pm. Buy milk tomorrow at 5 pm. 5 pm.',
        segments: [{ text: 'Buy milk tomorrow at 5 pm.' }],
        language: 'en',
        isAborted: false,
      }),
    }));
    const engine = new AudioEngineImpl() as any;

    engine.whisperContext = { transcribe };

    const result = await engine.transcribeFile('/tmp/capture.wav');

    expect(result).toEqual({
      text: 'Buy milk tomorrow at 5 pm. 5 pm.',
    });
    expect(transcribe).toHaveBeenCalledWith(
      '/tmp/capture.wav',
      expect.objectContaining({
        language: 'en',
        maxThreads: 1,
        nProcessors: 1,
        maxContext: 0,
        beamSize: 1,
        bestOf: 1,
      }),
    );
  });

  it('reinitializes a lost native Whisper context and retries once', async () => {
    const staleContext = {
      transcribe: jest.fn(() => ({ promise: Promise.reject(new Error('Context not found')) })),
    };
    const recoveredContext = {
      transcribe: jest.fn(() => ({
        promise: Promise.resolve({
          result: 'A recovered transcript.',
          segments: [{ text: 'A recovered transcript.' }],
          language: 'en',
          isAborted: false,
        }),
      })),
    };
    (initWhisper as jest.Mock).mockResolvedValue(recoveredContext);
    const engine = new AudioEngineImpl() as any;
    engine.whisperContext = staleContext;

    await expect(engine.transcribeFile('/tmp/capture.wav')).resolves.toEqual({
      text: 'A recovered transcript.',
    });

    expect(staleContext.transcribe).toHaveBeenCalledTimes(1);
    expect(initWhisper).toHaveBeenCalledTimes(1);
    expect(recoveredContext.transcribe).toHaveBeenCalledTimes(1);
    expect(engine.whisperContext).toBe(recoveredContext);
  });

  it.each(['[MUSIC]', '[MUSIC PLAYING]', '[BLANK_AUDIO]', '[SOUND]', '[buzzing]', '[ Pause ]'])('treats %s as empty transcription', async placeholder => {
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve({
        result: placeholder,
        segments: [{ text: placeholder }],
        language: 'en',
        isAborted: false,
      }),
    }));
    const engine = new AudioEngineImpl() as any;

    engine.whisperContext = { transcribe };

    const result = await engine.transcribeFile('/tmp/capture.wav');

    expect(result).toEqual({
      text: '',
    });
  });

  it('normalizes file URI paths before transcribing imported audio', async () => {
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve({
        result: 'Imported voice note',
        segments: [{ text: 'Imported voice note' }],
        language: 'en',
        isAborted: false,
      }),
    }));
    const engine = new AudioEngineImpl() as any;

    engine.whisperContext = { transcribe };

    const result = await engine.transcribeFile('file:///tmp/capture.wav');

    expect(result).toEqual({
      text: 'Imported voice note',
    });
    expect(transcribe).toHaveBeenCalledWith(
      '/tmp/capture.wav',
      expect.objectContaining({
        language: 'en',
        maxThreads: 1,
        nProcessors: 1,
        maxContext: 0,
        beamSize: 1,
        bestOf: 1,
      }),
    );
  });

  it('deletes only an app-owned retained recording', async () => {
    const engine = new AudioEngineImpl();
    const retainedPath = '/documents/retained-audio/contextengine-retained-abc-123.wav';
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);

    await expect(engine.deleteRetainedAudioFile(`file://${retainedPath}`)).resolves.toBe(true);

    expect(RNFS.unlink).toHaveBeenCalledWith(retainedPath);
  });

  it('treats an already-missing retained recording as safely deleted', async () => {
    const engine = new AudioEngineImpl();
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      engine.deleteRetainedAudioFile('/documents/retained-audio/contextengine-retained-missing.wav'),
    ).resolves.toBe(false);

    expect(RNFS.unlink).not.toHaveBeenCalled();
  });

  it.each([
    '/tmp/imported.wav',
    '/documents/user-recordings/voice.wav',
    '/documents/retained-audio/../private.wav',
    '/documents/retained-audio/not-created-by-context-engine.wav',
  ])('refuses to delete unrelated audio path %s', async unsafePath => {
    const engine = new AudioEngineImpl();

    await expect(engine.deleteRetainedAudioFile(unsafePath)).rejects.toThrow(
      'Refusing to delete audio outside app-owned capture storage',
    );

    expect(RNFS.exists).not.toHaveBeenCalledWith(unsafePath);
    expect(RNFS.unlink).not.toHaveBeenCalledWith(unsafePath);
  });

  it('rejects Whisper non-speech annotations for wind noise', async () => {
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve({
        result: '(wind blowing) (wind blowing) (wind howling)',
        segments: [],
        language: 'en',
        isAborted: false,
      }),
    }));
    const engine = new AudioEngineImpl() as any;

    engine.whisperContext = { transcribe };

    await expect(engine.transcribeFile('/tmp/silent-capture.wav')).resolves.toEqual({ text: '' });
  });
});
