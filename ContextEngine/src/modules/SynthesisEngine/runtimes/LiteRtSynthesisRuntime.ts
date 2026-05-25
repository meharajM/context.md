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

export class LiteRtSynthesisRuntime implements SynthesisRuntime {
  id = 'litert';
  private modelConfig: LiteRtModelConfig;
  private ready = false;

  constructor(modelConfig: Partial<LiteRtModelConfig> = {}) {
    this.modelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      ...modelConfig,
    };
  }

  async initialize(): Promise<RuntimeReadiness> {
    this.ready = false;

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

    const modelExists = await RNFS.exists(this.modelConfig.modelPath);
    if (!modelExists) {
      return {
        available: false,
        status: 'unavailable',
        detail: 'LiteRT-LM synthesis model is missing.',
        missingModels: [this.modelConfig.modelPath],
      };
    }

    try {
      await LiteRtModule.loadModel(this.modelConfig);
      this.ready = true;
      return {
        available: true,
        status: 'ready',
        detail: `LiteRT-LM model loaded from ${this.modelConfig.modelPath}.`,
      };
    } catch (error) {
      return {
        available: false,
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
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

    const result = await LiteRtModule.synthesize(input);
    return normalizeSynthesizedThought(result, input.transcript, 'litert');
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
  }
}
