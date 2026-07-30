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
    (ContextManager.appendThought as jest.Mock).mockResolvedValue(undefined);
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
    ProcessingQueueManager.addToQueue('Second representation', 'text', undefined, {
      noteId: 'note-delete-me',
    });
    ProcessingQueueManager.addToQueue('Keep this note', 'text', undefined, {
      noteId: 'note-keep-me',
    });

    expect(ProcessingQueueManager.removePendingThoughtsByNoteId('note-delete-me')).toEqual({
      removedCount: 2,
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
      [{ topic: 'Work', content: '- existing work note' }],
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
        { topic: 'Work', content: '- existing work note' },
        { topic: 'Home', content: '- existing home note' },
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
