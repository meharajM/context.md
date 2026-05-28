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
        };
      }

      if (transcript.includes('dinner')) {
        return {
          topic: 'Home',
          refinedText: `Refined ${transcript}`,
          tags: ['home'],
        };
      }

      return {
        topic: 'Health',
        refinedText: `Refined ${transcript}`,
        tags: ['health'],
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

    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(1, 'ship the roadmap update', [], null);
    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(2, 'plan dinner groceries', [], null);
    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(3, 'book annual physical', [], null);
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

    expect(SynthesisService.synthesize).toHaveBeenCalledWith('Ship the roadmap update', [], null);
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
    });

    ProcessingQueueManager.addToQueue('Ship the roadmap update', 'voice');
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith('Ship the roadmap update', ['Work'], null);
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
    });

    ProcessingQueueManager.addToQueue('Ship the roadmap update', 'text', undefined, {
      selectedTopic: 'Work',
    });
    await jest.runOnlyPendingTimersAsync();

    expect(SynthesisService.synthesize).toHaveBeenCalledWith('Ship the roadmap update', ['Work', 'Home'], 'Work');
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
});
