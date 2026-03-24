/**
 * SynthesisEngine Module
 * Handles LLM prompt construction and response parsing.
 */

export interface SynthesizedThought {
  topic: string;
  refinedText: string;
  tags: string[];
}

export class SynthesisEngine {
  /**
   * Constructs a prompt for the local LLM to categorize and refine a raw transcript.
   */
  static generatePrompt(transcript: string, existingTopics: string[]): string {
    return `
    You are the Context Engine Synthesis unit. 
    Task: Process the following raw voice transcript and route it to the most relevant topic.

    RAW TRANSCRIPT: "${transcript}"

    EXISTING TOPICS: ${existingTopics.join(', ')}

    INSTRUCTIONS:
    1. Strip filler words (um, uh, like).
    2. Correct any obvious STT misspellings.
    3. Choose the most relevant topic from EXISTING TOPICS. 
    4. If none match, create a new, concise topic name.
    5. Extract 2-3 relevant tags.

    RETURN JSON ONLY:
    {
      "topic": "Topic Name",
      "refinedText": "Clear, concise summary of the thought.",
      "tags": ["tag1", "tag2"]
    }
    `;
  }

  /**
   * Heuristic fallback synthesis for when local LLM is not yet available.
   */
  static heuristicSynthesis(transcript: string, existingTopics: string[]): SynthesizedThought {
    const text = transcript.toLowerCase();
    let topic = 'General';

    if (text.includes('idea') || text.includes('thought') || text.includes('brainstorm')) {
      topic = 'Ideas';
    } else if (text.includes('project') || text.includes('work') || text.includes('build') || text.includes('app')) {
      topic = 'Projects';
    } else if (text.includes('remember') || text.includes('todo') || text.includes('buy') || text.includes('task')) {
      topic = 'Tasks';
    } else if (text.includes('meeting') || text.includes('call') || text.includes('discuss')) {
      topic = 'Meetings';
    } else if (text.includes('health') || text.includes('gym') || text.includes('food') || text.includes('eat')) {
      topic = 'Health & Wellness';
    } else if (existingTopics.length > 0) {
      const match = existingTopics.find(t => text.includes(t.toLowerCase()));
      if (match) topic = match;
    }

    // Dynamic Topic Creation logic
    // If topic is still 'General' and there are specific keywords, we could create a new topic
    if (topic === 'General' && text.startsWith('about ')) {
      const suggestedTopic = transcript.split(' ').slice(1, 3).join(' '); // Take next two words
      if (suggestedTopic) {
         topic = suggestedTopic.charAt(0).toUpperCase() + suggestedTopic.slice(1);
      }
    }

    let refinedText = transcript.trim();
    if (refinedText.length > 0) {
      refinedText = refinedText.charAt(0).toUpperCase() + refinedText.slice(1);
    }

    return {
      topic,
      refinedText,
      tags: ['heuristic']
    };
  }

  /**
   * Parses the LLM's JSON response.
   */
  static parseResponse(response: string): SynthesizedThought {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found');
    } catch (e) {
      return {
        topic: 'Uncategorized',
        refinedText: response,
        tags: []
      };
    }
  }
}
