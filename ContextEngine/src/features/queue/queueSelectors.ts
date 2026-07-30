import type { PendingThought } from '../../modules/SynthesisEngine/ProcessingQueueManager';
import type { QueueJobView } from './queueTypes';

export function selectQueueView(
  queueJobs: PendingThought[],
  currentThoughtId: string | null,
  isProcessing: boolean,
  clarificationThoughtId: string | null = null,
): QueueJobView[] {
  return queueJobs.map((job, index) => {
    const isActive = job.id === currentThoughtId;
    const isClarification = job.id === clarificationThoughtId;
    const isNext = !currentThoughtId && !isProcessing && index === 0 && queueJobs.length > 0;
    const isActiveSlot = isActive || isNext || isClarification;
    const isRetrying = job.attempts > 0;
    
    let statusLabel = 'Queued';
    if (isClarification) {
      statusLabel = 'Needs your topic choice';
    } else if (isRetrying) {
      statusLabel = `Retrying (Attempt ${job.attempts})`;
    } else if (isActive) {
      statusLabel = isProcessing ? 'Synthesizing...' : 'Pending...';
    } else if (isNext) {
      statusLabel = 'Pending...';
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
      progress: isActive && isProcessing ? null : null, // Null indicates indeterminate progress bar
      kind: job.kind,
      selectedTopic: job.selectedTopic ?? null,
      clarification: job.clarification,
      canEnd: !isActiveSlot,
      canEdit: !isActiveSlot,
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
