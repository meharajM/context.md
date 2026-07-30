jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-fs', () => ({
  MainBundlePath: '/bundle',
  TemporaryDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/documents',
  exists: jest.fn(async () => true),
  stat: jest.fn(async () => ({ size: 77704715 })),
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('falls back to file transcription when realtime stop times out', async () => {
    const engine = new AudioEngineImpl() as any;
    const transcribeSpy = jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: 'final transcript',
      confidence: 1,
    });
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = {};
    engine.isRecording = true;
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
      confidence: 0,
      error: 'Transcription stop timed out',
      audioFilePath: expect.stringMatching(/^\/documents\/retained-audio\/contextengine-retained-.+\.wav$/),
    });
    expect(transcribeSpy).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it('transcribes finalized audio after a successful stop', async () => {
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
    expect(transcribeSpy).toHaveBeenCalledWith('/tmp/capture.wav');
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/capture.wav');
    expect(RNFS.moveFile).not.toHaveBeenCalled();
    expect(RNFS.copyFile).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(releaseWhisper).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      text: 'final transcript',
      confidence: 1,
    });
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
      confidence: 0,
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

  it('copies retained audio and only then cleans the temporary source when move fails', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockResolvedValue({
      text: '',
      confidence: 0,
      error: 'Transcription aborted',
    });
    (RNFS.moveFile as jest.Mock).mockRejectedValueOnce(new Error('move unsupported'));
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
    (RNFS.moveFile as jest.Mock).mockRejectedValueOnce(new Error('move failed'));
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
      confidence: 1,
    });
    expect(transcribe).toHaveBeenCalledWith(
      '/tmp/capture.wav',
      expect.objectContaining({
        language: 'en',
        beamSize: 3,
        bestOf: 3,
      }),
    );
  });

  it('treats non-speech placeholder tags as empty transcription', async () => {
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve({
        result: '[MUSIC]',
        segments: [{ text: '[MUSIC]' }],
        language: 'en',
        isAborted: false,
      }),
    }));
    const engine = new AudioEngineImpl() as any;

    engine.whisperContext = { transcribe };

    const result = await engine.transcribeFile('/tmp/capture.wav');

    expect(result).toEqual({
      text: '',
      confidence: 0,
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
      confidence: 1,
    });
    expect(transcribe).toHaveBeenCalledWith(
      '/tmp/capture.wav',
      expect.objectContaining({
        language: 'en',
        beamSize: 3,
        bestOf: 3,
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
      'Refusing to delete audio outside Context Engine retained storage',
    );

    expect(RNFS.exists).not.toHaveBeenCalledWith(unsafePath);
    expect(RNFS.unlink).not.toHaveBeenCalledWith(unsafePath);
  });
});
