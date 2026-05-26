import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { getDefaultSynthesisModel, toLiteRtModelConfig } from '../models';
import { normalizeSynthesizedThought, RuntimeReadiness, SynthesisRuntime, SynthesizedThought } from './types';
import type { LiteRtModelConfig } from './types';

interface LiteRtNativeModule {
  isAvailable(): Promise<boolean>;
  loadModel(config: LiteRtModelConfig): Promise<{ loaded: boolean; modelPath: string; backend: string }>;
  synthesize(input: {
    transcript: string;
    existingTopics: string[];
  }): Promise<Partial<SynthesizedThought>>;
  benchmark(fixtures: string[]): Promise<Record<string, unknown>>;
  release(): Promise<void>;
}

const LiteRtModule = NativeModules.LiteRtModule as LiteRtNativeModule | undefined;
const DEFAULT_MODEL_CONFIG = toLiteRtModelConfig(getDefaultSynthesisModel());
const BUNDLED_FALLBACK_MODEL_PATH = `${RNFS.MainBundlePath}/test_lm.litertlm`;
const SYNTHESIS_TIMEOUT_MS = 30000;

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

  async initialize(): Promise<RuntimeReadiness> {
    this.ready = false;
    this.loadedModelPath = null;

    if (Platform.OS !== 'ios') {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT-LM synthesis is currently wired for iOS only.',
      };
    }

    if (!LiteRtModule) {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT native module is not registered.',
      };
    }

    const bridgeAvailable = await LiteRtModule.isAvailable();
    if (!bridgeAvailable) {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT-LM native bridge is present but unavailable.',
      };
    }

    const primaryModelExists = await RNFS.exists(this.modelConfig.modelPath);
    const fallbackModelExists = await RNFS.exists(BUNDLED_FALLBACK_MODEL_PATH);
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
      await LiteRtModule.loadModel({
        ...this.modelConfig,
        modelPath,
      });
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

  async synthesize(input: { transcript: string; existingTopics: string[] }) {
    if (!this.ready || !LiteRtModule) {
      throw new Error('LiteRT-LM runtime is not ready');
    }

    try {
      const result = await withTimeout(
        LiteRtModule.synthesize(input),
        SYNTHESIS_TIMEOUT_MS,
        'LiteRT-LM synthesis timed out in JavaScript.',
      );
      return normalizeSynthesizedThought(result, input.transcript, 'litert');
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
      await LiteRtModule.release();
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
