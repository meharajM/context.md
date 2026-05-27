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

    expect(ContextManager.appendThought).toHaveBeenCalledWith('Test', 'Refined', {
      sourceKind: 'text',
      sourceTranscript: 'Final test',
    });
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
    (SynthesisService.synthesize as jest.Mock)
      .mockImplementation(async transcript => ({
        topic: 'Test',
        refinedText: `Refined ${transcript}`,
        tags: [],
      }));

    ProcessingQueueManager.addToQueue('First queued capture', 'text');
    ProcessingQueueManager.addToQueue('Second queued capture', 'voice');
    ProcessingQueueManager.addToQueue('Third queued capture', 'text');

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(1, 'First queued capture', []);
    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(2, 'Second queued capture', []);
    expect(SynthesisService.synthesize).toHaveBeenNthCalledWith(3, 'Third queued capture', []);
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(1, 'Test', 'Refined First queued capture', {
      sourceKind: 'text',
      sourceTranscript: 'First queued capture',
    });
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(2, 'Test', 'Refined Second queued capture', {
      sourceKind: 'voice',
      sourceTranscript: 'Second queued capture',
    });
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(3, 'Test', 'Refined Third queued capture', {
      sourceKind: 'text',
      sourceTranscript: 'Third queued capture',
    });
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
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Failure path', {
      sourceKind: 'text',
    });
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
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', 'Hanging synthesis path', {
      sourceKind: 'text',
    });
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
});
