import type { PendingThought } from '../../modules/SynthesisEngine/ProcessingQueueManager';
import type { QueueJobView } from './queueTypes';

export function selectQueueView(
  queueJobs: PendingThought[],
  currentThoughtId: string | null,
  isProcessing: boolean,
  clarificationThoughtId: string | null = null,
): QueueJobView[] {
  return queueJobs.map(job => {
    const isActive = job.id === currentThoughtId;
    const isClarification = job.id === clarificationThoughtId;
    const isActiveSlot = isActive || isClarification;

    let statusLabel = 'Queued';
    if (isClarification) {
      statusLabel = 'Needs your topic choice';
    } else if (isActive) {
      statusLabel = isProcessing ? 'Synthesizing...' : 'Pending...';
    }

    // Shorten preview text for title
    let title = job.transcript;
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    return {
      id: job.id,
      noteId: job.noteId,
      title: title,
      transcript: job.transcript,
      timestampLabel: formatQueueTime(job.timestamp),
      statusLabel: statusLabel,
      progress: null,
      kind: job.kind,
      selectedTopic: job.selectedTopic ?? null,
      clarification: job.clarification,
      canEnd: !isActive,
      canEdit: !isActive,
      isActiveSlot,
      ...(job.sourceContext?.sourceMetadata
        ? {
            sourceMetadata: {
              audioFilePath: job.sourceContext.sourceMetadata.audioFilePath ?? null,
            },
          }
        : {}),
    };
  });
}

function formatQueueTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Queued recently';
  }

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Queued ${time}`;
}
