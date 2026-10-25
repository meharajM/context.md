import { ContextManager } from '../../ContextManager';
import { ProcessingQueueManager } from '../ProcessingQueueManager';
import { SynthesisService } from '../SynthesisService';

jest.mock('../SynthesisService');
jest.mock('../../ContextManager');

describe('ProcessingQueueManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    ProcessingQueueManager.resetForTests();
    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);
    (ContextManager.getThoughtsFromSection as jest.Mock).mockImplementation((section: { content: string }) => [
      { text: section.content.replace(/^\s*-\s*/, '') },
    ]);
    (ContextManager.appendThought as jest.Mock).mockResolvedValue(undefined);
    (ContextManager.commitSynthesisResult as jest.Mock).mockImplementation(async (
      source: { sectionHeader: string; thoughtText: string; noteId?: string; thoughtId?: string },
      targetHeader: string,
      refinedText: string,
      options: Record<string, unknown>,
    ) => {
      await ContextManager.appendThought(targetHeader, refinedText, options);
      await ContextManager.removeThought(source.sectionHeader, source.thoughtText, source.noteId ?? source.thoughtId);
      return true;
    });
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Test',
      refinedText: 'Refined',
      tags: [],
      source: 'litert',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds items to the queue and publishes queue state', () => {
    const events: string[] = [];
    const unsubscribe = ProcessingQueueManager.subscribe((_, event) => {
      events.push(event.type);
    });

    const id = ProcessingQueueManager.addToQueue('Test transcript');

    expect(id).toBeTruthy();
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 1,
      isProcessing: true,
      currentThoughtId: expect.any(String),
      lastError: null,
    });
    expect(events).toContain('queued');
    expect(events).toContain('processing');

    unsubscribe();
  });

  it('deduplicates durable source IDs while a matching note is pending or active', async () => {
    let finishSynthesis!: (result: {
      topic: string;
      refinedText: string;
      tags: string[];
      source: 'litert';
    }) => void;
    (SynthesisService.synthesize as jest.Mock).mockImplementation(() => new Promise(resolve => {
      finishSynthesis = resolve;
    }));
    ProcessingQueueManager.setProcessingBlockedReason('Hold for dedupe test');

    const sourceContext = {
      sectionHeader: 'Inbox',
      thoughtText: 'Durable note',
      noteId: 'durable-note-pending',
    };
    const firstId = ProcessingQueueManager.addToQueue('Durable note', 'text', sourceContext, {
      noteId: 'durable-note-pending',
    });
    const pendingDuplicateId = ProcessingQueueManager.addToQueue('Durable note', 'text', undefined, {
      noteId: 'durable-note-pending',
    });

    expect(firstId).toBeTruthy();
    expect(pendingDuplicateId).toBe('');
    expect(ProcessingQueueManager.getQueueSnapshot()).toHaveLength(1);

    ProcessingQueueManager.setProcessingBlockedReason(null);
    await Promise.resolve();
    await Promise.resolve();

    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(1);
    expect(ProcessingQueueManager.getState().isProcessing).toBe(true);
    const activeDuplicateId = ProcessingQueueManager.addToQueue('Durable note', 'text', undefined, {
      noteId: 'durable-note-pending',
    });
    expect(activeDuplicateId).toBe('');
    expect(ProcessingQueueManager.getQueueSnapshot()).toHaveLength(1);

    finishSynthesis({ topic: 'Work', refinedText: 'Durable note.', tags: [], source: 'litert' });
    await jest.runOnlyPendingTimersAsync();
  });

  it('deduplicates a recently completed durable note', async () => {
    const sourceContext = {
      sectionHeader: 'Inbox',
      thoughtText: 'Completed durable note',
      noteId: 'durable-note-completed',
    };
    ProcessingQueueManager.addToQueue('Completed durable note', 'text', sourceContext, {
      noteId: 'durable-note-completed',
    });
    await jest.runOnlyPendingTimersAsync();

    expect(ProcessingQueueManager.getState().pendingCount).toBe(0);
    const duplicateId = ProcessingQueueManager.addToQueue('Completed durable note', 'text', sourceContext, {
      noteId: 'durable-note-completed',
    });

    expect(duplicateId).toBe('');
    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(1);
    expect(ContextManager.appendThought).toHaveBeenCalledTimes(1);
    expect(ProcessingQueueManager.getState().pendingCount).toBe(0);
  });

  it('allows an edited durable note to be synthesized after the previous text completed', async () => {
    const sourceContext = {
      sectionHeader: 'Work',
      thoughtText: 'Original note text',
      noteId: 'durable-note-edited',
    };
    ProcessingQueueManager.addToQueue('Original note text', 'text', sourceContext, {
      noteId: 'durable-note-edited',
    });
    await jest.runOnlyPendingTimersAsync();

    const editedContext = { ...sourceContext, thoughtText: 'Updated note text' };
    const editedId = ProcessingQueueManager.addToQueue('Updated note text', 'text', editedContext, {
      noteId: 'durable-note-edited',
    });
    expect(editedId).toBeTruthy();
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(ContextManager.appendThought).toHaveBeenCalledTimes(2);
    expect(ProcessingQueueManager.getState().pendingCount).toBe(0);
  });

  it('coalesces newer active revisions and persists the latest transcript after stale work settles', async () => {
    let finishEditB!: (result: {
      topic: string;
      refinedText: string;
      tags: string[];
      source: 'litert';
    }) => void;
    (SynthesisService.synthesize as jest.Mock).mockImplementation((transcript: string) => {
      if (transcript === 'Edit B') {
        return new Promise(resolve => {
          finishEditB = resolve;
        });
      }
      return Promise.resolve({
        topic: 'Work',
        refinedText: `Refined ${transcript}`,
        tags: [],
        source: 'litert',
      });
    });

    const noteId = 'durable-note-revision-race';
    const enqueueRevision = (text: string) => ProcessingQueueManager.addToQueue(
      text,
      'text',
      { sectionHeader: 'Inbox', thoughtText: text, noteId },
      { noteId },
    );

    const editBId = enqueueRevision('Edit B');
    await Promise.resolve();
    await Promise.resolve();
    expect(SynthesisService.synthesize).toHaveBeenCalledWith('Edit B', expect.anything(), null, expect.anything());

    const editCId = enqueueRevision('Edit C');
    const editDId = enqueueRevision('Edit D');
    expect(editCId).toBeTruthy();
    expect(editDId).toBe(editCId);
    expect(ProcessingQueueManager.getQueueSnapshot().map(item => item.transcript)).toEqual(['Edit B', 'Edit D']);

    finishEditB({ topic: 'Old topic', refinedText: 'Refined Edit B', tags: [], source: 'litert' });
    await jest.runOnlyPendingTimersAsync();

    expect((SynthesisService.synthesize as jest.Mock).mock.calls.map(([transcript]: [string]) => transcript)).toEqual(['Edit B', 'Edit D']);
    expect(ContextManager.commitSynthesisResult).toHaveBeenCalledTimes(1);
    expect(ContextManager.commitSynthesisResult).toHaveBeenCalledWith(
      expect.objectContaining({ thoughtText: 'Edit D', noteId }),
      'Work',
      'Refined Edit D',
      expect.objectContaining({ noteId, sourceTranscript: 'Edit D' }),
    );
    expect(ContextManager.appendThought).toHaveBeenCalledTimes(1);
    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Work',
      'Refined Edit D',
      expect.objectContaining({ noteId, sourceTranscript: 'Edit D' }),
    );
    expect(ProcessingQueueManager.getState().pendingCount).toBe(0);
    expect(ProcessingQueueManager.getState().isProcessing).toBe(false);
    expect(editBId).toBeTruthy();
  });

  it('allows retrying the same durable note after fallback or blocked persistence', async () => {
    (SynthesisService.synthesize as jest.Mock).mockResolvedValueOnce({
      topic: 'Inbox',
      refinedText: 'Uncategorized durable note',
      tags: [],
      source: 'raw-fallback',
    });
    const fallbackContext = {
      sectionHeader: 'Inbox',
      thoughtText: 'Uncategorized durable note',
      noteId: 'durable-note-fallback',
    };
    ProcessingQueueManager.addToQueue('Uncategorized durable note', 'text', fallbackContext, {
      noteId: 'durable-note-fallback',
    });
    await jest.runOnlyPendingTimersAsync();

    const retryAfterFallback = ProcessingQueueManager.addToQueue(
      'Uncategorized durable note',
      'text',
      fallbackContext,
      { noteId: 'durable-note-fallback' },
    );
    expect(retryAfterFallback).toBeTruthy();
    await jest.runOnlyPendingTimersAsync();
    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(ProcessingQueueManager.getState().pendingCount).toBe(0);

    ProcessingQueueManager.resetForTests();
    jest.clearAllMocks();
    (ContextManager.readContext as jest.Mock).mockResolvedValue([]);
    (ContextManager.appendThought as jest.Mock).mockResolvedValue(undefined);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Blocked durable note.',
      tags: [],
      source: 'litert',
    });
    ProcessingQueueManager.setProcessingBlockedReason('Hold for blocked retry test');
    const blockedContext = {
      sectionHeader: 'Inbox',
      thoughtText: 'Blocked durable note',
      noteId: 'durable-note-blocked',
    };
    const blockedId = ProcessingQueueManager.addToQueue('Blocked durable note', 'text', blockedContext, {
      noteId: 'durable-note-blocked',
    });
    expect(ProcessingQueueManager.addToQueue('Blocked durable note', 'text', blockedContext, {
      noteId: 'durable-note-blocked',
    })).toBe('');
    expect(ProcessingQueueManager.removeFromQueue(blockedId)).toBe(true);
    expect(ProcessingQueueManager.addToQueue('Blocked durable note', 'text', blockedContext, {
      noteId: 'durable-note-blocked',
    })).toBeTruthy();
  });

  it('processes items and updates context', async () => {
    const events: string[] = [];
    const unsubscribe = ProcessingQueueManager.subscribe((_, event) => {
      events.push(event.type);
    });

    ProcessingQueueManager.addToQueue('Final test');
    await jest.runOnlyPendingTimersAsync();

    expect(ContextManager.appendThought).toHaveBeenCalledWith('Test', 'Refined', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'Final test',
    }));
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
    });
    expect(events).toContain('completed');

    unsubscribe();
  });

  it('publishes the destination topic when categorization completes', async () => {
    const completedEvents: Array<{ type: string; topic?: string }> = [];
    const unsubscribe = ProcessingQueueManager.subscribe((_, event) => {
      if (event.type === 'completed') {
        completedEvents.push(event);
      }
    });

    ProcessingQueueManager.addToQueue('Final test');
    await jest.runOnlyPendingTimersAsync();

    expect(completedEvents).toEqual([{ type: 'completed', thoughtId: expect.any(String), topic: 'Test', attempts: 0 }]);
    unsubscribe();
  });

  it('processes multiple queued captures sequentially in insertion order', async () => {
    (SynthesisService.synthesize as jest.Mock).mockImplementation(async transcript => {
      if (transcript.includes('roadmap')) {
        return {
          topic: 'Work',
          refinedText: `Refined ${transcript}`,
          tags: ['work'],
          source: 'litert',
        };
      }

      if (transcript.includes('dinner')) {
        return {
          topic: 'Home',
          refinedText: `Refined ${transcript}`,
          tags: ['home'],
          source: 'litert',
        };
      }

      return {
        topic: 'Health',
        refinedText: `Refined ${transcript}`,
        tags: ['health'],
        source: 'litert',
      };
    });

    ProcessingQueueManager.addToQueue('ship the roadmap update', 'text');
    ProcessingQueueManager.addToQueue('plan dinner groceries', 'voice');
    ProcessingQueueManager.addToQueue('book annual physical', 'text');

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(1, 'ship the roadmap update', [], null, []);
    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(2, 'plan dinner groceries', [], null, []);
    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(3, 'book annual physical', [], null, []);
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(1, 'Work', 'Refined ship the roadmap update', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'ship the roadmap update',
    }));
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(2, 'Home', 'Refined plan dinner groceries', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'voice',
      sourceTranscript: 'plan dinner groceries',
    }));
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(3, 'Health', 'Refined book annual physical', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'book annual physical',
    }));
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
    });
  });

  it('preserves imported voice metadata and skips the live capture delay', async () => {
    ProcessingQueueManager.addToQueue('imported voice transcript', 'voice', undefined, {
      skipVoiceDelay: true,
      sourceMetadata: {
        kind: 'voice',
        transcript: 'imported voice transcript',
        audioFilePath: '/tmp/imported.m4a',
      },
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith('imported voice transcript', [], null, []);
    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Test',
      'Refined',
      expect.objectContaining({
        noteId: expect.any(String),
        sourceKind: 'voice',
        sourceTranscript: 'imported voice transcript',
        sourceMetadata: expect.objectContaining({
          audioFilePath: '/tmp/imported.m4a',
        }),
      }),
    );
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
    });
  });

  it('retries once and then persists the raw transcript to Inbox', async () => {
    (SynthesisService.synthesize as jest.Mock)
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'));

    const events: string[] = [];
    const unsubscribe = ProcessingQueueManager.subscribe((_, event) => {
      events.push(event.type);
    });

    ProcessingQueueManager.addToQueue('Failure path');

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Failure path', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'Failure path',
    }));
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
    });
    expect(events).toContain('retry');
    expect(events).toContain('fallback');

    unsubscribe();
  });

  it('holds an ambiguous thought for clarification and resumes under the selected topic', async () => {
    const clarification = {
      question: 'Which area is this update about?',
      options: [
        { topic: 'Work', reason: 'The team suggests a work context.' },
        { topic: 'Projects', reason: 'Use this for a project update.' },
      ],
    };
    (SynthesisService.synthesize as jest.Mock).mockResolvedValueOnce({
      topic: 'Inbox',
      refinedText: 'Send the update to the team.',
      tags: ['update'],
      source: 'litert',
      clarification,
    });

    const events: string[] = [];
    const unsubscribe = ProcessingQueueManager.subscribe((_, event) => {
      events.push(event.type);
    });
    const thoughtId = ProcessingQueueManager.addToQueue('send the update to the team');

    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();

    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 1,
      isProcessing: false,
      currentThoughtId: null,
      clarification: {
        thoughtId,
        question: 'Which area is this update about?',
        options: [{ topic: 'Work' }, { topic: 'Projects' }],
      },
    });
    expect(ContextManager.appendThought).not.toHaveBeenCalled();
    expect(events).toContain('clarification');

    expect(ProcessingQueueManager.resolveClarification(thoughtId, 'Work')).toBe(true);
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(SynthesisService.synthesize).toHaveBeenLastCalledWith('send the update to the team', [], 'Work', []);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Test', 'Refined', expect.anything());
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      clarification: null,
    });

    unsubscribe();
  });

  it('continues to the next item when a clarification is cancelled', async () => {
    (SynthesisService.synthesize as jest.Mock)
      .mockResolvedValueOnce({
        topic: 'Inbox',
        refinedText: 'Unclear note',
        tags: [],
        source: 'litert',
        clarification: { question: 'Which topic?', options: [{ topic: 'Work' }] },
      })
      .mockResolvedValueOnce({ topic: 'Work', refinedText: 'Next note', tags: [], source: 'litert' });

    const clarificationId = ProcessingQueueManager.addToQueue('Unclear note', 'text');
    await jest.runOnlyPendingTimersAsync();
    const nextId = ProcessingQueueManager.addToQueue('Next note', 'text');

    expect(ProcessingQueueManager.removeFromQueue(clarificationId)).toBe(true);
    await jest.runOnlyPendingTimersAsync();

    expect(nextId).toBeTruthy();
    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(ProcessingQueueManager.getState()).toMatchObject({ pendingCount: 0, clarification: null });
  });

  it('continues to the next item when deleting the note held for clarification', async () => {
    (SynthesisService.synthesize as jest.Mock)
      .mockResolvedValueOnce({
        topic: 'Inbox',
        refinedText: 'Unclear note',
        tags: [],
        source: 'litert',
        clarification: { question: 'Which topic?', options: [{ topic: 'Work' }] },
      })
      .mockResolvedValueOnce({ topic: 'Work', refinedText: 'Next note', tags: [], source: 'litert' });

    const clarificationId = ProcessingQueueManager.addToQueue('Unclear note', 'text', undefined, {
      noteId: 'clarification-note',
    });
    await jest.runOnlyPendingTimersAsync();
    ProcessingQueueManager.addToQueue('Next note', 'text');

    expect(ProcessingQueueManager.removePendingThoughtsByNoteId('clarification-note')).toEqual({
      removedCount: 1,
      blockedByActive: false,
    });
    await jest.runOnlyPendingTimersAsync();

    expect(ProcessingQueueManager.getState()).toMatchObject({ pendingCount: 0, clarification: null });
    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(clarificationId).toBeTruthy();
  });

  it('keeps an active inference protected when readiness changes and does not report it blocked', async () => {
    let finishSynthesis!: (result: { topic: string; refinedText: string; tags: string[]; source: 'litert' }) => void;
    (SynthesisService.synthesize as jest.Mock).mockImplementation(() => new Promise(resolve => {
      finishSynthesis = resolve;
    }));
    const thoughtId = ProcessingQueueManager.addToQueue('Currently processing', 'text', {
      sectionHeader: 'Inbox', thoughtText: 'Currently processing', noteId: 'active-note',
    }, { noteId: 'active-note' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const settled = ProcessingQueueManager.waitUntilSettled(5000);
    let didSettle = false;
    void settled.then(() => { didSettle = true; });
    ProcessingQueueManager.setProcessingBlockedReason('Waiting for device resources');

    expect(ProcessingQueueManager.getState()).toMatchObject({
      isProcessing: true,
      currentThoughtId: thoughtId,
      blockedReason: 'Waiting for device resources',
    });
    expect(ProcessingQueueManager.removePendingThoughtsByNoteId('active-note')).toEqual({
      removedCount: 0,
      blockedByActive: true,
    });
    await Promise.resolve();
    expect(didSettle).toBe(false);

    finishSynthesis({ topic: 'Work', refinedText: 'Currently processing.', tags: [], source: 'litert' });
    await jest.runOnlyPendingTimersAsync();
    await expect(settled).resolves.toBe('idle');
  });

  it('keeps an edited durable revision after readiness refresh supersedes active work', async () => {
    let finishOriginal!: (result: { topic: string; refinedText: string; tags: string[]; source: 'litert' }) => void;
    (SynthesisService.synthesize as jest.Mock).mockImplementation((transcript: string) => {
      if (transcript === 'Original text') {
        return new Promise(resolve => { finishOriginal = resolve; });
      }
      return Promise.resolve({
        topic: 'Work',
        refinedText: 'Corrected text filed under Work',
        tags: [],
        source: 'litert',
      });
    });

    const noteId = 'readiness-edited-note';
    const enqueue = (text: string) => ProcessingQueueManager.addToQueue(
      text,
      'text',
      { sectionHeader: 'Inbox', thoughtText: text, noteId },
      { noteId },
    );
    enqueue('Original text');
    await Promise.resolve();
    await Promise.resolve();
    expect(SynthesisService.synthesize).toHaveBeenCalledWith('Original text', expect.anything(), null, expect.anything());

    ProcessingQueueManager.setProcessingBlockedReason('Waiting for device resources');
    const revisedId = enqueue('Corrected text');
    expect(revisedId).toBeTruthy();
    expect(ProcessingQueueManager.getState()).toMatchObject({
      isProcessing: true,
      currentThoughtId: expect.any(String),
      blockedReason: 'Waiting for device resources',
    });

    finishOriginal({ topic: 'Work', refinedText: 'Stale original result', tags: [], source: 'litert' });
    await jest.runOnlyPendingTimersAsync();
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 1,
      isProcessing: false,
      currentThoughtId: null,
      blockedReason: 'Waiting for device resources',
    });
    expect(ProcessingQueueManager.getQueueSnapshot().map(item => item.transcript)).toEqual(['Corrected text']);
    expect(ContextManager.commitSynthesisResult).not.toHaveBeenCalled();

    ProcessingQueueManager.setProcessingBlockedReason(null);
    await jest.runOnlyPendingTimersAsync();

    expect((SynthesisService.synthesize as jest.Mock).mock.calls.map(([text]: [string]) => text)).toEqual([
      'Original text',
      'Corrected text',
    ]);
    expect(ContextManager.commitSynthesisResult).toHaveBeenCalledTimes(1);
    expect(ContextManager.commitSynthesisResult).toHaveBeenCalledWith(
      expect.objectContaining({ thoughtText: 'Corrected text', noteId }),
      'Work',
      'Corrected text filed under Work',
      expect.objectContaining({ noteId, sourceTranscript: 'Corrected text' }),
    );
    expect(ProcessingQueueManager.getState()).toMatchObject({ pendingCount: 0, isProcessing: false });
  });

  it('sends parsed multiline topic notes to synthesis without storage framing', async () => {
    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Work', content: 'encoded markdown body' },
    ]);
    (ContextManager.getThoughtsFromSection as jest.Mock).mockReturnValue([
      { text: 'First saved note\nwith continuation' },
      { text: 'Second saved note' },
    ]);

    ProcessingQueueManager.addToQueue('A new work note');
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith('A new work note', ['Work'], null, [
      { topic: 'Work', content: 'First saved note\nwith continuation\nSecond saved note' },
    ]);
  });

  it('removes pending items but keeps the active processing item protected', () => {
    (SynthesisService.synthesize as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const activeId = ProcessingQueueManager.addToQueue('Active transcript', 'voice');
    const pendingId = ProcessingQueueManager.addToQueue('Pending transcript', 'text');

    expect(ProcessingQueueManager.removeFromQueue(activeId)).toBe(false);
    expect(ProcessingQueueManager.removeFromQueue(pendingId)).toBe(true);
    expect(ProcessingQueueManager.getQueueSnapshot()).toHaveLength(1);
    expect(ProcessingQueueManager.getQueueSnapshot()[0]).toMatchObject({
      id: activeId,
      transcript: 'Active transcript',
      kind: 'voice',
    });
  });

  it('removes all pending queue work that references a deleted persisted note', () => {
    ProcessingQueueManager.setProcessingBlockedReason('Hold for deletion test');
    ProcessingQueueManager.addToQueue('First representation', 'text', {
      sectionHeader: 'Inbox',
      thoughtText: 'Raw note',
      noteId: 'note-delete-me',
    }, { noteId: 'queue-copy-1' });
    const duplicateRepresentationId = ProcessingQueueManager.addToQueue('Second representation', 'text', undefined, {
      noteId: 'note-delete-me',
    });
    ProcessingQueueManager.addToQueue('Keep this note', 'text', undefined, {
      noteId: 'note-keep-me',
    });

    expect(duplicateRepresentationId).toBeTruthy();
    expect(ProcessingQueueManager.removePendingThoughtsByNoteId('note-delete-me')).toEqual({
      removedCount: 1,
      blockedByActive: false,
    });
    expect(ProcessingQueueManager.getQueueSnapshot()).toEqual([
      expect.objectContaining({ noteId: 'note-keep-me', transcript: 'Keep this note' }),
    ]);
  });

  it('refuses source-note deletion while its queue work is actively processing', () => {
    (SynthesisService.synthesize as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    ProcessingQueueManager.addToQueue('Active Inbox source', 'text', {
      sectionHeader: 'Inbox',
      thoughtText: 'Active Inbox source',
      noteId: 'note-active',
    });

    expect(ProcessingQueueManager.removePendingThoughtsByNoteId('note-active')).toEqual({
      removedCount: 0,
      blockedByActive: true,
    });
    expect(ProcessingQueueManager.getQueueSnapshot()).toHaveLength(1);
  });

  it('updates a queued item that is not actively processing', () => {
    (SynthesisService.synthesize as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const activeId = ProcessingQueueManager.addToQueue('Active transcript', 'voice');
    const pendingId = ProcessingQueueManager.addToQueue('Pending transcript', 'text');

    expect(ProcessingQueueManager.updateQueuedThought(activeId, { transcript: 'Edited active' })).toBe(false);
    expect(
      ProcessingQueueManager.updateQueuedThought(pendingId, {
        transcript: 'Edited pending',
        selectedTopic: 'Work',
      }),
    ).toBe(true);

    expect(ProcessingQueueManager.getQueueSnapshot()[1]).toMatchObject({
      id: pendingId,
      transcript: 'Edited pending',
      selectedTopic: 'Work',
    });
  });

  it('times out hanging synthesis attempts, persists raw transcript, and clears the queue', async () => {
    (SynthesisService.synthesize as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const events: string[] = [];
    const unsubscribe = ProcessingQueueManager.subscribe((_, event) => {
      events.push(event.type);
    });

    ProcessingQueueManager.addToQueue('Hanging synthesis path');

    await jest.advanceTimersByTimeAsync(30000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(30000);

    expect(SynthesisService.synthesize).toHaveBeenCalledTimes(2);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Hanging synthesis path', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'Hanging synthesis path',
    }));
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      lastError: expect.stringContaining('timed out'),
    });
    expect(events).toContain('retry');
    expect(events).toContain('fallback');

    unsubscribe();
  });

  it('keeps queued captures waiting until model download unblocks synthesis', async () => {
    const events: string[] = [];
    const unsubscribe = ProcessingQueueManager.subscribe((state, event) => {
      if (event.type === 'blocked' && state.blockedReason) {
        events.push(state.blockedReason);
        return;
      }
      events.push(event.type);
    });

    ProcessingQueueManager.setProcessingBlockedReason('Install Gemma3-1B-IT to categorize queued thoughts with on-device AI');
    ProcessingQueueManager.addToQueue('Ship the roadmap update');

    expect(SynthesisService.synthesize).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 1,
      isProcessing: false,
      blockedReason: 'Install Gemma3-1B-IT to categorize queued thoughts with on-device AI',
    });

    ProcessingQueueManager.setProcessingBlockedReason(null);
    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith('Ship the roadmap update', [], null, []);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Test', 'Refined', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'Ship the roadmap update',
    }));
    expect(events).toContain('processing');
    expect(ProcessingQueueManager.getState().blockedReason).toBeNull();

    unsubscribe();
  });

  it('reports resource-blocked pending work as settled for a background runner', async () => {
    ProcessingQueueManager.setProcessingBlockedReason(
      'Waiting for device resources: available memory is low',
    );
    ProcessingQueueManager.addToQueue('A durable note', 'text');

    await expect(ProcessingQueueManager.waitUntilSettled()).resolves.toBe('blocked');
  });

  it('categorizes captures into synthesized topics and ignores Inbox as a candidate topic', async () => {
    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Inbox', content: '- raw fallback' },
      { header: 'Work', content: '- existing work note' },
    ]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Ship the roadmap update.',
      tags: ['work'],
      source: 'litert',
    });

    ProcessingQueueManager.addToQueue('Ship the roadmap update', 'voice');
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith(
      'Ship the roadmap update',
      ['Work'],
      null,
      [{ topic: 'Work', content: 'existing work note' }],
    );
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Work', 'Ship the roadmap update.', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'voice',
      sourceTranscript: 'Ship the roadmap update',
    }));
  });

  it('uses a selected topic in a single synthesis pass for queued edits', async () => {
    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Work', content: '- existing work note' },
      { header: 'Home', content: '- existing home note' },
    ]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Work',
      refinedText: 'Ship the roadmap update.',
      tags: ['work'],
      source: 'litert',
    });

    ProcessingQueueManager.addToQueue('Ship the roadmap update', 'text', undefined, {
      selectedTopic: 'Work',
    });
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith(
      'Ship the roadmap update',
      ['Work', 'Home'],
      'Work',
      [
        { topic: 'Work', content: 'existing work note' },
        { topic: 'Home', content: 'existing home note' },
      ],
    );
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Work', 'Ship the roadmap update.', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'Ship the roadmap update',
    }));
  });

  it('removes an Inbox source item after successful re-synthesis', async () => {
    (ContextManager.readContext as jest.Mock).mockResolvedValue([
      { header: 'Inbox', content: '- raw fallback' },
      { header: 'Errands', content: '- existing errand' },
    ]);
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Errands',
      refinedText: 'Buy milk.',
      tags: ['shopping'],
      source: 'litert',
    });
    (ContextManager.removeThought as jest.Mock).mockResolvedValue(true);

    ProcessingQueueManager.addToQueue('buy milk', 'text', {
      sectionHeader: 'Inbox',
      thoughtText: 'buy milk',
    });
    await jest.runOnlyPendingTimersAsync();

    expect(ContextManager.appendThought).toHaveBeenCalledWith('Errands', 'Buy milk.', expect.objectContaining({
      noteId: expect.any(String),
      sourceKind: 'text',
      sourceTranscript: 'buy milk',
      sourceMetadata: expect.objectContaining({
        sectionHeader: 'Inbox',
        text: 'buy milk',
      }),
    }));
    expect(ContextManager.removeThought).toHaveBeenCalledWith('Inbox', 'buy milk', undefined);
  });

  it('does not duplicate an Inbox source item when re-synthesis falls back again', async () => {
    (SynthesisService.synthesize as jest.Mock)
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'));

    ProcessingQueueManager.addToQueue('still raw', 'text', {
      sectionHeader: 'Inbox',
      thoughtText: 'still raw',
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    expect(ContextManager.appendThought).not.toHaveBeenCalledWith('Inbox', 'still raw', expect.anything());
  });

  it('keeps the original Inbox item when synthesis resolves to raw fallback', async () => {
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Inbox',
      refinedText: 'Still raw',
      tags: ['fallback'],
      source: 'raw-fallback',
    });

    ProcessingQueueManager.addToQueue('still raw', 'text', {
      sectionHeader: 'Inbox',
      thoughtText: 'still raw',
      noteId: 'note-inbox-1',
    });

    await jest.runOnlyPendingTimersAsync();

    expect(ContextManager.appendThought).not.toHaveBeenCalled();
    expect(ContextManager.removeThought).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 0,
      lastError: null,
    });
  });

  it('persists the untouched transcript to Inbox when synthesis resolves to raw fallback', async () => {
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Errands',
      refinedText: 'Heuristically changed text.',
      tags: ['fallback'],
      source: 'raw-fallback',
    });

    ProcessingQueueManager.addToQueue('um buy milk', 'text');
    await jest.runOnlyPendingTimersAsync();

    expect(ContextManager.appendThought).toHaveBeenCalledWith(
      'Inbox',
      'um buy milk',
      expect.objectContaining({
        sourceKind: 'text',
        sourceTranscript: 'um buy milk',
      }),
    );
    expect(ContextManager.appendThought).not.toHaveBeenCalledWith(
      'Errands',
      'Heuristically changed text.',
      expect.anything(),
    );
  });

  it('keeps an Inbox source when model output is not categorized', async () => {
    (SynthesisService.synthesize as jest.Mock).mockResolvedValue({
      topic: 'Inbox',
      refinedText: 'Still uncategorized.',
      tags: [],
      source: 'litert',
    });

    ProcessingQueueManager.addToQueue('still uncategorized', 'text', {
      sectionHeader: 'Inbox',
      thoughtText: 'still uncategorized',
      noteId: 'note-inbox-2',
    });
    await jest.runOnlyPendingTimersAsync();

    expect(ContextManager.appendThought).not.toHaveBeenCalled();
    expect(ContextManager.removeThought).not.toHaveBeenCalled();
  });

  it('keeps a capture queued and blocks processing if raw Inbox persistence fails', async () => {
    (SynthesisService.synthesize as jest.Mock)
      .mockRejectedValueOnce(new Error('first synthesis failure'))
      .mockRejectedValueOnce(new Error('second synthesis failure'));
    (ContextManager.appendThought as jest.Mock).mockRejectedValue(new Error('disk write failed'));

    ProcessingQueueManager.addToQueue('must not be dropped', 'text');
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    expect(ProcessingQueueManager.getQueueSnapshot()).toHaveLength(1);
    expect(ProcessingQueueManager.getQueueSnapshot()[0].transcript).toBe('must not be dropped');
    expect(ProcessingQueueManager.getState()).toMatchObject({
      pendingCount: 1,
      blockedReason: 'Raw Inbox persistence failed: disk write failed',
      lastError: 'disk write failed',
    });
  });

  it('delays processing of voice captures to allow resources to release', async () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

    try {
      ProcessingQueueManager.addToQueue('voice note to delay', 'voice');

      // The queue is active, but isProcessing is true and it is in the sleep block,
      // so synthesis should not be called immediately.
      expect(SynthesisService.synthesize).not.toHaveBeenCalled();

      // Advance by 3000ms to resolve the sleep delay
      await jest.advanceTimersByTimeAsync(3000);

      expect(SynthesisService.synthesize).toHaveBeenCalledWith('voice note to delay', [], null, []);
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
    }
  });
});
