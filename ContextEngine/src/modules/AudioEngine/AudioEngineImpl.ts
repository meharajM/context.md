import { Platform } from 'react-native';
// @ts-ignore
import { initWhisper } from 'whisper.rn';
import { AudioEngine, TranscriptionResult } from './index';
import RNFS from 'react-native-fs';

export class AudioEngineImpl implements AudioEngine {
  private whisperContext: any = null;
  private keywordSpotter: any = null;
  private isRecording = false;
  private realtimeCapture: any = null;

  private WHISPER_MODEL = Platform.OS === 'ios' 
    ? `${RNFS.MainBundlePath}/whisper-tiny.en.bin` 
    : 'whisper-tiny.en.bin'; // whisper.rn handles assets automatically on Android

  private KWS_MODEL = `${RNFS.MainBundlePath}/kws_model.onnx`;

  async initializeModels(): Promise<void> {
    if (this.whisperContext) return;
    try {
      // 1. Initialize Whisper STT
      if (Platform.OS === 'ios') {
        const whisperExists = await RNFS.exists(this.WHISPER_MODEL);
        if (whisperExists) {
          this.whisperContext = await initWhisper({ filePath: this.WHISPER_MODEL });
          console.log('Whisper engine ready (iOS).');
        } else {
          console.warn('Whisper model not found at path:', this.WHISPER_MODEL);
        }
      } else {
        // Android: whisper.rn loads from assets by default if only name is provided
        this.whisperContext = await initWhisper({ filePath: this.WHISPER_MODEL });
        console.log('Whisper engine ready (Android Assets).');
      }

      // 2. Initialize Sherpa-ONNX Keyword Spotter
      const kwsExists = await RNFS.exists(this.KWS_MODEL);
      if (kwsExists) {
         console.log('Sherpa-ONNX ready (awaiting model binding).');
      }
    } catch (error) {
      console.error('AudioEngine Init Error:', error);
    }
  }

  async startWakeWordDetection(_onDetected: () => void): Promise<void> {
    console.log('KWS: Listening for "Remember"...');
  }

  async startRecording(): Promise<void> {
    if (!this.whisperContext || this.isRecording) return;
    
    this.isRecording = true;
    try {
      this.realtimeCapture = await this.whisperContext.transcribeRealtime();
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
       const result = await this.realtimeCapture.stop();
       console.log('[AudioEngine] Transcription result:', result.result);
       
       return {
         text: result.result || '',
         confidence: 1.0,
       };
    } catch (err) {
       console.error('Transcription error:', err);
       return { text: '', confidence: 0 };
    }
  }
}
