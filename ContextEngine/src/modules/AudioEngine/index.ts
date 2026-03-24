/**
 * AudioEngine Module (Interface)
 * This is a placeholder for the native bindings for Sherpa-ONNX and Whisper.
 */

export interface TranscriptionResult {
  text: string;
  confidence: number;
}

export abstract class AudioEngine {
  /**
   * Starts listening for the "Remember" wake word.
   */
  abstract startWakeWordDetection(onDetected: () => void): Promise<void>;

  /**
   * Starts capturing audio for STT.
   */
  abstract startRecording(): Promise<void>;

  /**
   * Stops recording and returns the transcript.
   */
  abstract stopRecording(): Promise<TranscriptionResult>;

  /**
   * Initializes the Whisper and Sherpa models.
   */
  abstract initializeModels(): Promise<void>;
}
