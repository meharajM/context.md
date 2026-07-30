import { selectQueueView } from '../queueSelectors';
import type { PendingThought } from '../../../modules/SynthesisEngine/ProcessingQueueManager';

describe('selectQueueView', () => {
  it('maps an empty queue to an empty view array', () => {
    const result = selectQueueView([], null, false);
    expect(result).toEqual([]);
  });

  it('correctly flags the active job as synthesizing', () => {
    const queue: PendingThought[] = [
      { id: '1', noteId: 'note-1', transcript: 'Thought 1', timestamp: '2026-05-26', attempts: 0, kind: 'voice' },
      { id: '2', noteId: 'note-2', transcript: 'Thought 2', timestamp: '2026-05-26', attempts: 0, kind: 'text' },
    ];
    const result = selectQueueView(queue, '1', true);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: '1',
      noteId: 'note-1',
      title: 'Thought 1',
      transcript: 'Thought 1',
      timestampLabel: expect.stringContaining('Queued'),
      statusLabel: 'Synthesizing...',
      progress: null,
      kind: 'voice',
      selectedTopic: null,
      canEnd: false,
      canEdit: false,
      isActiveSlot: true,
    });
    expect(result[1]).toEqual({
      id: '2',
      noteId: 'note-2',
      title: 'Thought 2',
      transcript: 'Thought 2',
      timestampLabel: expect.stringContaining('Queued'),
      statusLabel: 'Queued',
      progress: null,
      kind: 'text',
      selectedTopic: null,
      canEnd: true,
      canEdit: true,
      isActiveSlot: false,
    });
  });

  it('marks the first queued item as the next active slot during cooldown gaps', () => {
    const queue: PendingThought[] = [
      { id: '1', noteId: 'note-1', transcript: 'Next thought', timestamp: '2026-05-26', attempts: 0, kind: 'text' },
      { id: '2', noteId: 'note-2', transcript: 'Later thought', timestamp: '2026-05-26', attempts: 0, kind: 'voice' },
    ];

    const result = selectQueueView(queue, null, false);

    expect(result[0]).toMatchObject({
      id: '1',
      statusLabel: 'Pending...',
      canEnd: false,
      isActiveSlot: true,
    });
    expect(result[1]).toMatchObject({
      id: '2',
      statusLabel: 'Queued',
      canEnd: true,
      isActiveSlot: false,
    });
  });

  it('limits the title/preview length and maps retry attempts', () => {
    const longTranscript = 'This is an extremely long thought transcript that goes on and on and on and should be truncated in the queue view';
    const queue: PendingThought[] = [
      { id: '1', noteId: 'note-1', transcript: longTranscript, timestamp: '2026-05-26', attempts: 2, kind: 'text' },
    ];
    const result = selectQueueView(queue, null, false);
    expect(result[0].title).toBe('This is an extremely long thought transcript that goes on...');
    expect(result[0].statusLabel).toBe('Retrying (Attempt 2)');
    expect(result[0].isActiveSlot).toBe(true);
  });

  it('marks a clarification item as active and exposes its options', () => {
    const result = selectQueueView(
      [{
        id: 'clarify-1',
        noteId: 'note-1',
        transcript: 'send the update',
        timestamp: new Date().toISOString(),
        attempts: 0,
        kind: 'text',
        clarification: {
          question: 'Which area is this update about?',
          options: [{ topic: 'Work' }, { topic: 'Projects' }],
        },
      }],
      null,
      false,
      'clarify-1',
    );

    expect(result[0]).toMatchObject({
      isActiveSlot: true,
      statusLabel: 'Needs your topic choice',
      clarification: {
        question: 'Which area is this update about?',
      },
    });
  });
});
