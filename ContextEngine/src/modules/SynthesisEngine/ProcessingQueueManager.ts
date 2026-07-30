import { ContextManager } from '../ContextManager';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import type { SynthesisClarification, TopicOption } from './runtimes/types';
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
  clarification?: SynthesisClarification;
  skipVoiceDelay?: boolean;
  sourceMetadata?: NoteSourceMetadata;
  sourceContext?: SourceContextReference;
}

export interface QueueState {
  pendingCount: number;
  isProcessing: boolean;
  currentThoughtId: string | null;
  lastError: string | null;
  blockedReason: string | null;
  clarification: QueueClarification | null;
}

export interface QueueClarification {
  thoughtId: string;
  noteId: string;
  question: string;
  options: TopicOption[];
}

export interface QueueEvent {
  type: 'queued' | 'processing' | 'retry' | 'completed' | 'fallback' | 'clarification' | 'idle' | 'blocked';
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
    clarification: null,
  };

  static addToQueue(
    transcript: string,
    kind: PendingThought['kind'] = 'text',
    sourceContext?: SourceContextReference,
    options: {
      noteId?: string;
      selectedTopic?: string | null;
      skipVoiceDelay?: boolean;
      sourceMetadata?: NoteSourceMetadata;
    } = {},
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
      skipVoiceDelay: options.skipVoiceDelay ?? false,
      sourceMetadata: options.sourceMetadata,
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
      sourceMetadata?: NoteSourceMetadata;
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
      sourceMetadata: updates.sourceMetadata ?? this.queue[index].sourceMetadata,
      sourceContext: updates.sourceContext ?? this.queue[index].sourceContext,
      clarification: undefined,
    };

    const clearsClarification = this.state.clarification?.thoughtId === thoughtId;

    this.syncState(
      {
        pendingCount: this.queue.length,
        lastError: null,
        ...(clearsClarification ? { clarification: null } : {}),
      },
      {
        type: 'queued',
        thoughtId,
      },
    );

    if (clearsClarification) {
      this.processNext().catch(error => {
        console.error('[Queue] Failed to resume after clarification edit:', error);
      });
    }

    return true;
  }

  static resolveClarification(thoughtId: string, selectedTopic: string): boolean {
    const normalizedTopic = selectedTopic.trim();
    const thought = this.queue.find(item => item.id === thoughtId);
    if (!thought || !normalizedTopic || this.state.clarification?.thoughtId !== thoughtId) {
      return false;
    }

    thought.selectedTopic = normalizedTopic;
    thought.clarification = undefined;
    thought.attempts = 0;
    this.syncState(
      {
        clarification: null,
        lastError: null,
      },
      {
        type: 'queued',
        thoughtId,
      },
    );
    this.processNext().catch(error => {
      console.error('[Queue] Failed to resume after clarification:', error);
    });
    return true;
  }

  static removeFromQueue(thoughtId: string): boolean {
    const index = this.queue.findIndex(item => item.id === thoughtId);
    if (index === -1 || this.queue[index].id === this.state.currentThoughtId) {
      return false;
    }

    this.queue.splice(index, 1);
    const removesClarification = this.state.clarification?.thoughtId === thoughtId;
    this.syncState(
      {
        pendingCount: this.queue.length,
        lastError: null,
        ...(removesClarification ? { clarification: null } : {}),
      },
      {
        type: this.queue.length === 0 ? 'idle' : 'queued',
        thoughtId,
      },
    );
    return true;
  }

  static removePendingThoughtsByNoteId(noteId: string): {
    removedCount: number;
    blockedByActive: boolean;
  } {
    const normalizedNoteId = noteId.trim();
    if (!normalizedNoteId) {
      return { removedCount: 0, blockedByActive: false };
    }

    const matchesNote = (item: PendingThought) =>
      item.noteId === normalizedNoteId ||
      item.sourceContext?.noteId === normalizedNoteId ||
      item.sourceContext?.thoughtId === normalizedNoteId;
    const activeItem = this.queue.find(item => item.id === this.state.currentThoughtId);

    if (activeItem && matchesNote(activeItem)) {
      return { removedCount: 0, blockedByActive: true };
    }

    const beforeCount = this.queue.length;
    this.queue = this.queue.filter(item => !matchesNote(item));
    const removedCount = beforeCount - this.queue.length;
    const removesClarification = this.state.clarification?.noteId === normalizedNoteId;

    if (removedCount > 0) {
      this.syncState(
        {
          pendingCount: this.queue.length,
          lastError: null,
          ...(removesClarification ? { clarification: null } : {}),
        },
        {
          type: this.queue.length === 0 ? 'idle' : 'queued',
          thoughtId: null,
        },
      );
    }

    return { removedCount, blockedByActive: false };
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
      clarification: null,
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

    if (this.state.clarification) {
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
      if (
        thought.kind === 'voice' &&
        !thought.skipVoiceDelay &&
        thought.attempts === 0 &&
        process.env.NODE_ENV !== 'test'
      ) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      const sections = await ContextManager.readContext();
      const semanticSections = sections.filter(
        section => section.header.trim().toLowerCase() !== FALLBACK_TOPIC.toLowerCase(),
      );
      const topics = semanticSections.map(section => section.header);
      const topicContexts = semanticSections.map(section => ({
        topic: section.header,
        content: section.content,
      }));
      const synthesized = await this.withAttemptTimeout(
        SynthesisService.synthesize(
          thought.transcript,
          topics,
          thought.selectedTopic ?? null,
          topicContexts,
        ),
        thought.id,
      );

      if (synthesized.clarification) {
        thought.clarification = synthesized.clarification;
        this.syncState(
          {
            pendingCount: this.queue.length,
            isProcessing: false,
            currentThoughtId: null,
            clarification: {
              thoughtId: thought.id,
              noteId: thought.noteId,
              question: synthesized.clarification.question,
              options: synthesized.clarification.options,
            },
            lastError: null,
          },
          {
            type: 'clarification',
            thoughtId: thought.id,
          },
        );
        return;
      }

      const sourceMetadata =
        thought.sourceMetadata ??
        thought.sourceContext?.sourceMetadata ??
        {
          kind: thought.kind,
          transcript: thought.transcript,
          noteId: thought.sourceContext?.noteId,
          sectionHeader: thought.sourceContext?.sectionHeader,
          text: thought.sourceContext?.thoughtText,
        };

      const isModelBackedCategorization =
        synthesized.source === 'litert' &&
        synthesized.topic.trim().toLowerCase() !== FALLBACK_TOPIC.toLowerCase();

      if (!isModelBackedCategorization) {
        if (!thought.sourceContext) {
          await ContextManager.appendThought(FALLBACK_TOPIC, thought.transcript, {
            noteId: thought.noteId,
            sourceKind: thought.kind,
            sourceTranscript: thought.transcript,
            sourceMetadata,
          });
        }

        this.queue.shift();
        this.syncState(
          {
            pendingCount: this.queue.length,
            lastError: null,
          },
          {
            type: 'fallback',
            thoughtId: thought.id,
            attempts: thought.attempts,
          },
        );
        return;
      }

      await ContextManager.appendThought(synthesized.topic, synthesized.refinedText, {
        noteId: thought.noteId,
        sourceKind: thought.kind,
        sourceTranscript: thought.transcript,
        sourceMetadata,
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
              sourceMetadata: thought.sourceMetadata ?? {
                kind: thought.kind,
                transcript: thought.transcript,
              },
            });
          }
        } catch (fallbackFailure) {
          fallbackError = fallbackFailure instanceof Error ? fallbackFailure.message : String(fallbackFailure);
          console.error('[Queue] Fallback persistence failed:', fallbackFailure);
        }

        if (fallbackError && !thought.sourceContext) {
          this.syncState(
            {
              pendingCount: this.queue.length,
              lastError: fallbackError,
              blockedReason: `Raw Inbox persistence failed: ${fallbackError}`,
            },
            {
              type: 'blocked',
              thoughtId: thought.id,
              error: fallbackError,
              attempts: thought.attempts,
            },
          );
          return;
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

      if (this.queue.length > 0 && !this.state.clarification && !this.state.blockedReason) {
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
