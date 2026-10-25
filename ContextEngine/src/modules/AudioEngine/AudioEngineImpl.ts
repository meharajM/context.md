import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

// @ts-ignore
import { initWhisper } from '../../../node_modules/whisper.rn/lib/module/index';
// @ts-ignore
import { AudioPcmStreamAdapter } from '../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter';
// @ts-ignore
import { WavFileWriter } from '../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter';
import { AudioEngine, AudioReadiness, TranscriptionResult } from './index';
import {
  acknowledgeRecording, describeRecording, recordingNoteId, recoverRecordings,
  repairRecordingHeader, RetainedRecordingCallback, RECORDING_PCM_FORMAT,
} from '../../shared/audio/recordingRecovery';
import {
  isAppOwnedCaptureAudioPath,
  isAppOwnedRetainedAudioPath,
  normalizeLocalAudioPath,
  RETAINED_AUDIO_DIRECTORY,
} from '../../shared/audio/retainedAudio';

const NON_SPEECH_SEGMENT_REGEX = /(?:\[|\()\s*(?:silence|blank(?:[_\s]+audio)?|pause|music(?:[_\s]+playing)?|sound|noise|buzzing|applause|laughter|inaudible|wind(?:\s+(?:blowing|howling))?)\s*(?:\]|\))/gi;
const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;

export class AudioEngineImpl implements AudioEngine {
  private whisperContext: any = null;
  private isRecording = false;
  private latestError: string | null = null;
  private currentAudioFilePath: string | null = null;
  private currentAudioStream: any = null;
  private acceptingAudio = false;
  private recoveryPromise: Promise<number> | null = null;
  private currentWavWriter: any = null;
  private androidRecordingServiceStarted = false;
  private pendingAudioWrites: Promise<void> = Promise.resolve();
  private wakeWordListening = false;
  private captureInputLabel: string | null = null;
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

  private KWS_MODEL = Platform.OS === 'ios'
    ? `${RNFS.MainBundlePath}/kws_model.onnx`
    : 'kws_model.onnx';
  private readonly STOP_TIMEOUT_MS = 12000;
  private readonly TRANSCRIBE_OPTIONS = {
    language: 'en',
    maxThreads: 1,
    nProcessors: 1,
    maxContext: 0,
    beamSize: 1,
    bestOf: 1,
    temperature: 0,
    temperatureInc: 0.2,
    tokenTimestamps: false,
    prompt: 'Short personal notes, reminders, errands, dates, and times in plain English.',
  } as const;

  private async ensureWhisperContext(): Promise<boolean> {
    if (this.whisperContext) {
      return true;
    }

    const readiness = await this.initializeModels();
    return readiness.transcriptionReady && this.whisperContext != null;
  }

