import { MAX_PROMPT_BYTES, SynthesisEngine, splitUtf8, utf8Length } from './index';
import { LiteRtSynthesisRuntime } from './runtimes/LiteRtSynthesisRuntime';
import { RawFallbackSynthesisRuntime } from './runtimes/RawFallbackSynthesisRuntime';
import {
  LiteRtModelConfig,
  RuntimeReadiness,
  SynthesizedThought,
  SynthesisRuntime,
  TopicContext,
} from './runtimes/types';

interface SynthesisOptions {
  liteRtEnabled: boolean;
  modelConfig: LiteRtModelConfig;
}

const FALLBACK_TOPIC = 'Inbox';
const GENERIC_TOPIC_NAMES = new Set(['general', 'notes', 'misc', 'miscellaneous', 'random', 'other']);

export class SynthesisService {
  private static options: SynthesisOptions = {
    liteRtEnabled: true,
    modelConfig: new LiteRtSynthesisRuntime().getModelConfig(),
  };
  private static liteRtRuntime: SynthesisRuntime = new LiteRtSynthesisRuntime();
  private static rawFallbackRuntime: SynthesisRuntime = new RawFallbackSynthesisRuntime();
  private static liteRtReadiness: RuntimeReadiness | null = null;
  private static requestedOptions = this.options;
  private static operationQueue: Promise<unknown> = Promise.resolve();

  static configure(options: Partial<SynthesisOptions>): void {
    this.requestedOptions = {
      ...this.requestedOptions,
      ...options,
    };
  }

  private static runExclusive<T>(operation: () => Promise<T>, applyConfiguration = true, options: { onProgress?: () => void; isCancelled?: () => boolean } = {}): Promise<T> {
    const waiting = options.onProgress ? setInterval(() => {
      if (options.isCancelled?.()) {
        if (waiting) clearInterval(waiting);
      } else options.onProgress?.();
    }, 10000) : null;
    const result = this.operationQueue.then(async () => {
      try {
        if (options.isCancelled?.()) throw new Error('Synthesis attempt cancelled');
        options.onProgress?.();
        if (applyConfiguration && JSON.stringify(this.options) !== JSON.stringify(this.requestedOptions)) {
          await this.liteRtRuntime.release();
          if (options.isCancelled?.()) throw new Error('Synthesis attempt cancelled');
          this.options = { ...this.requestedOptions, modelConfig: { ...this.requestedOptions.modelConfig } };
          this.liteRtRuntime = new LiteRtSynthesisRuntime(this.options.modelConfig);
          this.liteRtReadiness = null;
        }
        return await operation();
      } finally {
        if (waiting) clearInterval(waiting);
      }
    });
    this.operationQueue = result.catch(() => undefined);
    return result;
  }

  static initialize(): Promise<RuntimeReadiness> {
    return this.runExclusive(() => this.initializeCurrentRuntime());
  }

  private static async initializeCurrentRuntime(onProgress?: () => void): Promise<RuntimeReadiness> {
    if (!this.options.liteRtEnabled) {
      this.liteRtReadiness = {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT synthesis is disabled; captures will be stored raw in Inbox.',
      };
      return this.liteRtReadiness;
    }

    this.liteRtReadiness = await this.liteRtRuntime.initialize(onProgress);
    return this.liteRtReadiness;
  }

  static getLiteRtReadiness(): RuntimeReadiness | null {
    if (JSON.stringify(this.options) !== JSON.stringify(this.requestedOptions)) return null;
    return this.liteRtReadiness ? { ...this.liteRtReadiness } : null;
  }

  static extractReminder(prompt: string): Promise<string | null> {
    return this.runExclusive(async () => {
      if (!this.options.liteRtEnabled || !this.liteRtRuntime.extractReminder) return null;
      if (!this.liteRtReadiness?.available) await this.initializeCurrentRuntime();
      if (!this.liteRtReadiness?.available) return null;
      try {
        return await this.liteRtRuntime.extractReminder(prompt);
      } catch (error) {
        this.liteRtReadiness = null;
        throw error;
      }
    });
  }

  private static selectTopicContexts(
    topics: string[],
    topicContexts: TopicContext[],
  ): TopicContext[] {
    const contextByTopic = new Map(
      topicContexts.map(context => [context.topic.trim().toLowerCase(), context]),
    );

    return topics.flatMap(topic => {
      const context = contextByTopic.get(topic.trim().toLowerCase());
      return context ? [context] : [];
    });
  }

