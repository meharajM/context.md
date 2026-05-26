# `src/core` Architecture

`store.ts` is the central runtime coordinator. It uses Zustand and owns app state that crosses feature boundaries.

## Owned State

- Context sections loaded from `ContextManager`.
- Recording state and audio readiness.
- Queue state mirrored from `ProcessingQueueManager`.
- Capture settings: manual, push-to-record, wake-word, LiteRT.
- LiteRT model catalog, selected model, install/download status.
- App lifecycle state used to stop or start foreground wake-word listeners.

## Runtime Orchestration

- Initializes model catalog and configures `SynthesisService`.
- Initializes `AudioEngineImpl`.
- Subscribes to queue events and reloads context after completion or fallback.
- Starts and stops recording after permission checks.
- Handles model download, selection, removal, and reconfiguration.

## Invariants

- Non-empty text should enter the processing queue.
- Empty transcripts should not enqueue.
- Recording failures must reset `isRecording`.
- Wake-word should not run when the app is backgrounded.
- LiteRT failure should become `AI Offline`, `Model missing`, or raw fallback, not a dropped thought.
