import RNFS from 'react-native-fs';

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
  license: string;
  minDeviceMemoryInGb: number;
  backend: 'cpu' | 'gpu';
  maxTokens: number;
  topK: number;
  topP: number;
  temperature: number;
  taskTypes: string[];
  bestForTaskTypes?: string[];
  recommended?: boolean;
}

const HF_BASE = 'https://huggingface.co';

export const SENSIBLE_DEFAULT_MODEL_ID = 'gemma3-1b-it';

export const SYNTHESIS_MODEL_CATALOG: SynthesisModelDescriptor[] = [
  {
    id: 'gemma3-1b-it',
    name: 'Gemma3-1B-IT',
    modelId: 'lotapa/gemma3-1b-it-int4.litertlm',
    modelFile: 'gemma3-1b-it-int4.litertlm',
    description: 'Public LiteRT-LM mirror of the smallest practical iOS chat model in the Gallery allowlist.',
    sizeInBytes: 584417280,
    expectedSha256: '1325ae366d31950f137c9c357b9fa89448b176d76998180c08ceaca78bba98be',
    sourceUrl: 'https://huggingface.co/lotapa/gemma3-1b-it-int4.litertlm/resolve/main/gemma3-1b-it-int4.litertlm?download=1',
    license: 'gemma',
    minDeviceMemoryInGb: 4,
    backend: 'cpu',
    maxTokens: 256,
    topK: 32,
    topP: 0.9,
    temperature: 0.1,
    taskTypes: ['llm_chat', 'llm_prompt_lab'],
    bestForTaskTypes: ['llm_chat', 'llm_prompt_lab'],
    recommended: true,
  },
  {
    id: 'gemma4-e2b-it',
    name: 'Gemma4-E2B-IT',
    modelId: 'litert-community/gemma-4-E2B-it-litert-lm',
    modelFile: 'gemma-4-E2B-it.litertlm',
    description: 'Gemma 4 Edge 2B parameter instruction-tuned model in LiteRT-LM format.',
    sizeInBytes: 1620000000,
    expectedSha256: '', // Optional/skipped for catalog downloads without strict checksum check
    sourceUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm?download=1',
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
    name: 'Gemma4-E4B-IT',
    modelId: 'litert-community/gemma-4-E4B-it-litert-lm',
    modelFile: 'gemma-4-E4B-it.litertlm',
    description: 'Gemma 4 Edge 4B parameter instruction-tuned model for high quality on-device processing.',
    sizeInBytes: 3100000000,
    expectedSha256: '',
    sourceUrl: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm?download=1',
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
];

export const getSynthesisModelDownloadUrl = (descriptor: SynthesisModelDescriptor): string =>
  `${HF_BASE}/${descriptor.modelId}/resolve/main/${descriptor.modelFile}?download=1`;

export const getSynthesisModelLocalPath = (descriptor: SynthesisModelDescriptor): string =>
  `${RNFS.DocumentDirectoryPath}/models/${descriptor.modelFile}`;

export const getSynthesisModelCacheDir = (descriptor: SynthesisModelDescriptor): string =>
  `${RNFS.CachesDirectoryPath ?? RNFS.DocumentDirectoryPath}/litertlm-cache/${descriptor.id}`;

export const toLiteRtModelConfig = (descriptor: SynthesisModelDescriptor): LiteRtModelConfig => ({
  modelPath: getSynthesisModelLocalPath(descriptor),
  backend: descriptor.backend,
  maxTokens: descriptor.maxTokens,
  topK: descriptor.topK,
  topP: descriptor.topP,
  temperature: descriptor.temperature,
  cacheDir: getSynthesisModelCacheDir(descriptor),
});

export const getDefaultSynthesisModel = (): SynthesisModelDescriptor =>
  SYNTHESIS_MODEL_CATALOG.find(model => model.id === SENSIBLE_DEFAULT_MODEL_ID) ?? SYNTHESIS_MODEL_CATALOG[0];