  private static uniqueTopics(topics: string[]): string[] {
    const seen = new Set<string>();
    return topics.filter(topic => {
      const normalized = topic.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private static isRouteableTopic(topic: string): boolean {
    const normalizedTopic = topic.trim().toLowerCase();
    return Boolean(normalizedTopic) &&
      normalizedTopic !== FALLBACK_TOPIC.toLowerCase() &&
      !GENERIC_TOPIC_NAMES.has(normalizedTopic);
  }

  static synthesize(
    transcript: string,
    existingTopics: string[],
    selectedTopic?: string | null,
    topicContexts: TopicContext[] = [],
    options: { onProgress?: () => void; isCancelled?: () => boolean } = {},
  ): Promise<SynthesizedThought> {
    const progress = () => {
      if (options.isCancelled?.()) throw new Error('Synthesis attempt cancelled');
      options.onProgress?.();
    };
    return this.runExclusive(() => this.synthesizeCurrentRuntime(transcript, existingTopics, selectedTopic, topicContexts, progress), true, options);
  }

  private static async synthesizeCurrentRuntime(
    transcript: string,
    existingTopics: string[],
    selectedTopic?: string | null,
    topicContexts: TopicContext[] = [],
    onProgress?: () => void,
  ): Promise<SynthesizedThought> {
    onProgress?.();
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

    try {
      if (!this.liteRtReadiness) {
        await this.initializeCurrentRuntime(onProgress);
        onProgress?.();
      }

      if (!this.liteRtReadiness?.available) {
        return this.rawFallbackRuntime.synthesize({
          transcript: trimmedTranscript,
          existingTopics,
        });
      }

      const result = await this.summarizeAll(trimmedTranscript, selectedTopic?.trim(), topicContexts, onProgress);
      if (selectedTopic?.trim()) {
        return { ...result, topic: selectedTopic.trim(), refinedText: trimmedTranscript };
      }
      return await this.routeAcrossLibrary(result, trimmedTranscript, existingTopics, topicContexts, onProgress);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.liteRtReadiness = {
        available: false,
        status: detail.includes('timed out') ? 'unavailable' : 'error',
        detail: `LiteRT synthesis failed; captures will be stored raw in Inbox. ${detail}`,
        nativeState: {
          crashRisk: true,
          code: detail.includes('timed out') ? 'LITERT_SYNTHESIS_TIMEOUT' : 'LITERT_SYNTHESIS_FAILED',
          modelPath: this.options.modelConfig.modelPath,
          backend: this.options.modelConfig.backend,
          maxTokens: this.options.modelConfig.maxTokens,
        },
      };
      console.warn('LiteRT synthesis failed; switching to raw Inbox fallback.', detail);
      return this.rawFallbackRuntime.synthesize({
        transcript: trimmedTranscript,
        existingTopics,
      });
    }
  }

  private static promptBudget(): number {
    return Math.min(MAX_PROMPT_BYTES, this.options.modelConfig.maxTokens - 384);
  }

  private static async callRuntime(
    input: Parameters<SynthesisRuntime['synthesize']>[0],
    onProgress?: () => void,
  ): Promise<SynthesizedThought> {
    const result = await this.liteRtRuntime.synthesize(input);
    onProgress?.();
    if (result.source !== 'litert' || (!result.clarification && !this.isRouteableTopic(result.topic))) {
      throw new Error('Invalid synthesis output');
    }
    return result;
  }

  private static async summarizeAll(
    transcript: string,
    selectedTopic: string | undefined,
    topicContexts: TopicContext[],
    onProgress?: () => void,
  ): Promise<SynthesizedThought> {
    const topics = selectedTopic ? [selectedTopic] : [];
    const contexts = this.selectTopicContexts(topics, topicContexts);
    const inputBudget = this.promptBudget() - utf8Length(SynthesisEngine.generatePrompt('', topics, contexts));
    if (inputBudget < 256) throw new Error('Synthesis context is too small');

    const summarizePart = async (part: string, retry = 0): Promise<SynthesizedThought[]> => {
      try {
        const result = await this.callRuntime({ transcript: part, existingTopics: topics, topicContexts: contexts, task: 'summary' }, onProgress);
        if (!result.summary || result.clarification) throw new Error('Missing synthesis summary');
        return [result];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // A tokenizer/runtime may reject an otherwise bounded call; retry smaller without skipping data.
        if (retry >= 2 || utf8Length(part) < 32 || !/(context|token|input|prompt).*(limit|exceed|capacity|size|long)/i.test(message)) throw error;
        await this.initializeCurrentRuntime(onProgress);
        if (!this.liteRtReadiness?.available) throw error;
        onProgress?.();
        const results: SynthesizedThought[] = [];
        for (const chunk of splitUtf8(part, Math.ceil(utf8Length(part) / 2))) {
          results.push(...await summarizePart(chunk, retry + 1));
        }
        return results;
      }
    };

    let parts = splitUtf8(transcript, inputBudget);
    for (;;) {
      const summaries: SynthesizedThought[] = [];
      for (const part of parts) summaries.push(...await summarizePart(part));
      if (summaries.length === 1) return { ...summaries[0], refinedText: transcript };
      const combined = summaries.map(result => result.summary!).join('\n');
      // Every reduction must shrink, even when a model ignores the requested summary length.
      if (utf8Length(combined) >= parts.reduce((size, part) => size + utf8Length(part), 0)) {
        throw new Error('Synthesis summaries did not converge');
      }
      parts = splitUtf8(combined, inputBudget);
    }
  }

  private static async routeAcrossLibrary(
    summary: SynthesizedThought,
    transcript: string,
    existingTopics: string[],
    topicContexts: TopicContext[],
    onProgress?: () => void,
  ): Promise<SynthesizedThought> {
    const remaining = this.uniqueTopics(existingTopics).filter(topic => topic.trim().toLowerCase() !== FALLBACK_TOPIC.toLowerCase());
    let contenders: string[] = [];
    let clarification: SynthesizedThought['clarification'];
    while (remaining.length > 0) {
      const batch = [...contenders];
      let added = 0;
      while (remaining.length > 0) {
        const next = [...batch, remaining[0]];
        if (utf8Length(SynthesisEngine.generatePrompt(summary.summary!, next, this.selectTopicContexts(next, topicContexts), 'route')) > this.promptBudget()) break;
        batch.push(remaining.shift()!);
        added++;
      }
      if (!added) throw new Error('Topic candidates exceed the bounded input budget');
      const result = await this.callRuntime({
        transcript: summary.summary!,
        existingTopics: batch,
        topicContexts: this.selectTopicContexts(batch, topicContexts),
        task: 'route',
      }, onProgress);
      const resolveTopic = (selection: string): string | undefined => {
        const selected = selection.trim();
        const match = /^T([1-9][0-9]*)\b/i.exec(selected);
        if (match) return batch[Number(match[1]) - 1];
        const normalize = (topic: string) => topic.trim().replace(/\s+/g, ' ').toLowerCase();
        return batch.find(topic => normalize(topic) === normalize(selected));
      };
      if (result.clarification) {
        const options = result.clarification.options.map(option => ({ ...option, topic: resolveTopic(option.topic) }));
        if (options.some(option => !option.topic)) throw new Error('Invalid clarification topic');
        clarification = { question: result.clarification.question, options: options as NonNullable<typeof clarification>['options'] };
        contenders = clarification.options.map(option => option.topic);
      } else {
        clarification = undefined;
        const matched = resolveTopic(result.topic);
        if (!matched && result.topic !== 'NEW') throw new Error('Invalid topic selection');
        contenders = matched ? [matched] : [];
      }
    }
    return {
      ...summary,
      refinedText: transcript,
      topic: clarification ? FALLBACK_TOPIC : contenders[0] ?? summary.topic,
      ...(clarification ? { clarification } : {}),
    };
  }

  static release(): Promise<void> {
    return this.runExclusive(async () => {
      await this.liteRtRuntime.release();
      await this.rawFallbackRuntime.release();
      this.liteRtReadiness = null;
    }, false);
  }

  static resetForTests(): void {
    this.options = {
      liteRtEnabled: true,
      modelConfig: new LiteRtSynthesisRuntime().getModelConfig(),
    };
    this.requestedOptions = this.options;
    this.operationQueue = Promise.resolve();
    this.liteRtRuntime = new LiteRtSynthesisRuntime();
    this.rawFallbackRuntime = new RawFallbackSynthesisRuntime();
    this.liteRtReadiness = null;
  }
}

export type { RuntimeReadiness, SynthesizedThought, SynthesisRuntime, TopicContext };
