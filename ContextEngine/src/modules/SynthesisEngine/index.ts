/**
 * SynthesisEngine Module
 * Shared prompt and response helpers for the LiteRT-LM synthesis runtime.
 */

export type {
  RuntimeReadiness,
  SynthesizedThought,
  SynthesisRuntime,
} from './runtimes/types';

export { SynthesisService } from './SynthesisService';

export class SynthesisEngine {
  static generatePrompt(transcript: string, existingTopics: string[]): string {
    return [
      'You are the Context Engine on-device synthesis unit.',
      'Return JSON only.',
      `Existing topics: ${existingTopics.join(', ')}`,
      'Use an existing topic when it fits. Otherwise create a concise topic name.',
      'Schema: {"topic":"Topic","refinedText":"Clear thought","tags":["tag"]}',
      `Transcript: ${transcript}`,
    ].join('\n');
  }

  static parseResponse(response: string, transcript = '') {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          topic: typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic.trim() : 'Inbox',
          refinedText: typeof parsed.refinedText === 'string' && parsed.refinedText.trim()
            ? parsed.refinedText.trim()
            : transcript.trim(),
          tags: Array.isArray(parsed.tags)
            ? parsed.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
            : [],
        };
      }
    } catch {
      // Fall through to raw Inbox persistence shape.
    }

    return {
      topic: 'Inbox',
      refinedText: transcript.trim() || response.trim(),
      tags: ['fallback'],
    };
  }
}
