/**
 * SynthesisEngine Module
 * Shared prompt and response helpers for the LiteRT-LM synthesis runtime.
 */

import type { TopicContext } from './runtimes/types';

export type {
  RuntimeReadiness,
  SynthesisClarification,
  SynthesizedThought,
  SynthesisRuntime,
  TopicOption,
  TopicContext,
} from './runtimes/types';

export { SynthesisService } from './SynthesisService';

export class SynthesisEngine {
  static generatePrompt(
    transcript: string,
    existingTopics: string[],
    topicContexts: TopicContext[] = [],
  ): string {
    const topicList = existingTopics.length > 0 ? existingTopics.join(', ') : 'None';
    const relevantContext = topicContexts.length > 0
      ? topicContexts
          .map(context => `## ${context.topic}\n${context.content.trim() || '(empty topic)'}`)
          .join('\n\n')
      : 'None';

    return [
      'You are Context Engine\'s private on-device synthesis and filing unit.',
      'Your job is to understand one captured thought, refine it without changing its meaning, and file it under the most appropriate topic.',
      'Always return valid, minified JSON ONLY. No conversation, no markdown code blocks.',
      'Never invent facts, people, dates, tasks, or context that are not present in the captured thought.',
      'Do not default to the first candidate topic. Compare the meaning of the thought with each candidate topic and its persisted content.',
      'Prefer an existing topic when it is a reasonable semantic fit; create a specific new topic only when no existing topic fits.',
      'Never use generic topics such as General, Notes, Miscellaneous, or Random.',
      'When the thought is ambiguous, underspecified, or could reasonably belong to two or more topics, do not guess.',
      'Instead, set needsClarification to true, set topic to Inbox, preserve the thought, ask one focused question, and provide 2 or 3 topic options.',
      'Clarification options must be existing candidate topics or a specific new topic. Do not include Inbox as an option.',
      'Only set needsClarification to false when the intended topic is clear enough to file without user input.',
      '',
      '### CANDIDATE TOPICS:',
      topicList,
      '',
      '### PERSISTED TOPIC CONTEXT:',
      relevantContext,
      '',
      '### OUTPUT CONTRACT:',
      '- topic: an existing candidate topic, or a specific new Title Case topic of 1-5 words. Use Inbox only when needsClarification is true.',
      '- refinedText: remove fillers and correct obvious transcription errors, but stay close to the original meaning and wording.',
      '- tags: 1-3 short, lowercase tags derived only from the captured thought.',
      '- needsClarification: boolean.',
      '- clarification: null when needsClarification is false; otherwise {"question": string, "options": [{"topic": string, "reason": string}]} with exactly 2 or 3 options.',
      '- Response format: {"topic": string, "refinedText": string, "tags": string[], "needsClarification": boolean, "clarification": null | {"question": string, "options": {"topic": string, "reason": string}[]}}',
      '',
      '### EXAMPLES:',
      'Clear match:',
      'Captured Thought: remember to ask Priya about the Q3 invoice tomorrow',
      'Response: {"topic":"Work","refinedText":"Remember to ask Priya about the Q3 invoice tomorrow.","tags":["invoice","work"],"needsClarification":false,"clarification":null}',
      '',
      'Ambiguous match:',
      'Captured Thought: send the update to the team',
      'Response: {"topic":"Inbox","refinedText":"Send the update to the team.","tags":["update"],"needsClarification":true,"clarification":{"question":"Which area is this update about?","options":[{"topic":"Work","reason":"The team and update suggest a work context."},{"topic":"Projects","reason":"Choose this if the update belongs to a specific project."}]}}',
      '',
      '### CAPTURED THOUGHT:',
      '<captured_thought>',
      transcript,
      '</captured_thought>',
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
        const clarification = parsed.needsClarification === true && parsed.clarification
          ? parsed.clarification
          : undefined;
        return {
          topic: typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic.trim() : 'Inbox',
          refinedText: typeof parsed.refinedText === 'string' && parsed.refinedText.trim()
            ? parsed.refinedText.trim()
            : transcript.trim(),
          tags: Array.isArray(parsed.tags)
            ? parsed.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
            : [],
          ...(clarification ? { clarification } : {}),
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
