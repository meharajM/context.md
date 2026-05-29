/**
 * AudioEngine Module (Interface)
 * This is a placeholder for the native bindings for Sherpa-ONNX and Whisper.
 */

export interface TranscriptionResult {
  text: string;
  confidence: number;
  error?: string;
  audioFilePath?: string;
}

export interface AudioReadiness {
  transcriptionReady: boolean;
  wakeWordReady: boolean;
  missingModels: string[];
  errors: string[];
}

export abstract class AudioEngine {
  /**
   * Starts listening for the "Remember" wake word.
   */
  abstract startWakeWordDetection(onDetected: () => void): Promise<void>;

  /**
   * Stops wake-word detection when the app backgrounds or the setting turns off.
   */
  abstract stopWakeWordDetection(): Promise<void>;

  /**
   * Starts capturing audio for STT.
   */
  abstract startRecording(): Promise<void>;

  /**
   * Stops recording and returns the transcript.
   */
  abstract stopRecording(): Promise<TranscriptionResult>;

  /**
   * Transcribes a bundled sample or file path for diagnostics.
   */
  abstract transcribeFile(filePathOrAsset: string | number): Promise<TranscriptionResult>;

  /**
   * Initializes the Whisper and Sherpa models.
   */
  abstract initializeModels(): Promise<AudioReadiness>;

  /**
   * Returns the latest readiness snapshot.
   */
  abstract getReadiness(): AudioReadiness;
}
