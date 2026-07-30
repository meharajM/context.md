import { FALLBACK_TOPIC, normalizeSynthesizedThought, RuntimeReadiness, SynthesisRuntime } from './types';

export class RawFallbackSynthesisRuntime implements SynthesisRuntime {
  id = 'raw-fallback';

  async initialize(): Promise<RuntimeReadiness> {
    return {
      available: true,
      status: 'ready',
      detail: 'Raw Inbox fallback is available.',
    };
  }

  async synthesize(input: { transcript: string; existingTopics: string[] }) {
    return normalizeSynthesizedThought(
      {
        topic: FALLBACK_TOPIC,
        refinedText: input.transcript.trim(),
        tags: ['fallback'],
      },
      input.transcript,
      'raw-fallback',
    );
  }

  async release(): Promise<void> {
    return undefined;
  }
}
