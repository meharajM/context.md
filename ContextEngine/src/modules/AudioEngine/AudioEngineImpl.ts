import { Image, NativeModules, Platform } from 'react-native';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';

// @ts-ignore
import { initWhisper } from '../../../node_modules/whisper.rn/lib/module/index';
// @ts-ignore
import { AudioPcmStreamAdapter } from '../../../node_modules/whisper.rn/lib/module/realtime-transcription/adapters/AudioPcmStreamAdapter';
// @ts-ignore
import { WavFileWriter } from '../../../node_modules/whisper.rn/lib/module/utils/WavFileWriter';
import { AudioEngine, AudioReadiness, MeetingRecordingCallbacks, TranscriptionResult } from './index';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import {
  downloadWhisperModel as installWhisperModel,
  getWhisperModelPath,
  isWhisperModelInstalled,
  type WhisperModelDownloadProgress,
} from './whisperModelManager';
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

const NON_SPEECH_SEGMENT_REGEX = /(?:\[|\()\s*(?:silence|blank(?:[_\s]+audio)?|pause|music(?:[_\s]+playing)?|sound(?:[_\s]+effects?)?|explosion|noise|buzzing|applause|laughter|inaudible|birds?(?:[_\s]+chirping)?|wind(?:\s+(?:blowing|howling))?)\s*(?:\]|\))/gi;
const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;
const MEETING_SEGMENT_MS = 20000;
const MEETING_TRANSCRIBE_THREADS = 4;
const MEETING_SEGMENT_BYTES = RECORDING_PCM_FORMAT.sampleRate * (MEETING_SEGMENT_MS / 1000) *
  RECORDING_PCM_FORMAT.channels * (RECORDING_PCM_FORMAT.bitsPerSample / 8);

interface MeetingTranscriptionState {
  callbacks: MeetingRecordingCallbacks;
  totalBytes: number;
  segmentStartByte: number;
  segmentBytes: number;
  segmentIndex: number;
  segmentPath: string | null;
  segmentWriter: any;
  transcriptionQueue: Promise<void>;
  transcriptSegments: Array<{ startMs: number; endMs: number; text: string }>;
  transcriptionError: string | null;
}

export class AudioEngineImpl implements AudioEngine {
  private whisperContext: any = null;
  private isRecording = false;
  private latestError: string | null = null;
  private currentAudioFilePath: string | null = null;
  private currentMeetingId: string | null = null;
  private meetingTranscription: MeetingTranscriptionState | null = null;
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

  private WHISPER_MODEL = getWhisperModelPath();
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

  private async ensureTranscriptionReady(): Promise<boolean> {
    if (Platform.OS === 'ios') return SynthesisService.canTranscribeAudio();
    if (this.whisperContext) {
      return true;
    }

    const readiness = await this.initializeModels();
    return readiness.transcriptionReady && this.whisperContext != null;
  }

