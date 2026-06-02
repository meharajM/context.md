jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-fs', () => ({
  MainBundlePath: '/bundle',
  TemporaryDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/tmp',
  exists: jest.fn(async () => true),
  stat: jest.fn(async () => ({ size: 77704715 })),
  readDir: jest.fn(async () => []),
  unlink: jest.fn(async () => undefined),
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
      audioFilePath: '/tmp/capture.wav',
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
      audioFilePath: '/tmp/capture.wav',
    });
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(releaseWhisper).toHaveBeenCalledTimes(1);
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
});
