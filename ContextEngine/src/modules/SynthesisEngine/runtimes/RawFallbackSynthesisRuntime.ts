import { FALLBACK_TOPIC, normalizeSynthesizedThought, RuntimeReadiness, SynthesisRuntime } from './types';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'be', 'but', 'by', 'for', 'from', 'i', 'if', 'in', 'into', 'is', 'it', 'me', 'my',
  'of', 'on', 'or', 'our', 'so', 'that', 'the', 'their', 'them', 'there', 'this', 'to', 'up', 'we', 'with', 'you',
]);

const TOPIC_RULES = [
  {
    topic: 'Errands',
    keywords: ['amazon', 'buy', 'drop', 'grocery', 'groceries', 'milk', 'order', 'package', 'pharmacy', 'pick', 'pickup', 'shopping', 'store'],
    tags: ['errands', 'shopping'],
  },
  {
    topic: 'Work',
    keywords: ['client', 'deadline', 'deploy', 'feature', 'meeting', 'presentation', 'project', 'release', 'report', 'roadmap', 'sprint', 'ticket', 'update'],
    tags: ['work'],
  },
  {
    topic: 'Follow Up',
    keywords: ['call', 'email', 'follow', 'message', 'ping', 'reply', 'respond', 'send', 'text'],
    tags: ['follow-up'],
  },
  {
    topic: 'Health',
    keywords: ['appointment', 'doctor', 'gym', 'health', 'medicine', 'medication', 'run', 'sleep', 'therapy', 'workout'],
    tags: ['health'],
  },
  {
    topic: 'Home',
    keywords: ['clean', 'fix', 'home', 'house', 'kitchen', 'laundry', 'repair', 'rent'],
    tags: ['home'],
  },
  {
    topic: 'Finance',
    keywords: ['bank', 'bill', 'budget', 'expense', 'invoice', 'payment', 'tax'],
    tags: ['finance'],
  },
  {
    topic: 'Travel',
    keywords: ['airport', 'flight', 'hotel', 'train', 'travel', 'trip'],
    tags: ['travel'],
  },
  {
    topic: 'Ideas',
    keywords: ['brainstorm', 'concept', 'idea', 'prototype', 'startup', 'vision'],
    tags: ['ideas'],
  },
];

export class RawFallbackSynthesisRuntime implements SynthesisRuntime {
  id = 'raw-fallback';

  async initialize(): Promise<RuntimeReadiness> {
    return {
      available: true,
      status: 'ready',
      detail: 'Heuristic offline synthesis is available.',
    };
  }

  async synthesize(input: { transcript: string; existingTopics: string[] }) {
    const refinedText = normalizeTranscript(input.transcript);
    const topic = inferTopic(refinedText, input.existingTopics);
    const tags = inferTags(refinedText, topic);

    return normalizeSynthesizedThought(
      {
        topic,
        refinedText,
        tags,
      },
      input.transcript,
      'raw-fallback',
    );
  }

  async release(): Promise<void> {
    return undefined;
  }
}

const normalizeTranscript = (transcript: string): string => {
  const trimmed = transcript
    .replace(/\s+/g, ' ')
    .replace(/\b(um+|uh+|like)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed) {
    return '';
  }

  const normalized = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map(token => token[0].toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');

const inferTopic = (transcript: string, existingTopics: string[]): string => {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) {
    return FALLBACK_TOPIC;
  }

  let bestTopic = '';
  let bestScore = 0;
  for (const topic of existingTopics) {
    const topicTokens = new Set(tokenize(topic));
    const score = tokens.reduce((count, token) => count + (topicTokens.has(token) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic.trim();
    }
  }

  if (bestTopic && bestScore > 0) {
    return bestTopic;
  }

  for (const rule of TOPIC_RULES) {
    if (rule.keywords.some(keyword => tokens.includes(keyword))) {
      const existingMatch = existingTopics.find(topic => topic.trim().toLowerCase() === rule.topic.toLowerCase());
      return existingMatch?.trim() || rule.topic;
    }
  }

  const significant = tokens.filter(token => !/^[0-9]+$/.test(token)).slice(0, 3);
  if (significant.length === 0) {
    return FALLBACK_TOPIC;
  }

  return titleCase(significant.slice(0, Math.min(2, significant.length)).join(' '));
};

const inferTags = (transcript: string, topic: string): string[] => {
  const tokens = tokenize(transcript);
  const tags = new Set<string>();

  const matchingRule = TOPIC_RULES.find(rule => rule.topic.toLowerCase() === topic.toLowerCase());
  for (const tag of matchingRule?.tags ?? []) {
    tags.add(tag);
  }

  for (const token of tokens) {
    if (tags.size >= 3) {
      break;
    }
    if (!/^[0-9]+$/.test(token) && token !== topic.toLowerCase()) {
      tags.add(token);
    }
  }

  return Array.from(tags).slice(0, 3);
};
