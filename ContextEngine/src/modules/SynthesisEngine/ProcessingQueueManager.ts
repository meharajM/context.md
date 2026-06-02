import { ContextManager } from '../ContextManager';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import { createNoteId, type NoteSourceMetadata } from '../../shared/notes/noteTypes';

export interface SourceContextReference {
  sectionHeader: string;
  thoughtText: string;
  thoughtId?: string;
  noteId?: string;
  sourceMetadata?: NoteSourceMetadata;
}

export interface PendingThought {
  id: string;
  noteId: string;
  transcript: string;
  timestamp: string;
  attempts: number;
  kind: 'voice' | 'text' | 'image';
  selectedTopic?: string | null;
  sourceContext?: SourceContextReference;
}

export interface QueueState {
  pendingCount: number;
  isProcessing: boolean;
  currentThoughtId: string | null;
  lastError: string | null;
  blockedReason: string | null;
}

export interface QueueEvent {
  type: 'queued' | 'processing' | 'retry' | 'completed' | 'fallback' | 'idle' | 'blocked';
  thoughtId: string | null;
  error?: string;
  attempts?: number;
}

type QueueListener = (state: QueueState, event: QueueEvent) => void;

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;
const ATTEMPT_TIMEOUT_MS = 30000;
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
    blockedReason: null,
  };

  static addToQueue(
    transcript: string,
    kind: PendingThought['kind'] = 'text',
    sourceContext?: SourceContextReference,
    options: { noteId?: string; selectedTopic?: string | null } = {},
  ): string {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      return '';
    }

    const id = Math.random().toString(36).substring(7);
    const noteId = options.noteId?.trim() || createNoteId('note');
    this.queue.push({
      id,
      noteId,
      transcript: trimmedTranscript,
      timestamp: new Date().toISOString(),
      attempts: 0,
      kind,
      selectedTopic: options.selectedTopic ?? null,
      sourceContext,
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

  static getQueueSnapshot(): PendingThought[] {
    return this.queue.map(item => ({ ...item }));
  }

  static updateQueuedThought(
    thoughtId: string,
    updates: {
      transcript?: string;
      selectedTopic?: string | null;
      sourceContext?: SourceContextReference;
    },
  ): boolean {
    const index = this.queue.findIndex(item => item.id === thoughtId);
    if (index === -1 || this.queue[index].id === this.state.currentThoughtId) {
      return false;
    }

    this.queue[index] = {
      ...this.queue[index],
      transcript: updates.transcript?.trim() || this.queue[index].transcript,
      selectedTopic:
        updates.selectedTopic !== undefined ? updates.selectedTopic : this.queue[index].selectedTopic ?? null,
      sourceContext: updates.sourceContext ?? this.queue[index].sourceContext,
    };

    this.syncState(
      {
        pendingCount: this.queue.length,
        lastError: null,
      },
      {
        type: 'queued',
        thoughtId,
      },
    );

    return true;
  }

  static removeFromQueue(thoughtId: string): boolean {
    const index = this.queue.findIndex(item => item.id === thoughtId);
    if (index === -1 || this.queue[index].id === this.state.currentThoughtId) {
      return false;
    }

    this.queue.splice(index, 1);
    this.syncState(
      {
        pendingCount: this.queue.length,
        lastError: null,
      },
      {
        type: this.queue.length === 0 ? 'idle' : 'queued',
        thoughtId,
      },
    );
    return true;
  }

  static getState(): QueueState {
    return { ...this.state };
  }

  static setProcessingBlockedReason(reason: string | null): void {
    this.syncState(
      {
        blockedReason: reason,
        isProcessing: false,
        currentThoughtId: null,
      },
      {
        type: reason ? 'blocked' : this.queue.length === 0 ? 'idle' : 'queued',
        thoughtId: this.queue[0]?.id ?? null,
        error: reason ?? undefined,
      },
    );

    if (!reason && this.queue.length > 0) {
      this.processNext().catch(error => {
        console.error('[Queue] Failed to resume processing:', error);
      });
    }
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
      blockedReason: null,
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

    if (this.state.blockedReason) {
      this.syncState(
        {
          isProcessing: false,
          currentThoughtId: null,
        },
        {
          type: 'blocked',
          thoughtId: this.queue[0]?.id ?? null,
          error: this.state.blockedReason,
        },
      );
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
      if (thought.kind === 'voice' && thought.attempts === 0 && process.env.NODE_ENV !== 'test') {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      const sections = await ContextManager.readContext();
      const topics = sections
        .map(section => section.header)
        .filter(header => header.trim().toLowerCase() !== FALLBACK_TOPIC.toLowerCase());
      const synthesized = await this.withAttemptTimeout(
        SynthesisService.synthesize(thought.transcript, topics, thought.selectedTopic ?? null),
        thought.id,
      );

      await ContextManager.appendThought(synthesized.topic, synthesized.refinedText, {
        noteId: thought.noteId,
        sourceKind: thought.kind,
        sourceTranscript: thought.transcript,
        sourceMetadata: thought.sourceContext?.sourceMetadata ?? {
          kind: thought.kind,
          transcript: thought.transcript,
          noteId: thought.sourceContext?.noteId,
          sectionHeader: thought.sourceContext?.sectionHeader,
          text: thought.sourceContext?.thoughtText,
        },
      });

      if (thought.sourceContext) {
        await ContextManager.removeThought(
          thought.sourceContext.sectionHeader,
          thought.sourceContext.thoughtText,
          thought.sourceContext.noteId ?? thought.sourceContext.thoughtId,
        );
      }

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
          if (!thought.sourceContext) {
            await ContextManager.appendThought(FALLBACK_TOPIC, thought.transcript, {
              noteId: thought.noteId,
              sourceKind: thought.kind,
              sourceTranscript: thought.transcript,
              sourceMetadata: {
                kind: thought.kind,
                transcript: thought.transcript,
              },
            });
          }
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
      try {
        await SynthesisService.release();
      } catch (releaseError) {
        console.warn('[Queue] Failed to release synthesis runtime:', releaseError);
      }
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

  private static async withAttemptTimeout<T>(promise: Promise<T>, thoughtId: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`Synthesis attempt timed out for thought ${thoughtId}`));
          }, ATTEMPT_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
