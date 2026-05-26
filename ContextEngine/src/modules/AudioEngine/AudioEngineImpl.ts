import { Platform } from 'react-native';
// @ts-ignore
import { AudioSessionIos, initWhisper } from 'whisper.rn';
import { AudioEngine, AudioReadiness, TranscriptionResult } from './index';
import RNFS from 'react-native-fs';

export class AudioEngineImpl implements AudioEngine {
  private whisperContext: any = null;
  private isRecording = false;
  private realtimeCapture: any = null;
  private latestTranscript = '';
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
    : 'whisper-tiny.en.bin'; // whisper.rn handles assets automatically on Android

  private KWS_MODEL = `${RNFS.MainBundlePath}/kws_model.onnx`;

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
            console.warn('Whisper model not found at path:', this.WHISPER_MODEL);
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
      // Wake-word runtime stays disabled until a real keyword spotter model is bundled and wired.
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
    try {
      this.latestTranscript = '';
      const capture = await this.whisperContext.transcribeRealtime(
        Platform.OS === 'ios'
          ? {
              audioSessionOnStartIos: {
                category: AudioSessionIos.Category.PlayAndRecord,
                options: [AudioSessionIos.CategoryOption.MixWithOthers],
                mode: AudioSessionIos.Mode.Default,
              },
              audioSessionOnStopIos: 'restore',
            }
          : undefined,
      );
      capture.subscribe((event: { isCapturing: boolean; data?: { result?: string }; error?: string }) => {
        if (event.data?.result) {
          this.latestTranscript = event.data.result;
        }
      });
      this.realtimeCapture = capture;
      console.log('Recording started...');
    } catch (err) {
      this.isRecording = false;
      throw err;
    }
  }

  async stopRecording(): Promise<TranscriptionResult> {
    if (!this.whisperContext || !this.isRecording || !this.realtimeCapture) {
      return { text: '', confidence: 0 };
    }

    this.isRecording = false;
    try {
      await this.realtimeCapture.stop();
      console.log('[AudioEngine] Transcription result:', this.latestTranscript);

      return {
        text: this.latestTranscript || '',
        confidence: this.latestTranscript ? 1.0 : 0,
      };
    } catch (err) {
      console.error('Transcription error:', err);
      return { text: this.latestTranscript || '', confidence: this.latestTranscript ? 1.0 : 0 };
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
}
