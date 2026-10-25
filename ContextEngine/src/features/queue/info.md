# `src/features/queue` Architecture

The queue feature visualizes `ProcessingQueueManager` state mirrored into the store.

## Files

- `QueueScreen.tsx`: screen composition.
- `QueueList.tsx`: list layout for pending/current jobs.
- `QueueJobCard.tsx`: single job presentation.
- `queueSelectors.ts`: converts pending jobs and active job id into UI rows.
- `queueTypes.ts`: queue view types.

## Runtime Meaning

- Every store-created job has a durable Inbox source before it enters the in-memory queue. The queue itself is not persisted; startup and Android backgrounding rebuild it from Inbox. `ProcessingQueueManager` deduplicates stable source IDs against active/pending items and a bounded recent-success cache for the same transcript, covering the gap between persistence and a caller's direct enqueue while still allowing edited text to be synthesized. Fallback and blocked work are not marked successful, so a later retry can proceed.
- `currentThoughtId` marks the item being synthesized or persisted.
- A pending card says `Waiting` unless synthesis is actively running. Android background status is shown separately and says whether WorkManager accepted a retry request; no completion time is promised.
- Completion or fallback triggers a context reload through the store queue subscriber.
- Queue completion reports the destination topic; raw fallback reports that the note remains in Inbox and why categorization could not proceed.
- Queue edits can carry an optional selected topic so synthesis can bypass auto-topic identification.
- Ambiguous synthesis results remain queued with a focused question and 2–3 topic options. The queue screen exposes those options; selecting one resumes synthesis under that topic.

Only the actual `currentThoughtId` job is protected from edit/remove. A blocked first pending note remains in Waiting with both actions. Clarification uses one dedicated Needs your input card with topic choices plus edit/remove, and is excluded from the Waiting list without promoting another pending job. Pending retries remain Waiting until processing starts.
