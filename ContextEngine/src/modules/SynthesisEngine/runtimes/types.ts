export type SynthesisSource = 'litert' | 'raw-fallback';

export interface SynthesizedThought {
  topic: string;
  refinedText: string;
  tags: string[];
  source: SynthesisSource;
}

export interface RuntimeReadiness {
  available: boolean;
  status: 'ready' | 'unavailable' | 'unsupported' | 'error';
  detail?: string;
  missingModels?: string[];
  nativeState?: {
    crashRisk?: boolean;
    code?: string;
    modelPath?: string;
    backend?: LiteRtModelConfig['backend'];
    maxTokens?: number;
  };
}

export interface LiteRtModelConfig {
  modelPath: string;
  backend: 'cpu' | 'gpu';
  maxTokens: number;
  topK: number;
  topP: number;
  temperature: number;
  cacheDir: string;
}

export interface SynthesisRuntime {
  id: string;
  initialize(): Promise<RuntimeReadiness>;
  synthesize(input: {
    transcript: string;
    existingTopics: string[];
  }): Promise<SynthesizedThought>;
  release(): Promise<void>;
}

export const FALLBACK_TOPIC = 'Inbox';

export const normalizeSynthesizedThought = (
  thought: Partial<SynthesizedThought>,
  transcript: string,
  source: SynthesisSource,
): SynthesizedThought => {
  const refinedText = typeof thought.refinedText === 'string' && thought.refinedText.trim()
    ? thought.refinedText.trim()
    : transcript.trim();
  const topic = typeof thought.topic === 'string' && thought.topic.trim()
    ? thought.topic.trim()
    : FALLBACK_TOPIC;
  const tags = Array.isArray(thought.tags)
    ? thought.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];

  return {
    topic,
    refinedText,
    tags,
    source,
  };
};