  async initializeModels(): Promise<AudioReadiness> {
    const missingModels: string[] = [];
    const errors: string[] = [];
    let transcriptionReady = false;

    if (Platform.OS === 'ios') {
      try {
        transcriptionReady = await SynthesisService.canTranscribeAudio();
        if (!transcriptionReady) {
          missingModels.push('Gemma 3n E2B');
          errors.push('Select and install Gemma 3n E2B in Settings; that same model handles transcription and note organization.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.error('[AudioEngine] Gemma audio readiness check failed:', message, error);
      }
    } else if (!this.whisperContext) {
      try {
        if (!(await isWhisperModelInstalled())) {
          missingModels.push(this.WHISPER_MODEL);
        } else {
          this.whisperContext = await initWhisper({
            filePath: this.WHISPER_MODEL,
            useGpu: false,
            useCoreMLIos: false,
          });
          console.log('Whisper engine ready (Android app storage).');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.error('[AudioEngine] whisper init CRASHED:', message, error);
      }
      transcriptionReady = this.whisperContext != null;
    }

    this.readiness = {
      transcriptionReady,
      wakeWordReady: false,
      missingModels,
      errors,
    };

    return { ...this.readiness };
  }

  getReadiness(): AudioReadiness {
    return { ...this.readiness };
  }

  async downloadWhisperModel(
    onProgress?: (update: WhisperModelDownloadProgress) => void,
  ): Promise<AudioReadiness> {
    if (Platform.OS === 'android') {
      await installWhisperModel(onProgress);
    }
    return this.initializeModels();
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

  async startRecording(
    onCaptureError?: (error: string) => void,
    meeting?: MeetingRecordingCallbacks,
  ): Promise<void> {
    if (this.recoveryPromise) await this.recoveryPromise;
    if (this.isRecording) return;

    const transcriptionReady = await this.ensureTranscriptionReady();
    if (!transcriptionReady) {
      throw new Error(Platform.OS === 'ios' ? 'Gemma audio transcription is unavailable' : 'Whisper model is unavailable');
    }
    if (Platform.OS === 'ios') await SynthesisService.prepareAudioTranscription();

    this.isRecording = true;
    this.latestError = null;
    this.currentMeetingId = meeting?.meetingId ?? null;
    this.meetingTranscription = meeting || Platform.OS === 'ios' ? {
      callbacks: meeting ?? {
        meetingId: `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        onAudioFilePath: async () => undefined,
        onTranscript: async () => undefined,
        beforeTranscription: async () => undefined,
      },
      totalBytes: 0,
      segmentStartByte: 0,
      segmentBytes: 0,
      segmentIndex: 0,
      segmentPath: null,
      segmentWriter: null,
      transcriptionQueue: Promise.resolve(),
      transcriptSegments: [],
      transcriptionError: null,
    } : null;
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
      await describeRecording(this.currentAudioFilePath, this.currentMeetingId ?? undefined);
      if (meeting) await meeting.onAudioFilePath(this.currentAudioFilePath);
      if (Platform.OS === 'android') {
        const startRecordingService = NativeModules.EventEmitter?.startActiveRecordingService;
        if (typeof startRecordingService !== 'function') {
          throw new Error('Android recording service is unavailable');
        }
        await startRecordingService.call(NativeModules.EventEmitter, Boolean(meeting));
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
          .then(async () => {
            await wavWriter.appendAudioData(streamData.data);
            if (this.meetingTranscription) await this.appendMeetingAudioData(streamData.data);
          })
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
      this.meetingTranscription = null;
      this.currentMeetingId = null;
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
        const noteId = this.currentMeetingId ?? recordingNoteId(retainedAudioPath);
        if (this.currentMeetingId) await onAudioRetained(retainedAudioPath, noteId, this.currentMeetingId);
        else await onAudioRetained(retainedAudioPath, noteId);
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
          await this.finishMeetingSegment();
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
      let transcription: TranscriptionResult;
      if (this.meetingTranscription) {
        const meeting = this.meetingTranscription;
        await meeting.transcriptionQueue;
        transcription = {
          text: meeting.transcriptSegments.map(segment => segment.text).join(' ').trim(),
          segments: [...meeting.transcriptSegments],
          ...(meeting.transcriptionError ? { error: meeting.transcriptionError } : {}),
          ...(retainedAudioPath ? { audioFilePath: retainedAudioPath } : {}),
        };
      } else {
        transcription = retainedAudioPath
          ? await this.transcribeFile(retainedAudioPath)
          : audioFilePath
            ? await this.transcribeFile(audioFilePath)
            : { text: '' };
      }
      const text = transcription.text.trim();
      const transcriptionError = transcription.error?.trim() || this.latestError || (!text ? 'No speech detected' : null);

      const result: TranscriptionResult = {
        text,
        ...(transcription.confidence !== undefined ? { confidence: transcription.confidence } : {}),
        ...(transcriptionError ? { error: transcriptionError } : {}),
        ...(retainedAudioPath ? { audioFilePath: retainedAudioPath } : {}),
      };

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
      this.currentMeetingId = null;
      this.meetingTranscription = null;
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
    const normalizedInput = typeof filePathOrAsset === 'string'
      ? filePathOrAsset.replace(/^file:\/\//i, '')
      : Platform.OS === 'ios'
        ? Image.resolveAssetSource(filePathOrAsset)?.uri.replace(/^file:\/\//i, '')
        : filePathOrAsset;
    if (!normalizedInput) return { text: '', error: 'Audio file path is unavailable' };

    if (Platform.OS === 'ios') {
      if (!(await this.ensureTranscriptionReady())) {
        return { text: '', error: 'Select and install Gemma 3n E2B to transcribe voice notes.' };
      }
      if (typeof normalizedInput !== 'string') return { text: '', error: 'Audio file path is unavailable' };
      return this.transcribeIosWav(normalizedInput);
    }

    const whisperReady = await this.ensureTranscriptionReady();
    if (!whisperReady || !this.whisperContext) {
      return { text: '' };
    }

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

    return { text };
  }

  private async transcribeIosWav(filePath: string): Promise<TranscriptionResult> {
    const fileSize = Number((await RNFS.stat(filePath)).size);
    const header = Buffer.from(await RNFS.read(filePath, 44, 0, 'base64'), 'base64');
    if (
      fileSize < 44 || header.length !== 44 || header.toString('ascii', 0, 4) !== 'RIFF' ||
      header.toString('ascii', 8, 16) !== 'WAVEfmt ' || header.readUInt32LE(16) !== 16 ||
      header.readUInt16LE(20) !== 1 || header.readUInt16LE(22) !== RECORDING_PCM_FORMAT.channels ||
      header.readUInt32LE(24) !== RECORDING_PCM_FORMAT.sampleRate ||
      header.readUInt32LE(28) !== RECORDING_PCM_FORMAT.sampleRate * RECORDING_PCM_FORMAT.channels *
        (RECORDING_PCM_FORMAT.bitsPerSample / 8) ||
      header.readUInt16LE(32) !== RECORDING_PCM_FORMAT.channels * (RECORDING_PCM_FORMAT.bitsPerSample / 8) ||
      header.readUInt16LE(34) !== RECORDING_PCM_FORMAT.bitsPerSample ||
      header.toString('ascii', 36, 40) !== 'data'
    ) {
      return { text: '', error: 'Gemma transcription requires 16 kHz mono PCM WAV audio.' };
    }

    const audioBytes = fileSize - 44;
    const frameBytes = RECORDING_PCM_FORMAT.channels * (RECORDING_PCM_FORMAT.bitsPerSample / 8);
    if (audioBytes <= 0 || audioBytes % frameBytes !== 0) {
      return { text: '', error: 'WAV audio contains an incomplete PCM frame.' };
    }
    if (audioBytes <= MEETING_SEGMENT_BYTES) {
      const transcript = await SynthesisService.transcribeAudio(filePath);
      return { text: this.normalizeTranscript(transcript.replace(NON_SPEECH_SEGMENT_REGEX, '').trim()) };
    }

    const directory = RNFS.CachesDirectoryPath + '/gemma-transcription';
    await RNFS.mkdir(directory);
    const bytesPerSecond = RECORDING_PCM_FORMAT.sampleRate * frameBytes;
    const segments: Array<{ startMs: number; endMs: number; text: string }> = [];
    let error: string | undefined;
    for (let offset = 0, index = 0; offset < audioBytes; offset += MEETING_SEGMENT_BYTES, index += 1) {
      const chunkBytes = Math.min(MEETING_SEGMENT_BYTES, audioBytes - offset);
      const chunkPath = `${directory}/retry-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}.wav`;
      try {
        const writer = new WavFileWriter(RNFS as any, chunkPath, RECORDING_PCM_FORMAT);
        await writer.initialize();
        const pcm = Buffer.from(await RNFS.read(filePath, chunkBytes, 44 + offset, 'base64'), 'base64');
        if (pcm.length !== chunkBytes) throw new Error('Could not read a complete WAV audio segment.');
        await writer.appendAudioData(pcm);
        await writer.finalize();
        const transcript = await SynthesisService.transcribeAudio(chunkPath);
        const text = this.normalizeTranscript(transcript.replace(NON_SPEECH_SEGMENT_REGEX, '').trim());
        if (text) {
          const startMs = Math.round(offset / bytesPerSecond * 1000);
          segments.push({ startMs, endMs: startMs + Math.round(chunkBytes / bytesPerSecond * 1000), text });
        }
      } catch (chunkError) {
        error = chunkError instanceof Error ? chunkError.message : String(chunkError);
        break;
      } finally {
        await RNFS.unlink(chunkPath).catch(() => undefined);
      }
    }

    const text = segments.map(segment => segment.text).join(' ').trim();
    return {
      text,
      segments,
      ...(error ? { error } : !text ? { error: 'No speech detected' } : {}),
    };
  }

  private async transcribeWithWhisperContext(
    filePath: string | number,
    prompt?: string,
    maxThreads: number = this.TRANSCRIBE_OPTIONS.maxThreads,
  ): Promise<any> {
    const { promise } = this.whisperContext.transcribe(filePath, {
      ...this.TRANSCRIBE_OPTIONS,
      ...(prompt ? { prompt } : {}),
      maxThreads,
    });
    return promise;
  }

  private async appendMeetingAudioData(data: Uint8Array): Promise<void> {
    const meeting = this.meetingTranscription;
    if (!meeting) return;
    let offset = 0;
    while (offset < data.length) {
      if (!meeting.segmentWriter) {
        const directory = RNFS.CachesDirectoryPath + '/meeting-transcription';
        await RNFS.mkdir(directory);
        meeting.segmentPath = directory + '/' + meeting.callbacks.meetingId + '-' + meeting.segmentIndex + '.wav';
        meeting.segmentWriter = new WavFileWriter(RNFS as any, meeting.segmentPath, RECORDING_PCM_FORMAT);
        await meeting.segmentWriter.initialize();
        meeting.segmentBytes = 0;
        meeting.segmentStartByte = meeting.totalBytes;
      }
      const count = Math.min(MEETING_SEGMENT_BYTES - meeting.segmentBytes, data.length - offset);
      await meeting.segmentWriter.appendAudioData(data.subarray(offset, offset + count));
      meeting.segmentBytes += count;
      meeting.totalBytes += count;
      offset += count;
      if (meeting.segmentBytes === MEETING_SEGMENT_BYTES) await this.finishMeetingSegment();
    }
  }

  private async finishMeetingSegment(): Promise<void> {
    const meeting = this.meetingTranscription;
    if (!meeting?.segmentWriter || !meeting.segmentPath || meeting.segmentBytes === 0) return;
    const writer = meeting.segmentWriter;
    const path = meeting.segmentPath;
    const bytesPerSecond = RECORDING_PCM_FORMAT.sampleRate * RECORDING_PCM_FORMAT.channels *
      (RECORDING_PCM_FORMAT.bitsPerSample / 8);
    const startMs = Math.round(meeting.segmentStartByte / bytesPerSecond * 1000);
    const durationMs = Math.round(meeting.segmentBytes / bytesPerSecond * 1000);
    meeting.segmentWriter = null;
    meeting.segmentPath = null;
    meeting.segmentIndex += 1;
    try {
      await writer.finalize();
    } catch (error) {
      await RNFS.unlink(path).catch(() => undefined);
      throw error;
    }
    meeting.transcriptionQueue = meeting.transcriptionQueue.then(async () => {
      try {
        await meeting.callbacks.beforeTranscription();
        if (Platform.OS !== 'ios') {
          const whisperReady = await this.ensureTranscriptionReady();
          if (!whisperReady || !this.whisperContext) throw new Error('Whisper model is unavailable');
        }
        const result = Platform.OS === 'ios'
          ? await this.transcribeFile(path)
          : await this.transcribeWithWhisperContext(
            path,
            'Transcribe English conversation from an in-person meeting.',
            MEETING_TRANSCRIBE_THREADS,
          );
        if (result.isAborted || result.error) throw new Error(result.error ?? 'Meeting transcription was aborted');
        const rawSegments = Array.isArray(result.segments) ? result.segments : [];
        const segments = rawSegments.flatMap((segment: { t0?: number; t1?: number; text?: string }) => {
          const text = this.normalizeTranscript((segment.text ?? '').replace(NON_SPEECH_SEGMENT_REGEX, '').trim());
          if (!text) return [];
          return [{
            startMs: startMs + Math.max(0, Math.round((segment.t0 ?? 0) * 10)),
            endMs: startMs + Math.max(0, Math.round((segment.t1 ?? segment.t0 ?? 0) * 10)),
            text,
          }];
        });
        const transcriptSegments = segments.length ? segments : (() => {
          const rawText = Platform.OS === 'ios' ? result.text : result.result;
          const text = this.normalizeTranscript((rawText ?? '').replace(NON_SPEECH_SEGMENT_REGEX, '').trim());
          return text ? [{ startMs, endMs: startMs + durationMs, text }] : [];
        })();
        if (transcriptSegments.length) {
          meeting.transcriptSegments.push(...transcriptSegments);
          await meeting.callbacks.onTranscript(transcriptSegments);
        }
        await RNFS.unlink(path).catch(() => undefined);
      } catch (error) {
        meeting.transcriptionError ??= error instanceof Error ? error.message : String(error);
        console.warn('[AudioEngine] Meeting segment transcription failed; retained recording is preserved:', error);
        await RNFS.unlink(path).catch(() => undefined);
      }
    });
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
      await describeRecording(destinationPath, this.currentMeetingId ?? undefined);

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
