import type { PendingThought } from '../../modules/SynthesisEngine/ProcessingQueueManager';
import type { QueueJobView } from './queueTypes';

export function selectQueueView(
  queueJobs: PendingThought[],
  currentThoughtId: string | null,
  isProcessing: boolean
): QueueJobView[] {
  return queueJobs.map((job) => {
    const isActive = job.id === currentThoughtId;
    const isRetrying = job.attempts > 0;
    
    let statusLabel = 'Queued';
    if (isActive) {
      statusLabel = isProcessing ? 'Synthesizing...' : 'Pending...';
    } else if (isRetrying) {
      statusLabel = `Retrying (Attempt ${job.attempts})`;
    }

    // Shorten preview text for title
    let title = job.transcript;
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    return {
      id: job.id,
      title: title,
      statusLabel: statusLabel,
      progress: isActive && isProcessing ? null : null, // Null indicates indeterminate progress bar
      kind: 'text', // Capture compose doesn't explicitly save 'voice' mode info yet, so text is a safe default
    };
  });
}
