import RNFS from 'react-native-fs';

import {
  MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES,
  type DeviceReadinessAssessment,
} from '../DeviceReadiness';
import type { LiteRtModelConfig } from './runtimes/types';

export interface SynthesisModelDescriptor {
  id: string;
  name: string;
  modelId: string;
  modelFile: string;
  description: string;
  sizeInBytes: number;
  expectedSha256: string;
  sourceUrl: string;
  detailsUrl?: string;
  license: string;
  minDeviceMemoryInGb: number;
  backend: 'cpu' | 'gpu';
  supportsAudio?: boolean;
  maxTokens: number;
  topK: number;
  topP: number;
  temperature: number;
  taskTypes: string[];
  bestForTaskTypes?: string[];
  recommended?: boolean;
}

export const SENSIBLE_DEFAULT_MODEL_ID = 'gemma3-1b-it';
export const FUNCTION_GEMMA_MODEL_ID = 'functiongemma-270m-it';

export const SYNTHESIS_MODEL_CATALOG: SynthesisModelDescriptor[] = [
  {
    id: 'gemma3-1b-it',
    name: 'Compact assistant',
    modelId: 'lotapa/gemma3-1b-it-int4.litertlm',
    modelFile: 'gemma3-1b-it-int4.litertlm',
    description: 'Text-only writing helper for lower-resource devices; pair with Whisper for voice transcription.',
    sizeInBytes: 584417280,
    expectedSha256: '1325ae366d31950f137c9c357b9fa89448b176d76998180c08ceaca78bba98be',
    sourceUrl: 'https://huggingface.co/lotapa/gemma3-1b-it-int4.litertlm/resolve/f3fe59d444eaee1d86b6c43677d0b261295bdaea/gemma3-1b-it-int4.litertlm?download=1',
    license: 'gemma',
    minDeviceMemoryInGb: 4,
    backend: 'cpu',
    maxTokens: 1024,
    topK: 64,
    topP: 0.95,
    temperature: 0.2,
    taskTypes: ['llm_chat', 'llm_prompt_lab'],
    bestForTaskTypes: ['llm_chat', 'llm_prompt_lab'],
    recommended: true,
  },
  {
    id: 'gemma3n-e2b-it',
    name: 'Gemma 3n E2B',
    modelId: 'warped-community/gemma-3n-E2B-it-litert-lm',
    modelFile: 'gemma-3n-E2B-it-int4.litertlm',
    description: 'Audio-capable model for voice transcription and note organization in one download.',
    sizeInBytes: 3655827456,
    expectedSha256: '2ed7bc3a0026c93d5b8a4544b352d9d00cd66ff0bac3ef6a20ac3d2cba4010d6',
    sourceUrl: 'https://huggingface.co/warped-community/gemma-3n-E2B-it-litert-lm/resolve/578c09610e661ed16bd7d22e1ecf9922d92f7064/gemma-3n-E2B-it-int4.litertlm?download=1',
    detailsUrl: 'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm',
    license: 'gemma',
    minDeviceMemoryInGb: 8,
    backend: 'cpu',
    supportsAudio: true,
    maxTokens: 2048,
    topK: 40,
    topP: 0.95,
    temperature: 0.1,
    taskTypes: ['llm_chat', 'llm_prompt_lab'],
    bestForTaskTypes: ['llm_chat', 'llm_prompt_lab'],
  },
  {
    id: 'gemma4-e2b-it',
    name: 'Balanced assistant',
    modelId: 'litert-community/gemma-4-E2B-it-litert-lm',
    modelFile: 'gemma-4-E2B-it.litertlm',
    description: 'A more capable option for phones with extra memory.',
    sizeInBytes: 2588147712,
    expectedSha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
    sourceUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/1caa527c1e88b55f046fcd8d2b4265606680663d/gemma-4-E2B-it.litertlm?download=1',
    license: 'gemma',
    minDeviceMemoryInGb: 6,
    backend: 'cpu',
    maxTokens: 2048,
    topK: 40,
    topP: 0.95,
    temperature: 0.7,
    taskTypes: ['llm_chat', 'llm_prompt_lab'],
    bestForTaskTypes: ['llm_chat', 'llm_prompt_lab'],
  },
  {
    id: 'gemma4-e4b-it',
    name: 'Advanced assistant',
    modelId: 'litert-community/gemma-4-E4B-it-litert-lm',
    modelFile: 'gemma-4-E4B-it.litertlm',
    description: 'The most capable option, for phones with plenty of memory.',
    sizeInBytes: 3659530240,
    expectedSha256: '0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0',
    sourceUrl: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/e6a3892a8c22cf87ff99583996149cf3cb32452b/gemma-4-E4B-it.litertlm?download=1',
    license: 'gemma',
    minDeviceMemoryInGb: 8,
    backend: 'cpu',
    maxTokens: 2048,
    topK: 40,
    topP: 0.95,
    temperature: 0.7,
    taskTypes: ['llm_chat', 'llm_prompt_lab'],
    bestForTaskTypes: ['llm_chat', 'llm_prompt_lab'],
  },
  {
    id: FUNCTION_GEMMA_MODEL_ID,
    name: 'FunctionGemma 270M',
    modelId: 'sasha-denisov/function-gemma-270M-it',
    modelFile: 'functiongemma-270M-it.litertlm',
    description: 'On-device tool-call planner for research handoffs.',
    sizeInBytes: 284426240,
    expectedSha256: '680fead1cca41a23220c904500a515d06e41f5c66d130aa4a9cc5905ec529a8e',
    sourceUrl: 'https://huggingface.co/sasha-denisov/function-gemma-270M-it/resolve/5576af584d75618cdf0cd07b5e79c6fd9ac0ace5/functiongemma-270M-it.litertlm?download=1',
    detailsUrl: 'https://huggingface.co/sasha-denisov/function-gemma-270M-it/tree/5576af584d75618cdf0cd07b5e79c6fd9ac0ace5',
    license: 'gemma',
    minDeviceMemoryInGb: 4,
    backend: 'cpu',
    maxTokens: 1024,
    topK: 40,
    topP: 0.95,
    temperature: 0.1,
    taskTypes: ['function_calling'],
    bestForTaskTypes: ['function_calling'],
  },
];

