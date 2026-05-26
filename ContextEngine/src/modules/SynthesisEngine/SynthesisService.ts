import { LiteRtSynthesisRuntime } from './runtimes/LiteRtSynthesisRuntime';
import { RawFallbackSynthesisRuntime } from './runtimes/RawFallbackSynthesisRuntime';
import { LiteRtModelConfig, RuntimeReadiness, SynthesizedThought, SynthesisRuntime } from './runtimes/types';

interface SynthesisOptions {
  liteRtEnabled: boolean;
  modelConfig: LiteRtModelConfig;
}

export class SynthesisService {
  private static options: SynthesisOptions = {
    liteRtEnabled: true,
    modelConfig: new LiteRtSynthesisRuntime().getModelConfig(),
  };
  private static liteRtRuntime: SynthesisRuntime = new LiteRtSynthesisRuntime();
  private static rawFallbackRuntime: SynthesisRuntime = new RawFallbackSynthesisRuntime();
  private static liteRtReadiness: RuntimeReadiness | null = null;

  static configure(options: Partial<SynthesisOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.liteRtRuntime = new LiteRtSynthesisRuntime(this.options.modelConfig);
    this.liteRtReadiness = null;
  }

  static async initialize(): Promise<RuntimeReadiness> {
    if (!this.options.liteRtEnabled) {
      this.liteRtReadiness = {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT synthesis is disabled in settings.',
      };
      return this.liteRtReadiness;
    }

    this.liteRtReadiness = await this.liteRtRuntime.initialize();
    return this.liteRtReadiness;
  }

  static getLiteRtReadiness(): RuntimeReadiness | null {
    return this.liteRtReadiness ? { ...this.liteRtReadiness } : null;
  }

  static async synthesize(transcript: string, existingTopics: string[]): Promise<SynthesizedThought> {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      return this.rawFallbackRuntime.synthesize({
        transcript,
        existingTopics,
      });
    }

    if (!this.options.liteRtEnabled) {
      return this.rawFallbackRuntime.synthesize({
        transcript: trimmedTranscript,
        existingTopics,
      });
    }

    if (!this.liteRtReadiness) {
      await this.initialize();
    }

    if (!this.liteRtReadiness?.available) {
      return this.rawFallbackRuntime.synthesize({
        transcript: trimmedTranscript,
        existingTopics,
      });
    }

    try {
      return await this.liteRtRuntime.synthesize({
        transcript: trimmedTranscript,
        existingTopics,
      });
    } catch (error) {
      console.warn('LiteRT synthesis failed; saving raw transcript to Inbox:', error);
      return this.rawFallbackRuntime.synthesize({
        transcript: trimmedTranscript,
        existingTopics,
      });
    }
  }

  static async release(): Promise<void> {
    await this.liteRtRuntime.release();
    await this.rawFallbackRuntime.release();
    this.liteRtReadiness = null;
  }

  static resetForTests(): void {
    this.options = {
      liteRtEnabled: true,
      modelConfig: new LiteRtSynthesisRuntime().getModelConfig(),
    };
    this.liteRtRuntime = new LiteRtSynthesisRuntime();
    this.rawFallbackRuntime = new RawFallbackSynthesisRuntime();
    this.liteRtReadiness = null;
  }
}

export type { RuntimeReadiness, SynthesizedThought, SynthesisRuntime };
