import { ContextManager } from '../ContextManager';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';

export interface PendingThought {
  id: string;
  transcript: string;
  timestamp: string;
  attempts: number;
}

export interface QueueState {
  pendingCount: number;
  isProcessing: boolean;
  currentThoughtId: string | null;
  lastError: string | null;
}

export interface QueueEvent {
  type: 'queued' | 'processing' | 'retry' | 'completed' | 'fallback' | 'idle';
  thoughtId: string | null;
  error?: string;
  attempts?: number;
}

type QueueListener = (state: QueueState, event: QueueEvent) => void;

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;
const FALLBACK_TOPIC = 'Inbox';

export class ProcessingQueueManager {
  private static queue: PendingThought[] = [];
  private static isProcessing = false;
  private static cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private static listeners = new Set<QueueListener>();
  private static state: QueueState = {
    pendingCount: 0,
    isProcessing: false,
    currentThoughtId: null,
    lastError: null,
  };

  static addToQueue(transcript: string): string {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      return '';
    }

    const id = Math.random().toString(36).substring(7);
    this.queue.push({
      id,
      transcript: trimmedTranscript,
      timestamp: new Date().toISOString(),
      attempts: 0,
    });
    this.syncState(
      {
        pendingCount: this.queue.length,
        lastError: null,
      },
      {
        type: 'queued',
        thoughtId: id,
      },
    );

    this.processNext().catch(error => {
      console.error('[Queue] Failed to start processing:', error);
    });

    return id;
  }

  static getQueueSize(): number {
    return this.queue.length;
  }

  static getState(): QueueState {
    return { ...this.state };
  }

  static subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getState(), { type: 'idle', thoughtId: null });

    return () => {
      this.listeners.delete(listener);
    };
  }

  static resetForTests(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }

    this.queue = [];
    this.isProcessing = false;
    this.cooldownTimer = null;
    this.listeners.clear();
    this.state = {
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
    };
  }

  private static async processNext(): Promise<void> {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    if (this.isProcessing || this.queue.length === 0) {
      if (this.queue.length === 0) {
        this.syncState(
          {
            pendingCount: 0,
            isProcessing: false,
            currentThoughtId: null,
          },
          {
            type: 'idle',
            thoughtId: null,
          },
        );
      }

      return;
    }

    const thought = this.queue[0];
    this.isProcessing = true;
    this.syncState(
      {
        pendingCount: this.queue.length,
        isProcessing: true,
        currentThoughtId: thought.id,
      },
      {
        type: 'processing',
        thoughtId: thought.id,
        attempts: thought.attempts,
      },
    );

    try {
      const sections = await ContextManager.readContext();
      const topics = sections.map(section => section.header);
      const synthesized = await SynthesisService.synthesize(thought.transcript, topics);

      await ContextManager.appendThought(synthesized.topic, synthesized.refinedText);

      this.queue.shift();
      this.syncState(
        {
          pendingCount: this.queue.length,
          lastError: null,
        },
        {
          type: 'completed',
          thoughtId: thought.id,
          attempts: thought.attempts,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      thought.attempts += 1;

      if (thought.attempts >= MAX_ATTEMPTS) {
        let fallbackError: string | null = null;

        try {
          await ContextManager.appendThought(FALLBACK_TOPIC, thought.transcript);
        } catch (fallbackFailure) {
          fallbackError = fallbackFailure instanceof Error ? fallbackFailure.message : String(fallbackFailure);
          console.error('[Queue] Fallback persistence failed:', fallbackFailure);
        }

        this.queue.shift();
        this.syncState(
          {
            pendingCount: this.queue.length,
            lastError: fallbackError ?? message,
          },
          {
            type: 'fallback',
            thoughtId: thought.id,
            error: fallbackError ?? message,
            attempts: thought.attempts,
          },
        );
      } else {
        this.syncState(
          {
            pendingCount: this.queue.length,
            lastError: message,
          },
          {
            type: 'retry',
            thoughtId: thought.id,
            error: message,
            attempts: thought.attempts,
          },
        );
      }
    } finally {
      this.isProcessing = false;
      this.syncState(
        {
          isProcessing: false,
          currentThoughtId: null,
        },
        {
          type: 'idle',
          thoughtId: null,
        },
      );

      if (this.queue.length > 0) {
        this.cooldownTimer = setTimeout(() => {
          this.processNext().catch(error => {
            console.error('[Queue] Failed to continue processing:', error);
          });
        }, RETRY_DELAY_MS);
      }
    }
  }

  private static syncState(patch: Partial<QueueState>, event: QueueEvent): void {
    this.state = {
      ...this.state,
      ...patch,
    };

    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot, event);
      } catch (error) {
        console.error('[Queue] Listener failed:', error);
      }
    }
  }
}
