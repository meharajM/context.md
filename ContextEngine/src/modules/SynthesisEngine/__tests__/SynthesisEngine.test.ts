import { SynthesisEngine } from '../index';

describe('SynthesisEngine', () => {
  describe('generatePrompt', () => {
    it('constructs a prompt containing few-shot examples and candidate topics', () => {
      const prompt = SynthesisEngine.generatePrompt('remember to finish the slides', ['Work', 'Personal']);
      
      expect(prompt).toContain("Context Engine's on-device synthesis unit");
      expect(prompt).toContain('### CANDIDATE TOPICS:');
      expect(prompt).toContain('Work, Personal');
      expect(prompt).toContain('### EXAMPLES:');
      expect(prompt).toContain('Input Transcript: "uh remember to buy milk and eggs on the way back from work"');
      expect(prompt).toContain('"refinedText"');
      expect(prompt).toContain('"tags"');
      expect(prompt).toContain('remember to finish the slides');
    });

    it('handles empty candidate topics list gracefully', () => {
      const prompt = SynthesisEngine.generatePrompt('hello world', []);
      expect(prompt).toContain('### CANDIDATE TOPICS:\nNone');
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
  });
});
