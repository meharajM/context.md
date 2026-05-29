import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

// @ts-ignore
import { RealtimeTranscriber } from '../../../node_modules/whisper.rn/lib/module/realtime-transcription/RealtimeTranscriber';
// @ts-ignore
import { initWhisper } from '../../../node_modules/whisper.rn/lib/module/index';
import { AudioEngine, AudioReadiness, TranscriptionResult } from './index';

type RealtimeEvent = {
  type: 'start' | 'transcribe' | 'end' | 'error';
  data?: { result?: string; error?: string };
  error?: string;
};

export class AudioEngineImpl implements AudioEngine {
  private whisperContext: any = null;
  private isRecording = false;
  private realtimeCapture: any = null;
  private latestTranscript = '';
  private latestError: string | null = null;
  private currentAudioFilePath: string | null = null;
  private wakeWordListening = false;
  private onWakeDetected: (() => void) | null = null;
  private readiness: AudioReadiness = {
    transcriptionReady: false,
    wakeWordReady: false,
    missingModels: [],
    errors: [],
  };

  private WHISPER_MODEL = Platform.OS === 'ios'
    ? `${RNFS.MainBundlePath}/whisper-tiny.en.bin`
    : 'whisper-tiny.en.bin';

  private KWS_MODEL = `${RNFS.MainBundlePath}/kws_model.onnx`;
  private readonly STOP_TIMEOUT_MS = 30000;

  async initializeModels(): Promise<AudioReadiness> {
    const missingModels: string[] = [];
    const errors: string[] = [];

    if (!this.whisperContext) {
      try {
        if (Platform.OS === 'ios') {
          const whisperExists = await RNFS.exists(this.WHISPER_MODEL);
          if (whisperExists) {
            this.whisperContext = await initWhisper({ filePath: this.WHISPER_MODEL });
            console.log('Whisper engine ready (iOS).');
          } else {
            console.log('Whisper model not found at path:', this.WHISPER_MODEL);
            missingModels.push(this.WHISPER_MODEL);
          }
        } else {
          this.whisperContext = await initWhisper({ filePath: this.WHISPER_MODEL });
          console.log('Whisper engine ready (Android Assets).');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.error('AudioEngine whisper init error:', error);
      }
    }

    if (Platform.OS === 'ios') {
      const kwsExists = await RNFS.exists(this.KWS_MODEL);
      if (!kwsExists) {
        missingModels.push(this.KWS_MODEL);
      }
    }

    this.readiness = {
      transcriptionReady: this.whisperContext != null,
      wakeWordReady: false,
      missingModels,
      errors,
    };

    return { ...this.readiness };
  }

  getReadiness(): AudioReadiness {
    return { ...this.readiness };
  }

  async startWakeWordDetection(onDetected: () => void): Promise<void> {
    if (!this.readiness.wakeWordReady || this.wakeWordListening) {
      return;
    }

    this.onWakeDetected = onDetected;
    this.wakeWordListening = true;
    console.log('KWS: Listening for "Remember"...');
  }

  async stopWakeWordDetection(): Promise<void> {
    this.onWakeDetected = null;
    this.wakeWordListening = false;
  }

  async startRecording(): Promise<void> {
    if (!this.whisperContext || this.isRecording) return;

    this.isRecording = true;
    this.latestTranscript = '';
    this.latestError = null;
    this.currentAudioFilePath = this.buildAudioOutputPath();

    try {
      const { AudioPcmStreamAdapter } = require('../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter');
      const audioStream = new AudioPcmStreamAdapter();
      const capture = new RealtimeTranscriber(
        {
          whisperContext: this.whisperContext,
          audioStream,
          fs: RNFS as any,
        },
        {
          audioOutputPath: this.currentAudioFilePath ?? undefined,
          audioStreamConfig: {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,
            bufferSize: 16 * 1024,
          },
        },
        {
          onTranscribe: (event: RealtimeEvent) => {
            if (event.data?.result) {
              this.latestTranscript = event.data.result;
            }

            if (event.type === 'error') {
              this.latestError = event.data?.error ?? event.error ?? this.latestError ?? 'Transcription failed';
            }
          },
          onError: (error: string) => {
            this.latestError = error;
          },
        },
      );

      await capture.start();
      this.realtimeCapture = capture;
      console.log('Recording started...');
    } catch (err) {
      this.isRecording = false;
      await this.cleanupAudioFile(this.currentAudioFilePath);
      this.currentAudioFilePath = null;
      this.realtimeCapture = null;
      throw err;
    }
  }

  async stopRecording(): Promise<TranscriptionResult> {
    if (!this.whisperContext || !this.isRecording || !this.realtimeCapture) {
      return { text: '', confidence: 0 };
    }

    this.isRecording = false;
    const capture = this.realtimeCapture;
    const audioFilePath = this.currentAudioFilePath;
    this.realtimeCapture = null;
    this.currentAudioFilePath = null;

    let stopTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        capture.stop(),
        new Promise<void>((_, reject) => {
          stopTimeout = setTimeout(() => {
            reject(new Error('Transcription stop timed out'));
          }, this.STOP_TIMEOUT_MS);
        }),
      ]);

      const text = this.latestTranscript.trim();
      const hadError = Boolean(this.latestError);
      const shouldRetainAudio = hadError;

      if (!shouldRetainAudio) {
        await this.cleanupAudioFile(audioFilePath);
      }

      const result: TranscriptionResult = {
        text,
        confidence: text ? 1.0 : 0,
        ...(hadError ? { error: this.latestError ?? 'Transcription failed' } : {}),
        ...(shouldRetainAudio && audioFilePath ? { audioFilePath } : {}),
      };

      console.log('[AudioEngine] Transcription result:', result.text);
      return result;
    } catch (err) {
      console.error('Transcription error:', err);
      return {
        text: this.latestTranscript.trim(),
        confidence: this.latestTranscript.trim() ? 1.0 : 0,
        error: err instanceof Error ? err.message : String(err),
        ...(audioFilePath ? { audioFilePath } : {}),
      };
    } finally {
      if (stopTimeout) {
        clearTimeout(stopTimeout);
      }
      this.realtimeCapture = null;
      this.currentAudioFilePath = null;
    }
  }

  async transcribeFile(filePathOrAsset: string | number): Promise<TranscriptionResult> {
    if (!this.whisperContext) {
      return { text: '', confidence: 0 };
    }

    const { promise } = this.whisperContext.transcribe(filePathOrAsset, {
      language: 'en',
    });
    const result = await promise;

    return {
      text: result.result || '',
      confidence: result.result ? 1.0 : 0,
    };
  }

  private buildAudioOutputPath(): string {
    const baseDir = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
    const fileName = `contextengine-voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.wav`;
    return `${baseDir}/${fileName}`;
  }

  private async cleanupAudioFile(filePath: string | null): Promise<void> {
    if (!filePath) {
      return;
    }

    try {
      if (await RNFS.exists(filePath)) {
        await RNFS.unlink(filePath);
      }
    } catch (error) {
      console.warn('[AudioEngine] Failed to clean up audio file:', error);
    }
  }
}