export const getSynthesisModelDownloadUrl = (descriptor: SynthesisModelDescriptor): string =>
  descriptor.sourceUrl;

export const getSynthesisModelLocalPath = (descriptor: SynthesisModelDescriptor): string =>
  `${RNFS.DocumentDirectoryPath}/models/${descriptor.modelFile}`;

export const getSynthesisModelCacheDir = (descriptor: SynthesisModelDescriptor): string =>
  `${RNFS.CachesDirectoryPath ?? RNFS.DocumentDirectoryPath}/litertlm-cache/${descriptor.id}`;

export const toLiteRtModelConfig = (descriptor: SynthesisModelDescriptor): LiteRtModelConfig => ({
  modelPath: getSynthesisModelLocalPath(descriptor),
  backend: descriptor.backend,
  supportsAudio: descriptor.supportsAudio,
  maxTokens: descriptor.maxTokens,
  topK: descriptor.topK,
  topP: descriptor.topP,
  temperature: descriptor.temperature,
  cacheDir: getSynthesisModelCacheDir(descriptor),
});

export const getDefaultSynthesisModel = (): SynthesisModelDescriptor =>
  SYNTHESIS_MODEL_CATALOG.find(model => model.id === SENSIBLE_DEFAULT_MODEL_ID) ?? SYNTHESIS_MODEL_CATALOG[0];

export const getAutomaticSynthesisModelId = (
  models: Array<Pick<SynthesisModelDescriptor, 'id' | 'supportsAudio' | 'taskTypes' | 'minDeviceMemoryInGb' | 'sizeInBytes' | 'recommended'>>,
  readiness: DeviceReadinessAssessment | null,
  platform: string,
  allowUnifiedAudio = true,
): string => {
  const unifiedAudioModel = models.find(model => model.supportsAudio && model.taskTypes.includes('llm_chat'));
  if (
    allowUnifiedAudio && (platform === 'ios' || platform === 'android') && readiness?.checkAvailable && !readiness.isSimulator &&
    readiness.totalMemoryBytes !== null && unifiedAudioModel &&
    readiness.totalMemoryBytes >= unifiedAudioModel.minDeviceMemoryInGb * 1024 ** 3 &&
    readiness.freeStorageBytes !== null &&
    readiness.freeStorageBytes >= unifiedAudioModel.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES
  ) {
    return unifiedAudioModel.id;
  }

  return models.find(model => model.recommended)?.id ?? getDefaultSynthesisModel().id;
};
