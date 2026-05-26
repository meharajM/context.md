import { selectQueueView } from '../queueSelectors';
import type { PendingThought } from '../../../modules/SynthesisEngine/ProcessingQueueManager';

describe('selectQueueView', () => {
  it('maps an empty queue to an empty view array', () => {
    const result = selectQueueView([], null, false);
    expect(result).toEqual([]);
  });

  it('correctly flags the active job as synthesizing', () => {
    const queue: PendingThought[] = [
      { id: '1', transcript: 'Thought 1', timestamp: '2026-05-26', attempts: 0 },
      { id: '2', transcript: 'Thought 2', timestamp: '2026-05-26', attempts: 0 },
    ];
    const result = selectQueueView(queue, '1', true);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: '1',
      title: 'Thought 1',
      statusLabel: 'Synthesizing...',
      progress: null,
      kind: 'text',
    });
    expect(result[1]).toEqual({
      id: '2',
      title: 'Thought 2',
      statusLabel: 'Queued',
      progress: null,
      kind: 'text',
    });
  });

  it('limits the title/preview length and maps retry attempts', () => {
    const longTranscript = 'This is an extremely long thought transcript that goes on and on and on and should be truncated in the queue view';
    const queue: PendingThought[] = [
      { id: '1', transcript: longTranscript, timestamp: '2026-05-26', attempts: 2 },
    ];
    const result = selectQueueView(queue, null, false);
    expect(result[0].title).toBe('This is an extremely long thought transcript that goes on...');
    expect(result[0].statusLabel).toBe('Retrying (Attempt 2)');
  });
});
