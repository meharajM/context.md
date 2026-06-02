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
        available: true,
        status: 'ready',
        detail: 'Heuristic offline synthesis is active.',
      };
      return this.liteRtReadiness;
    }

    this.liteRtReadiness = await this.liteRtRuntime.initialize();
    return this.liteRtReadiness;
  }

  static getLiteRtReadiness(): RuntimeReadiness | null {
    return this.liteRtReadiness ? { ...this.liteRtReadiness } : null;
  }

  private static selectCandidateTopics(transcript: string, existingTopics: string[]): string[] {
    if (existingTopics.length <= 10) {
      return existingTopics;
    }

    // Prioritize topics that share words with the transcript
    const words = new Set(transcript.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const topic of existingTopics) {
      const topicLower = topic.toLowerCase();
      const hasMatch = Array.from(words).some(word => topicLower.includes(word));
      if (hasMatch) {
        matched.push(topic);
      } else {
        unmatched.push(topic);
      }
    }

    const candidates = [...matched];
    const slotsLeft = 10 - candidates.length;
    if (slotsLeft > 0) {
      candidates.push(...unmatched.slice(0, slotsLeft));
    }

    return candidates.slice(0, 10);
  }

  static async synthesize(
    transcript: string,
    existingTopics: string[],
    selectedTopic?: string | null,
  ): Promise<SynthesizedThought> {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      return this.rawFallbackRuntime.synthesize({
        transcript,
        existingTopics,
      });
    }

    if (!this.options.liteRtEnabled) {
      return this.applySelectedTopic(
        await this.rawFallbackRuntime.synthesize({
          transcript: trimmedTranscript,
          existingTopics,
        }),
        selectedTopic,
      );
    }

    if (!this.liteRtReadiness) {
      await this.initialize();
    }

    if (!this.liteRtReadiness?.available) {
      return this.applySelectedTopic(
        await this.rawFallbackRuntime.synthesize({
          transcript: trimmedTranscript,
          existingTopics,
        }),
        selectedTopic,
      );
    }

    try {
      if (selectedTopic?.trim()) {
        return await this.synthesizeSelectedTopic(trimmedTranscript, existingTopics, selectedTopic.trim());
      }

      return await this.synthesizeAutoTopic(trimmedTranscript, existingTopics);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.liteRtReadiness = {
        available: false,
        status: detail.includes('timed out') ? 'unavailable' : 'error',
        detail: `LiteRT synthesis failed; heuristic offline synthesis is active. ${detail}`,
        nativeState: {
          crashRisk: true,
          code: detail.includes('timed out') ? 'LITERT_SYNTHESIS_TIMEOUT' : 'LITERT_SYNTHESIS_FAILED',
          modelPath: this.options.modelConfig.modelPath,
          backend: this.options.modelConfig.backend,
          maxTokens: this.options.modelConfig.maxTokens,
        },
      };
      console.warn('LiteRT synthesis failed; switching to heuristic synthesis:', error);
      return this.applySelectedTopic(
        await this.rawFallbackRuntime.synthesize({
          transcript: trimmedTranscript,
          existingTopics,
        }),
        selectedTopic,
      );
    }
  }

  private static applySelectedTopic(
    thought: SynthesizedThought,
    selectedTopic?: string | null,
  ): SynthesizedThought {
    const normalizedTopic = selectedTopic?.trim();
    if (!normalizedTopic) {
      return thought;
    }

    return {
      ...thought,
      topic: normalizedTopic,
    };
  }

  private static async synthesizeSelectedTopic(
    transcript: string,
    existingTopics: string[],
    selectedTopic: string,
  ): Promise<SynthesizedThought> {
    const candidateTopics = this.selectCandidateTopics(transcript, [selectedTopic, ...existingTopics]);
    const result = await this.liteRtRuntime.synthesize({
      transcript,
      existingTopics: [selectedTopic, ...candidateTopics.filter(topic => topic !== selectedTopic)],
    });

    return {
      ...result,
      topic: selectedTopic,
    };
  }

  private static async synthesizeAutoTopic(
    transcript: string,
    existingTopics: string[],
  ): Promise<SynthesizedThought> {
    const candidateTopics = this.selectCandidateTopics(transcript, existingTopics);
    const identification = await this.liteRtRuntime.synthesize({
      transcript,
      existingTopics: candidateTopics,
    });

    // There is no topic context to refine against when the library is empty.
    if (candidateTopics.length === 0) {
      return identification;
    }

    const refinementTopics = this.selectCandidateTopics(identification.refinedText || transcript, [
      identification.topic,
      ...candidateTopics,
    ]);
    const refinement = await this.liteRtRuntime.synthesize({
      transcript: identification.refinedText || transcript,
      existingTopics: refinementTopics,
    });

    return {
      ...refinement,
      topic: refinement.topic || identification.topic,
    };
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
