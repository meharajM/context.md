/**
 * AudioEngine Module (Interface)
 * This is a placeholder for the native bindings for Sherpa-ONNX and Whisper.
 */

export interface TranscriptionResult {
  text: string;
  /** Only set by transcription engines that provide a confidence score. */
  confidence?: number;
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
  abstract startRecording(onCaptureError?: (error: string) => void): Promise<void>;

  getCaptureInputLabel?(): string | null;

  /**
   * Stops recording and returns the transcript.
   */
  abstract stopRecording(onAudioRetained?: (audioFilePath: string, noteId?: string) => Promise<void>): Promise<TranscriptionResult>;

  abstract recoverInterruptedRecordings(onRetained: (audioFilePath: string, noteId?: string) => Promise<void>): Promise<number>;

  /**
   * Transcribes a bundled sample or file path for diagnostics.
   */
  abstract transcribeFile(filePathOrAsset: string | number): Promise<TranscriptionResult>;

  /**
   * Deletes an app-owned retained recording after an explicit user action.
   * Implementations must reject paths outside the retained-audio directory.
   */
  abstract deleteRetainedAudioFile(filePath: string): Promise<boolean>;

  /**
   * Initializes the Whisper and Sherpa models.
   */
  abstract initializeModels(): Promise<AudioReadiness>;

  /**
   * Returns the latest readiness snapshot.
   */
  abstract getReadiness(): AudioReadiness;
}
