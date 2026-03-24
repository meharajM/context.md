import { LlamaContext, loadLlama } from 'llama.rn';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

export interface LLMSynthesizedThought {
  topic: string;
  refinedText: string;
  tags: string[];
}

export class SynthesisService {
  private static context: LlamaContext | null = null;
  private static MODEL_PATH = Platform.OS === 'ios'
    ? `${RNFS.MainBundlePath}/models/tinyllama.gguf`
    : 'tinyllama.gguf'; // Android assets

  /**
   * Initializes the local LLM.
   */
  static async initialize(): Promise<void> {
    if (this.context) return;
    try {
      this.context = await loadLlama({
        model: this.MODEL_PATH,
        contextSize: 2048,
        n_gpu_layers: Platform.OS === 'ios' ? 99 : 0, // Metal acceleration on iOS
      });
      console.log('Local LLM initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize local LLM:', error);
      throw error;
    }
  }

  /**
   * Processes a transcript using the local LLM.
   */
  static async synthesize(transcript: string, existingTopics: string[]): Promise<LLMSynthesizedThought> {
    if (!this.context) {
      await this.initialize();
    }

    const prompt = `
    <|system|>
    You are the Context Engine Synthesis unit. Return JSON ONLY.
    Task: Categorize the transcript into one of these topics: ${existingTopics.join(', ')}.
    If no match, create a new concise topic name.
    Summarize the thought clearly.
    Format: {"topic": "...", "refinedText": "...", "tags": ["...", "..."]}
    <|user|>
    "${transcript}"
    <|assistant|>
    `;

    try {
      const result = await this.context!.completion({
        prompt: prompt,
        n_predict: 200,
        stop: ['<|user|>', '</s>'],
      });

      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('LLM did not return valid JSON');
    } catch (error) {
      console.error('LLM Synthesis error:', error);
      // Fallback to heuristic
      return {
        topic: 'General',
        refinedText: transcript,
        tags: ['fallback']
      };
    }
  }

  static async release(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
  }
}