  async initializeModels(): Promise<AudioReadiness> {
    const missingModels: string[] = [];
    const errors: string[] = [];

    if (!this.whisperContext) {
      try {
        if (Platform.OS === 'ios') {
          console.log('[AudioEngine] MainBundlePath:', RNFS.MainBundlePath);
          console.log('[AudioEngine] Resolved WHISPER_MODEL path:', this.WHISPER_MODEL);
          const whisperExists = await RNFS.exists(this.WHISPER_MODEL);
          console.log('[AudioEngine] whisper-tiny.en.bin exists?', whisperExists);
          if (whisperExists) {
            try {
              const stat = await RNFS.stat(this.WHISPER_MODEL);
              console.log('[AudioEngine] whisper file size:', stat.size, 'bytes');
            } catch (statErr) {
              console.log('[AudioEngine] stat failed (non-fatal):', statErr);
            }
            console.log('[AudioEngine] Calling initWhisper...');
            this.whisperContext = await initWhisper({
              filePath: this.WHISPER_MODEL,
              useGpu: false,
              useCoreMLIos: false,
            });
            console.log('[AudioEngine] Whisper engine ready (iOS real device).');
          } else {
            console.log('[AudioEngine] Whisper model NOT found at path:', this.WHISPER_MODEL);
            // Try listing bundle contents to diagnose
            try {
              const bundleFiles = await RNFS.readDir(RNFS.MainBundlePath);
              const binFiles = bundleFiles
                .filter(f => f.name.endsWith('.bin') || f.name.includes('whisper'))
                .map(f => `${f.name} (${f.size} bytes)`);
              console.log('[AudioEngine] .bin / whisper files in bundle:', binFiles.length > 0 ? binFiles.join(', ') : 'NONE');
            } catch (listErr) {
              console.log('[AudioEngine] Could not list bundle:', listErr);
            }
            missingModels.push(this.WHISPER_MODEL);
          }
        } else {
          this.whisperContext = await initWhisper({
            filePath: this.WHISPER_MODEL,
            isBundleAsset: true,
            useGpu: false,
            useCoreMLIos: false,
          });
          console.log('Whisper engine ready (Android Assets).');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.error('[AudioEngine] whisper init CRASHED:', message, error);
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

  async startRecording(onCaptureError?: (error: string) => void): Promise<void> {
    if (this.recoveryPromise) await this.recoveryPromise;
    if (this.isRecording) return;

    const whisperReady = await this.ensureWhisperContext();
    if (!whisperReady) {
      throw new Error('Whisper model is unavailable');
    }

    this.isRecording = true;
    this.latestError = null;
    this.pendingAudioWrites = Promise.resolve();
    let captureStarted = false;
    const captureError = (error: unknown) => {
      this.latestError ??= error instanceof Error ? error.message : String(error);
      if (captureStarted && this.acceptingAudio) {
        this.acceptingAudio = false;
        if (onCaptureError) onCaptureError(this.latestError);
        else void this.stopRecording();
      }
    };

    try {
      this.currentAudioFilePath = await this.buildRetainedAudioPath();
      await describeRecording(this.currentAudioFilePath);
      if (Platform.OS === 'android') {
        const startRecordingService = NativeModules.EventEmitter?.startActiveRecordingService;
        if (typeof startRecordingService !== 'function') {
          throw new Error('Android recording service is unavailable');
        }
        await startRecordingService.call(NativeModules.EventEmitter);
        this.androidRecordingServiceStarted = true;

        try {
          const route = await NativeModules.EventEmitter?.startAudioInputRouting?.();
          this.captureInputLabel = route === 'bluetooth'
            ? 'Bluetooth headset microphone'
            : route === 'wired'
              ? 'wired headset microphone'
              : route === 'phone'
                ? 'phone microphone'
                : null;
        } catch (error) {
          console.warn('[AudioEngine] Headset microphone routing failed; using the phone microphone:', error);
          this.captureInputLabel = 'phone microphone';
        }
      }

      const audioStream = new AudioPcmStreamAdapter();
      const wavWriter = new WavFileWriter(RNFS as any, this.currentAudioFilePath, RECORDING_PCM_FORMAT);
      this.currentAudioStream = audioStream;
      this.currentWavWriter = wavWriter;

      this.acceptingAudio = true;
      audioStream.onData((streamData: { data: Uint8Array }) => {
        if (!this.acceptingAudio) return;
        this.pendingAudioWrites = this.pendingAudioWrites
          .then(() => wavWriter.appendAudioData(streamData.data))
          .catch((error: unknown) => {
            captureError(error);
          });
      });
      audioStream.onError(captureError);

      await wavWriter.initialize();
      await audioStream.initialize({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        bufferSize: 16 * 1024,
      });
      await audioStream.start();
      if (this.latestError) throw new Error(this.latestError);
      captureStarted = true;

      console.log('Recording started...');
    } catch (err) {
      this.isRecording = false;
      const errorObj = err as any;
      console.error('[AudioEngine] startRecording CRASHED details:', {
        message: errorObj?.message,
        stack: errorObj?.stack,
        keys: errorObj ? Object.keys(errorObj) : [],
        raw: String(err)
      });
      await this.stopAndroidRecordingService().catch(serviceError => {
        console.warn('[AudioEngine] Failed to stop the Android recording service after start failure:', serviceError);
      });
      this.acceptingAudio = false;
      await this.releaseRecordingResources();
      await this.releaseAudioInputRouting();
      // A failed start can still deliver PCM; leave descriptor and bytes for recovery.
      this.currentAudioFilePath = null;
      throw err;
    }
  }

  async stopRecording(onAudioRetained?: RetainedRecordingCallback): Promise<TranscriptionResult> {
    if (!this.isRecording || !this.currentAudioStream || !this.currentWavWriter) {
      await this.stopAndroidRecordingService().catch(error => {
        console.warn('[AudioEngine] Failed to stop the Android recording service:', error);
      });
      return { text: '' };
    }

    console.log('[AudioEngine] Stopping recording...');
    const audioStream = this.currentAudioStream;
    const wavWriter = this.currentWavWriter;
    const audioFilePath = this.currentAudioFilePath;
    let retainedAudioPath: string | null = null;
    let retentionCallbackInvoked = false;
    const retainAndNotify = async () => {
      retainedAudioPath ??= await this.retainAudioFile(audioFilePath);
      if (retainedAudioPath && onAudioRetained && !retentionCallbackInvoked) {
        retentionCallbackInvoked = true;
        if (!isAppOwnedCaptureAudioPath(retainedAudioPath)) {
          throw new Error('Recording storage failed; audio remains at ' + retainedAudioPath);
        }
        await repairRecordingHeader(retainedAudioPath);
        await onAudioRetained(retainedAudioPath, recordingNoteId(retainedAudioPath));
        await acknowledgeRecording(retainedAudioPath);
      }
      return retainedAudioPath;
    };

    let stopTimeout: ReturnType<typeof setTimeout> | null = null;
    let stopExpired = false;
    try {
      console.log('[AudioEngine] Calling audio stream stop()...');
      const stopPromise = Promise.resolve()
        .then(() => audioStream.stop())
        .then(async () => {
          this.acceptingAudio = false;
          await this.pendingAudioWrites;
          if (stopExpired) return;
          await wavWriter.finalize();
          if (audioFilePath && isAppOwnedCaptureAudioPath(audioFilePath)) {
            await repairRecordingHeader(audioFilePath);
          }
          await this.stopAndroidRecordingService();
        })
        .then(() => ({ stopped: true as const }))
        .catch(error => ({ stopped: false as const, error }));

      const stopOutcome = await Promise.race([
        stopPromise,
        new Promise<{ timedOut: true }>(resolve => {
          stopTimeout = setTimeout(() => {
            console.log('[AudioEngine] audio stream stop() timed out (timeout limit exceeded)');
            stopExpired = true;
            resolve({ timedOut: true });
          }, this.STOP_TIMEOUT_MS);
        }),
      ]);

      if (stopTimeout) {
        clearTimeout(stopTimeout);
        stopTimeout = null;
      }

      if ('timedOut' in stopOutcome) {
        throw new Error('Transcription stop timed out');
      }

      if (!stopOutcome.stopped) {
        throw stopOutcome.error instanceof Error ? stopOutcome.error : new Error(String(stopOutcome.error));
      }

      console.log('[AudioEngine] audio stream stop() resolved successfully');

      retainedAudioPath = await retainAndNotify();
      const transcription = retainedAudioPath
        ? await this.transcribeFile(retainedAudioPath)
        : audioFilePath
          ? await this.transcribeFile(audioFilePath)
          : { text: '' };
      const text = transcription.text.trim();
      const transcriptionError = transcription.error?.trim() || this.latestError || (!text ? 'No speech detected' : null);

      const result: TranscriptionResult = {
        text,
        ...(transcription.confidence !== undefined ? { confidence: transcription.confidence } : {}),
        ...(transcriptionError ? { error: transcriptionError } : {}),
        ...(retainedAudioPath ? { audioFilePath: retainedAudioPath } : {}),
      };

      console.log('[AudioEngine] Transcription result:', result.text);
      return result;
    } catch (err) {
      console.error('Transcription error:', err);
      let message = err instanceof Error ? err.message : String(err);
      this.acceptingAudio = false;
      await this.pendingAudioWrites;
      if (audioFilePath && isAppOwnedCaptureAudioPath(audioFilePath)) {
        try {
          await repairRecordingHeader(audioFilePath);
        } catch (repairError) {
          message += `; WAV repair failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`;
        }
      }
      await this.stopAndroidRecordingService().catch(serviceError => {
        console.warn('[AudioEngine] Failed to stop the Android recording service after stop failure:', serviceError);
      });
      await this.releaseRecordingResources();
      try {
        await retainAndNotify();
      } catch (retentionError) {
        console.error('[AudioEngine] Failed to notify durable audio retention:', retentionError);
      }

      return {
        text: '',
        error: message,
        ...(retainedAudioPath ? { audioFilePath: retainedAudioPath } : {}),
      };
    } finally {
      this.isRecording = false;
      this.acceptingAudio = false;
      if (stopTimeout) {
        clearTimeout(stopTimeout);
      }
      await this.stopAndroidRecordingService().catch(error => {
        console.warn('[AudioEngine] Failed to stop the Android recording service during cleanup:', error);
      });
      await this.releaseRecordingResources();
      await this.releaseAudioInputRouting();
      await this.releaseWhisperContext();
      this.currentAudioFilePath = null;
    }
  }

  getCaptureInputLabel(): string | null {
    return this.captureInputLabel;
  }

  private async releaseAudioInputRouting(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await NativeModules.EventEmitter?.stopAudioInputRouting?.();
    } catch (error) {
      console.warn('[AudioEngine] Failed to restore the previous audio route:', error);
    }
  }

  private async stopAndroidRecordingService(): Promise<void> {
    if (Platform.OS !== 'android' || !this.androidRecordingServiceStarted) return;
    const stopRecordingService = NativeModules.EventEmitter?.stopActiveRecordingService;
    if (typeof stopRecordingService !== 'function') {
      throw new Error('Android recording service stop is unavailable');
    }
    await stopRecordingService.call(NativeModules.EventEmitter);
    this.androidRecordingServiceStarted = false;
  }

  async transcribeFile(filePathOrAsset: string | number): Promise<TranscriptionResult> {
    const whisperReady = await this.ensureWhisperContext();
    if (!whisperReady || !this.whisperContext) {
      return { text: '' };
    }

    const normalizedInput =
      typeof filePathOrAsset === 'string' ? filePathOrAsset.replace(/^file:\/\//i, '') : filePathOrAsset;

    let result: any;
    try {
      result = await this.transcribeWithWhisperContext(normalizedInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/context not found/i.test(message)) {
        throw error;
      }

      console.warn('[AudioEngine] Whisper context was lost; reinitializing once before retrying transcription.');
      this.whisperContext = null;
      const readiness = await this.initializeModels();
      if (!readiness.transcriptionReady || !this.whisperContext) {
        throw error;
      }
      result = await this.transcribeWithWhisperContext(normalizedInput);
    }
    const text = this.normalizeTranscript((result.result || '').replace(NON_SPEECH_SEGMENT_REGEX, '').trim());

    if (result.isAborted) {
      return {
        text: '',
        error: 'Transcription aborted',
      };
    }

    console.log('[AudioEngine] File transcription details:', {
      textLength: text.length,
      segmentCount: Array.isArray(result.segments) ? result.segments.length : 0,
      language: result.language ?? 'unknown',
      isAborted: Boolean(result.isAborted),
    });

    return {
      text,
    };
  }

  private async transcribeWithWhisperContext(filePath: string | number): Promise<any> {
    const { promise } = this.whisperContext.transcribe(filePath, {
      ...this.TRANSCRIBE_OPTIONS,
    });
    return promise;
  }

  async deleteRetainedAudioFile(filePath: string): Promise<boolean> {
    if (!isAppOwnedCaptureAudioPath(filePath)) {
      throw new Error('Refusing to delete audio outside app-owned capture storage');
    }

    const normalizedPath = normalizeLocalAudioPath(filePath);
    if (!(await RNFS.exists(normalizedPath))) {
      return false;
    }

    await RNFS.unlink(normalizedPath);
    return true;
  }

  async recoverInterruptedRecordings(onRetained: RetainedRecordingCallback): Promise<number> {
    if (this.isRecording || this.currentAudioStream) return 0;
    if (this.recoveryPromise) return this.recoveryPromise;
    this.recoveryPromise = recoverRecordings(onRetained);
    try {
      return await this.recoveryPromise;
    } finally {
      this.recoveryPromise = null;
    }
  }

  private async retainAudioFile(sourcePath: string | null): Promise<string | null> {
    if (!sourcePath) {
      return null;
    }

    if (isAppOwnedRetainedAudioPath(sourcePath)) return sourcePath;

    try {
      if (!(await RNFS.exists(RETAINED_AUDIO_DIRECTORY))) {
        await RNFS.mkdir(RETAINED_AUDIO_DIRECTORY);
      }

      const destinationPath = await this.buildRetainedAudioPath();
      await describeRecording(destinationPath);

      try {
        await RNFS.moveFile(sourcePath, destinationPath);
        return destinationPath;
      } catch (moveError) {
        // Some native filesystems can finish a move but still reject. Only trust that
        // destination when the source no longer exists; otherwise allocate a fresh copy
        // target if something raced into the original candidate.
        const sourceStillExists = await RNFS.exists(sourcePath);
        const destinationExists = await RNFS.exists(destinationPath);
        if (!sourceStillExists && destinationExists) {
          console.warn('[AudioEngine] Audio move reported an error after retaining the file:', moveError);
          return destinationPath;
        }

        try {
          const copyDestinationPath = destinationExists
            ? await this.buildRetainedAudioPath()
            : destinationPath;
          if (copyDestinationPath !== destinationPath) await describeRecording(copyDestinationPath);
          await RNFS.copyFile(sourcePath, copyDestinationPath);
          if (Number((await RNFS.stat(sourcePath)).size) !== Number((await RNFS.stat(copyDestinationPath)).size)) {
            throw new Error('Durable audio copy was incomplete; temporary original preserved');
          }
          await repairRecordingHeader(copyDestinationPath);
          await this.cleanupAudioFile(sourcePath);
          return copyDestinationPath;
        } catch (copyError) {
          console.warn('[AudioEngine] Failed to move or copy retained audio; keeping temporary source:', {
            moveError,
            copyError,
          });
          return sourcePath;
        }
      }
    } catch (error) {
      console.warn('[AudioEngine] Failed to prepare durable retained-audio storage; keeping temporary source:', error);
      return sourcePath;
    }
  }

  private async buildRetainedAudioPath(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).slice(2, 10);
      const attemptSuffix = attempt === 0 ? '' : `-${attempt.toString(36)}`;
      const candidate = `${RETAINED_AUDIO_DIRECTORY}/contextengine-retained-${timestamp}-${random}${attemptSuffix}.wav`;
      if (!(await RNFS.exists(candidate))) {
        return candidate;
      }
    }

    throw new Error('Unable to allocate a unique retained-audio filename');
  }

  private async releaseRecordingResources(): Promise<void> {
    const audioStream = this.currentAudioStream;
    this.currentAudioStream = null;
    this.currentWavWriter = null;

    if (!audioStream) {
      return;
    }

    try {
      let releaseTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          audioStream.release(),
          new Promise<void>(resolve => { releaseTimeout = setTimeout(resolve, 1500); }),
        ]);
      } finally {
        if (releaseTimeout) clearTimeout(releaseTimeout);
      }
    } catch (error) {
      console.warn('[AudioEngine] Failed to release audio stream:', error);
    }

    await this.pendingAudioWrites;
  }

  private async releaseWhisperContext(): Promise<void> {
    if (!this.whisperContext) {
      return;
    }

    try {
      if (typeof this.whisperContext.release === 'function') {
        await this.whisperContext.release();
      }
    } catch (error) {
      console.warn('[AudioEngine] Failed to release whisper context:', error);
    } finally {
      this.whisperContext = null;
    }
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

  private normalizeTranscript(text: string): string {
    if (!text) {
      return '';
    }

    const sentences = text
      .split(SENTENCE_SPLIT_REGEX)
      .map(sentence => sentence.trim())
      .filter(Boolean);

    if (sentences.length === 0) {
      return text.trim();
    }

    const deduped: string[] = [];
    for (const sentence of sentences) {
      if (deduped[deduped.length - 1]?.toLowerCase() === sentence.toLowerCase()) {
        continue;
      }
      deduped.push(sentence);
    }

    return deduped.join(' ').trim();
  }
}
