import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { getDefaultSynthesisModel, toLiteRtModelConfig } from '../models';
import { MAX_PROMPT_BYTES, MAX_SUMMARY_BYTES, SynthesisEngine, utf8Length } from '../index';
import { normalizeSynthesizedThought, RuntimeReadiness, SynthesisRuntime, SynthesizedThought } from './types';
import type { LiteRtModelConfig, TopicContext } from './types';

interface LiteRtNativeModule {
  extractReminder?(prompt: string): Promise<string>;
  isAvailable(): Promise<boolean>;
  loadModel(config: LiteRtModelConfig): Promise<{ loaded: boolean; modelPath: string; backend: string }>;
  synthesize(input: {
    transcript: string;
    existingTopics: string[];
    prompt?: string;
  }): Promise<Partial<SynthesizedThought>>;
  benchmark(fixtures: string[]): Promise<Record<string, unknown>>;
  release(): Promise<void>;
}

const LiteRtModule = NativeModules.LiteRtModule as LiteRtNativeModule | undefined;
const DEFAULT_MODEL_CONFIG = toLiteRtModelConfig(getDefaultSynthesisModel());
const BUNDLED_FALLBACK_MODEL_PATH = Platform.OS === 'ios'
  ? `${RNFS.MainBundlePath}/test_lm.litertlm`
  : `${RNFS.DocumentDirectoryPath}/test_lm.litertlm`;
const OPERATION_TIMEOUT_MS = 30000;
const MODEL_LOAD_TIMEOUT_MS = 180000;
const INFERENCE_TIMEOUT_MS = 65000;

export class LiteRtSynthesisRuntime implements SynthesisRuntime {
  id = 'litert';
  private modelConfig: LiteRtModelConfig;
  private ready = false;
  private loadedModelPath: string | null = null;

