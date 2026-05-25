import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import { ContextManager } from '../ContextManager';

export interface PendingThought {
  id: string;
  transcript: string;
  timestamp: string;
}

export class ProcessingQueueManager {
  private static queue: PendingThought[] = [];
  private static isProcessing = false;
  private static cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Adds a thought to the processing queue and returns immediately.
   */
  static addToQueue(transcript: string): string {
    const id = Math.random().toString(36).substring(7);
    this.queue.push({
      id,
      transcript,
      timestamp: new Date().toISOString(),
    });
    console.log(`[Queue] Added thought ${id}. Total pending: ${this.queue.length}`);
    
    // Start processing in the background (fire and forget)
    this.processNext();
    
    return id;
  }

  /**
   * Process the queue one by one when resources are available.
   */
  private static async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    
    try {
      const thought = this.queue[0];
      console.log(`[Queue] Processing ${thought.id}...`);

      // Here we would ideally check for "Idle" state. 
      // For MVP, we'll just process sequentially with a small delay to simulate non-blocking behavior.
      
      // Get existing topics for context
      const sections = await ContextManager.readContext();
      const topics = sections.map(s => s.header);

      // Real LLM Synthesis
      const synthesized = await SynthesisService.synthesize(thought.transcript, topics);
      
      // Save to markdown
      await ContextManager.appendThought(synthesized.topic, synthesized.refinedText);
      
      // Remove from queue
      this.queue.shift();
      console.log(`[Queue] ${thought.id} finished. Remaining: ${this.queue.length}`);

    } catch (error) {
      console.error('[Queue] Processing failed, will retry later:', error);
      // Move to end of queue for retry
      const failed = this.queue.shift();
      if (failed) this.queue.push(failed);
    } finally {
      this.isProcessing = false;
      // Recursively process next item after a short cooldown to save battery.
      if (this.queue.length > 0) {
        this.cooldownTimer = setTimeout(() => this.processNext(), 2000);
      }
    }
  }

  static getQueueSize(): number {
    return this.queue.length;
  }

  static resetForTests(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    this.queue = [];
    this.isProcessing = false;
    this.cooldownTimer = null;
  }
}
