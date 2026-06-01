jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-fs', () => ({
  MainBundlePath: '/bundle',
  TemporaryDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/tmp',
  exists: jest.fn(async () => true),
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
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = {};
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
    expect(result).toEqual({
      text: 'final transcript',
      confidence: 1,
    });
  });

  it('retains the audio path when file transcription fails after stop', async () => {
    const engine = new AudioEngineImpl() as any;
    jest.spyOn(engine, 'transcribeFile').mockRejectedValue(new Error('transcribe failed'));
    const release = jest.fn(async () => undefined);
    const finalize = jest.fn(async () => undefined);

    engine.whisperContext = {};
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
  });
});