  constructor(modelConfig: Partial<LiteRtModelConfig> = {}) {
    this.modelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      ...modelConfig,
    };
  }

  async initialize(onProgress?: () => void): Promise<RuntimeReadiness> {
    this.ready = false;
    this.loadedModelPath = null;

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT-LM synthesis is currently wired for iOS and Android only.',
      };
    }

    if (!LiteRtModule) {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT native module is not registered.',
      };
    }

    const bridgeAvailable = await withTimeout(LiteRtModule.isAvailable(), OPERATION_TIMEOUT_MS, 'LiteRT-LM availability timed out in JavaScript.');
    onProgress?.();
    if (!bridgeAvailable) {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT-LM native bridge is present but unavailable.',
      };
    }

    const primaryModelExists = await withTimeout(RNFS.exists(this.modelConfig.modelPath), OPERATION_TIMEOUT_MS, 'LiteRT-LM model lookup timed out in JavaScript.');
    onProgress?.();
    const fallbackModelExists = await withTimeout(RNFS.exists(BUNDLED_FALLBACK_MODEL_PATH), OPERATION_TIMEOUT_MS, 'LiteRT-LM model lookup timed out in JavaScript.');
    onProgress?.();
    const modelPath = primaryModelExists ? this.modelConfig.modelPath : fallbackModelExists ? BUNDLED_FALLBACK_MODEL_PATH : null;

    if (!modelPath) {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT-LM synthesis model is missing.',
        missingModels: [this.modelConfig.modelPath],
      };
    }

    try {
      await withTimeout(LiteRtModule.loadModel({
        ...this.modelConfig,
        modelPath,
      }), MODEL_LOAD_TIMEOUT_MS, 'LiteRT-LM model load timed out in JavaScript.');
      onProgress?.();
      this.ready = true;
      this.loadedModelPath = modelPath;
      return {
        available: true,
        status: 'ready',
        detail:
          modelPath === this.modelConfig.modelPath
            ? `LiteRT-LM model loaded from ${this.modelConfig.modelPath}.`
            : 'LiteRT-LM model loaded from bundled demo fallback.',
        missingModels: primaryModelExists ? [] : [this.modelConfig.modelPath],
      };
    } catch (error) {
      this.ready = false;
      this.loadedModelPath = null;
      const detail = toErrorMessage(error);
      const unsupportedSimulatorBackend = detail.includes('LITERT_UNSUPPORTED_SIMULATOR_BACKEND') ||
        detail.includes('GPU backend is disabled on iOS Simulator');

      return {
        available: false,
        status: unsupportedSimulatorBackend ? 'unsupported' : 'error',
        detail,
        nativeState: {
          crashRisk: unsupportedSimulatorBackend,
          code: unsupportedSimulatorBackend ? 'LITERT_UNSUPPORTED_SIMULATOR_BACKEND' : 'LITERT_LOAD_FAILED',
          modelPath,
          backend: this.modelConfig.backend,
          maxTokens: this.modelConfig.maxTokens,
        },
      };
    }
  }

  getModelConfig(): LiteRtModelConfig {
    return { ...this.modelConfig };
  }

  async extractReminder(prompt: string): Promise<string> {
    if (!this.ready || !LiteRtModule?.extractReminder) throw new Error('Local reminder model is unavailable');
    if (utf8Length(prompt) > Math.min(MAX_PROMPT_BYTES, this.modelConfig.maxTokens - 384)) {
      throw new Error('Reminder prompt exceeds the bounded input budget');
    }
    try {
      return await withTimeout(LiteRtModule.extractReminder(prompt), INFERENCE_TIMEOUT_MS, 'Local reminder inference timed out');
    } catch (error) {
      this.ready = false;
      this.loadedModelPath = null;
      throw error;
    }
  }

  async synthesize(input: {
    transcript: string;
    existingTopics: string[];
    topicContexts?: TopicContext[];
    task?: 'summary' | 'route';
  }) {
    if (!this.ready || !LiteRtModule) {
      throw new Error('LiteRT-LM runtime is not ready');
    }

    const prompt = SynthesisEngine.generatePrompt(
      input.transcript,
      input.existingTopics,
      input.topicContexts,
      input.task,
    );

    if (utf8Length(prompt) > Math.min(MAX_PROMPT_BYTES, this.modelConfig.maxTokens - 384)) {
      throw new Error('Synthesis prompt exceeds the bounded input budget');
    }

    try {
      const result = await withTimeout(
        LiteRtModule.synthesize({
          transcript: input.transcript,
          existingTopics: input.existingTopics,
          prompt,
        }),
        INFERENCE_TIMEOUT_MS,
        'LiteRT-LM synthesis timed out in JavaScript.',
      );
      if (
        result.source === 'raw-fallback' ||
        typeof result.topic !== 'string' || !result.topic.trim() ||
        typeof result.refinedText !== 'string' || !result.refinedText.trim() ||
        !Array.isArray(result.tags)
      ) {
        return normalizeSynthesizedThought(
          { topic: 'Inbox', refinedText: input.transcript, tags: ['fallback'] },
          input.transcript,
          'raw-fallback',
        );
      }
      // The native bridge retains its refinedText wire field; it carries only the model summary.
      const summary = input.task === 'route' ? undefined : result.refinedText!.trim();
      if (summary && utf8Length(summary) > MAX_SUMMARY_BYTES * 2) {
        throw new Error('Synthesis summary exceeds the bounded output budget');
      }
      return normalizeSynthesizedThought({ ...result, summary }, input.transcript, 'litert');
    } catch (error) {
      this.ready = false;
      this.loadedModelPath = null;
      throw error;
    }
  }

  async benchmark(fixtures: string[]): Promise<Record<string, unknown>> {
    if (!LiteRtModule) {
      throw new Error('LiteRT native module is not registered');
    }

    return LiteRtModule.benchmark(fixtures);
  }

  async release(): Promise<void> {
    if (LiteRtModule) {
      await withTimeout(LiteRtModule.release(), OPERATION_TIMEOUT_MS, 'LiteRT-LM release timed out in JavaScript.');
    }
    this.ready = false;
    this.loadedModelPath = null;
  }
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
