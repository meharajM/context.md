import { SynthesisEngine } from '../index';

describe('SynthesisEngine', () => {
  describe('generatePrompt', () => {
    it('constructs a compact prompt with the synthesis contract and candidate topics', () => {
      const prompt = SynthesisEngine.generatePrompt('remember to finish the slides', ['Work', 'Personal']);
      
      expect(prompt).toContain('Choose the best existing topic using its context');
      expect(prompt).toContain('Refine minimally: preserve the original wording and every detail.');
      expect(prompt).toContain('Topics:\nWork, Personal');
      expect(prompt).toContain('Return minified JSON only');
      expect(prompt).toContain('"refinedText"');
      expect(prompt).toContain('"needsClarification"');
      expect(prompt).toContain('remember to finish the slides');
      expect(prompt.length).toBeLessThan(1000);
    });

    it('handles empty candidate topics list gracefully', () => {
      const prompt = SynthesisEngine.generatePrompt('hello world', []);
      expect(prompt).toContain('Topics:\nNone');
      expect(prompt).toContain('Context:\nNone');
    });

    it('includes relevant persisted topic content in the prompt', () => {
      const prompt = SynthesisEngine.generatePrompt('finish the report', ['Work'], [
        { topic: 'Work', content: '- Draft the quarterly report.\n- Ask Mia for review.' },
      ]);

      expect(prompt).toContain('Context:');
      expect(prompt).toContain('## Work\n- Draft the quarterly report.\n- Ask Mia for review.');
      expect(prompt).toContain('Choose the best existing topic using its context');
    });

    it('bounds persisted context while keeping its latest content and the captured thought', () => {
      const context = `old-entry ${'x'.repeat(900)} latest-entry`;
      const topics = Array.from({ length: 8 }, (_, index) => ({
        topic: `Topic ${index}`,
        content: `${context}-${index}`,
      }));
      const prompt = SynthesisEngine.generatePrompt('keep the full captured thought', topics.map(item => item.topic), topics);

      expect(prompt).toContain('latest-entry-0');
      expect(prompt).toContain('keep the full captured thought');
      expect(prompt).not.toContain('## Topic 6');
      expect(prompt).toContain('Topic 5');
      expect(prompt.length).toBeLessThan(3000);
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
