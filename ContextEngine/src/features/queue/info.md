# `src/features/queue` Architecture

The queue feature visualizes `ProcessingQueueManager` state mirrored into the store.

## Files

- `QueueScreen.tsx`: screen composition.
- `QueueList.tsx`: list layout for pending/current jobs.
- `QueueJobCard.tsx`: single job presentation.
- `queueSelectors.ts`: converts pending jobs and active job id into UI rows.
- `queueTypes.ts`: queue view types.

## Runtime Meaning

- A queued job represents text accepted for processing, not necessarily persisted yet.
- `currentThoughtId` marks the item being synthesized or persisted.
- Completion or fallback triggers a context reload through the store queue subscriber.
- Queue edits can carry an optional selected topic so synthesis can bypass auto-topic identification.
- Ambiguous synthesis results remain queued with a focused question and 2–3 topic options. The queue screen exposes those options; selecting one resumes synthesis under that topic.
