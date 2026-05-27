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
    const topicList = existingTopics.length > 0 ? existingTopics.join(', ') : 'None';
    
    return [
      'You are Context Engine\'s on-device synthesis unit.',
      'Your task is to refine a raw voice transcript and categorize it into a topic.',
      'Always return valid, minified JSON ONLY. No conversation, no markdown code blocks.',
      '',
      `### CANDIDATE TOPICS:`,
      topicList,
      '',
      '### SCHEMAS & GUIDELINES:',
      '- Use an existing topic from the candidate list if it matches. Otherwise, invent a new, highly specific title (2-3 words, Title Case).',
      '- "refinedText": Remove fillers (um, like), correct voice-to-text typos, keep it in active voice.',
      '- "tags": 1-3 descriptive, lowercase, single-word tags.',
      '- Response format: {"topic": string, "refinedText": string, "tags": string[]}',
      '',
      '### EXAMPLES:',
      'Input Transcript: "uh remember to buy milk and eggs on the way back from work"',
      'Response: {"topic":"Errands","refinedText":"Buy milk and eggs on the way back from work.","tags":["shopping","personal"]}',
      '',
      `### INPUT TRANSCRIPT:`,
      `"${transcript}"`,
      '',
      'Response:',
    ].join('\n');
  }

  static parseResponse(response: string, transcript = '') {
    try {
      // 1. Strip markdown code block fences if present (e.g., ```json ... ```)
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '');
      cleaned = cleaned.replace(/\s*```$/, '');
      cleaned = cleaned.trim();

      // 2. Locate first '{' and last '}' to extract the pure JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        
        // 3. Clean up trailing commas in arrays/objects which break JSON.parse in JS
        jsonStr = jsonStr.replace(/,\s*(\]|\})/g, '$1');

        const parsed = JSON.parse(jsonStr);
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

