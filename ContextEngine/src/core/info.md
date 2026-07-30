# `src/core` Architecture

`store.ts` is the central runtime coordinator. It uses Zustand and owns app state that crosses feature boundaries.

## Owned State

- Context sections loaded from `ContextManager`.
- Recording state and audio readiness.
- Queue state mirrored from `ProcessingQueueManager`.
- Clarification state for ambiguous topic routing, including the question and selectable topic options.
- Capture settings: manual, push-to-record, wake-word, LiteRT.
- LiteRT model catalog, selected model, install/download status.
- App lifecycle state used to stop or start foreground wake-word listeners.

## Runtime Orchestration

- Initializes model catalog and configures `SynthesisService`.
- Initializes `AudioEngineImpl`.
- Persists manual, Assistant, and successful voice captures to `Inbox` before adding them to the in-memory synthesis queue.
- Subscribes to queue events and reloads context after completion or fallback.
- Starts and stops recording after permission checks.
- Handles model download, selection, removal, and reconfiguration.
- Requeues existing `Inbox` entries for synthesis when the user requests it or after a model download finishes.
- Startup initializes synthesis eagerly and silently requeues existing `Inbox` entries.
- Import analysis passes persisted topic content into synthesis and enforces approval before any suggested existing-topic merge.
- Deletes confirmed unsynthesized Inbox notes, first canceling matching pending queue work and refusing deletion while the same note is actively processing.
- Deletes retained recordings only through the audio engine's app-owned retained-file guard; imported file paths are intentionally left untouched.

## Invariants

- Non-empty manual and Assistant text must be durable before it enters the processing queue.
- Empty transcripts should not enqueue.
- Recording failures must reset `isRecording` and move the explicit `recordingState` back to `idle` or `error` as appropriate.
- Wake-word should not run when the app is backgrounded.
- LiteRT failure should become `AI Offline`, `Model missing`, or raw fallback, not a dropped thought.
- Model download UI should stay in a download/progress state until installed-model refresh has confirmed the final model state.
- Requeued Inbox items should not be duplicated if synthesis falls back again.
- User-confirmed deletion must not allow a pending queue representation to recreate the removed Inbox note.
- Import merge approval must not depend on whether the suggestion came from LiteRT or fallback output.
- Topic routing should prefer the best existing topic based on persisted context; unresolved ambiguity must pause in the queue rather than silently write to the wrong topic.
