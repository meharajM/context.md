export type SynthesisSource = 'litert' | 'raw-fallback';

export interface TopicOption {
  topic: string;
  reason?: string;
}

export interface SynthesisClarification {
  question: string;
  options: TopicOption[];
}

export interface SynthesizedThought {
  topic: string;
  refinedText: string;
  tags: string[];
  source: SynthesisSource;
  clarification?: SynthesisClarification;
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

export interface TopicContext {
  topic: string;
  content: string;
}

export interface SynthesisRuntime {
  id: string;
  initialize(): Promise<RuntimeReadiness>;
  synthesize(input: {
    transcript: string;
    existingTopics: string[];
    topicContexts?: TopicContext[];
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
  const clarification = normalizeClarification(thought.clarification);

  return {
    topic: clarification ? FALLBACK_TOPIC : topic,
    refinedText,
    tags,
    source,
    ...(clarification ? { clarification } : {}),
  };
};

const normalizeClarification = (value: unknown): SynthesisClarification | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as { question?: unknown; options?: unknown };
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
  if (!question || !Array.isArray(candidate.options)) {
    return undefined;
  }

  const seen = new Set<string>();
  const options = candidate.options
    .map(option => {
      if (typeof option === 'string') {
        return { topic: option.trim() };
      }

      if (!option || typeof option !== 'object') {
        return null;
      }

      const topic = typeof (option as { topic?: unknown }).topic === 'string'
        ? (option as { topic: string }).topic.trim()
        : '';
      const reason = typeof (option as { reason?: unknown }).reason === 'string'
        ? (option as { reason: string }).reason.trim()
        : '';

      return topic ? { topic, ...(reason ? { reason } : {}) } : null;
    })
    .filter((option): option is TopicOption => {
      if (!option || !option.topic || option.topic.toLowerCase() === FALLBACK_TOPIC.toLowerCase()) {
        return false;
      }

      const normalizedTopic = option.topic.toLowerCase();
      if (seen.has(normalizedTopic)) {
        return false;
      }

      seen.add(normalizedTopic);
      return true;
    })
    .slice(0, 3);

  return options.length >= 2 ? { question, options } : undefined;
};
