import { SynthesisEngine } from '../index';

describe('SynthesisEngine', () => {
  describe('generatePrompt', () => {
    it('constructs a prompt containing few-shot examples and candidate topics', () => {
      const prompt = SynthesisEngine.generatePrompt('remember to finish the slides', ['Work', 'Personal']);
      
      expect(prompt).toContain("Context Engine's private on-device synthesis and filing unit");
      expect(prompt).toContain('### CANDIDATE TOPICS:');
      expect(prompt).toContain('Work, Personal');
      expect(prompt).toContain('### EXAMPLES:');
      expect(prompt).toContain('Clear match:');
      expect(prompt).toContain('"refinedText"');
      expect(prompt).toContain('"needsClarification"');
      expect(prompt).toContain('remember to finish the slides');
    });

    it('handles empty candidate topics list gracefully', () => {
      const prompt = SynthesisEngine.generatePrompt('hello world', []);
      expect(prompt).toContain('### CANDIDATE TOPICS:\nNone');
      expect(prompt).toContain('### PERSISTED TOPIC CONTEXT:\nNone');
    });

    it('includes relevant persisted topic content in the prompt', () => {
      const prompt = SynthesisEngine.generatePrompt('finish the report', ['Work'], [
        { topic: 'Work', content: '- Draft the quarterly report.\n- Ask Mia for review.' },
      ]);

      expect(prompt).toContain('### PERSISTED TOPIC CONTEXT:');
      expect(prompt).toContain('## Work\n- Draft the quarterly report.\n- Ask Mia for review.');
      expect(prompt).toContain('Compare the meaning of the thought with each candidate topic and its persisted content.');
    });
  });

  describe('parseResponse', () => {
    it('successfully parses clean JSON response', () => {
      const raw = '{"topic":"Errands","refinedText":"Buy milk and eggs.","tags":["shopping"]}';
      const parsed = SynthesisEngine.parseResponse(raw);
      expect(parsed).toEqual({
        topic: 'Errands',
        refinedText: 'Buy milk and eggs.',
        tags: ['shopping'],
      });
    });

    it('successfully extracts and parses JSON wrapped in markdown code fences', () => {
      const raw = '```json\n{"topic": "Work", "refinedText": "Send status update.", "tags": ["status", "report"]}\n```';
      const parsed = SynthesisEngine.parseResponse(raw);
      expect(parsed).toEqual({
        topic: 'Work',
        refinedText: 'Send status update.',
        tags: ['status', 'report'],
      });
    });

    it('corrects trailing commas in arrays and objects before parsing', () => {
      const raw = '{\n  "topic": "Home",\n  "refinedText": "Clean the kitchen.",\n  "tags": ["chore", ],\n}';
      const parsed = SynthesisEngine.parseResponse(raw);
      expect(parsed).toEqual({
        topic: 'Home',
        refinedText: 'Clean the kitchen.',
        tags: ['chore'],
      });
    });

    it('falls back gracefully to raw transcript on complete syntax error', () => {
      const raw = 'Oops, I failed to create a valid output!';
      const parsed = SynthesisEngine.parseResponse(raw, 'remember to buy filters');
      expect(parsed).toEqual({
        topic: 'Inbox',
        refinedText: 'remember to buy filters',
        tags: ['fallback'],
      });
    });

    it('preserves clarification questions and topic options from model output', () => {
      const raw = JSON.stringify({
        topic: 'Inbox',
        refinedText: 'Send the update to the team.',
        tags: ['update'],
        needsClarification: true,
        clarification: {
          question: 'Which area is this update about?',
          options: [
            { topic: 'Work', reason: 'The team suggests a work context.' },
            { topic: 'Projects', reason: 'Use this for a project update.' },
          ],
        },
      });

      expect(SynthesisEngine.parseResponse(raw)).toMatchObject({
        topic: 'Inbox',
        refinedText: 'Send the update to the team.',
        clarification: {
          question: 'Which area is this update about?',
          options: [
            { topic: 'Work', reason: 'The team suggests a work context.' },
            { topic: 'Projects', reason: 'Use this for a project update.' },
          ],
        },
      });
    });
  });
});
