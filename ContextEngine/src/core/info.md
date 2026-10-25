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
- Device memory, thermal, storage, OS readiness, and first-run notice state.

## Runtime Orchestration

- Initializes model catalog and configures `SynthesisService`.
- Initializes `AudioEngineImpl`.
- Persists manual, Assistant, and successful voice captures to `Inbox` before adding them to the in-memory synthesis queue.
- Reports successful topic filing separately from raw Inbox fallback, including the destination topic on success.
- Subscribes to queue events and reloads context after completion or fallback.
- Starts recording after microphone permission and, on Android 13+, requests notification access once for the visible foreground-service Stop action. A declined choice is remembered and does not block capture; in-app Stop remains available on every route.
- Keeps Android headset button and lock-screen capture disabled in v1; iOS headset and microphone capture remain disabled.
- Handles model download, selection, removal, and reconfiguration.
- Model downloads start only from explicit first-run, Home, or Settings actions. Startup still assesses readiness and initializes installed models.
- Requeues existing `Inbox` entries for synthesis when the user requests it or after a model download finishes.
- Startup initializes synthesis eagerly and silently requeues existing `Inbox` entries.
- Every non-empty note is saved in Inbox first. Model RAM minimums are performance guidance: after the user installs a below-minimum model, inference is attempted when current available memory and thermal state permit, with warnings that it may be slow or fail. Temporary pressure holds eligible queue work until resources recover.
- Model downloads are preflighted for model size plus 512 MiB of free storage. The home readiness notice shows the recommended 1 GiB setup headroom and current free storage.
- Android temporary resource blocks request unique WorkManager execution under idle, battery-not-low, and storage-not-low constraints. The worker waits for the Headless JS runner and retries transient pressure. Inbox recovery remains authoritative because the OS can defer or stop the job.
- When Android enters the background, the store first rehydrates eligible Inbox notes into the queue and schedules the existing unique WorkManager job only if pending durable work remains. `ProcessingQueueManager.addToQueue` deduplicates active/pending durable source IDs and remembers the last 512 successful source IDs with their transcript, closing the persist-to-enqueue race while allowing edited text to be synthesized. Fallback and blocked work remain retryable. A completion revision prevents a late scheduler response from replacing a newer completion status, and duplicate callers preserve the current status. The app reports whether Android accepted the retry request, without giving an ETA.
- The Android headless runner scans durable Inbox voice-recovery notes before synthesis. `retryRetainedInboxAudio` initializes Whisper only when generated app-owned retained WAV candidates exist, then calls the existing same-note retry action for at most one recording per task. A timestamp checkpoint under `Documents/setup/retained-audio-attempts` is written before decoding; subsequent tasks skip that recording for one hour, even after failure or process death. Explicit UI retry bypasses this background cooldown. Other eligible recordings request continuation work; cooldown expiry alone does not schedule work. Current resource pressure defers decoding; low total RAM can still recover speech without starting synthesis. Empty/error output keeps the original Inbox note and WAV, with no immediate transcription retry loop.
- `retranscribeRetainedAudioFromNote` defaults to queueing successful speech after durable transcript persistence and confirmed audio cleanup. Its `queueSynthesis: false` option leaves the recovered transcript in the same Inbox note for later synthesis.
- iOS has no BGProcessingTask integration; resource-blocked notes resume through launch/foreground checks there.
- Import analysis passes persisted topic content into synthesis and enforces approval before any suggested existing-topic merge.
- Deletes confirmed unsynthesized Inbox notes, first canceling matching pending queue work and refusing deletion while the same note is actively processing.
- Deletes retained recordings only through the audio engine's app-owned retained-file guard; imported file paths are intentionally left untouched.

## Invariants

- Non-empty manual and Assistant text must be durable before it enters the processing queue.
- Background scheduling reads the durable Inbox before enqueueing work and never passes note text through WorkManager data.
- Empty transcripts should not enqueue.
- Recording failures must reset `isRecording` and move the explicit `recordingState` back to `idle` or `error` as appropriate.
- Wake-word should not run when the app is backgrounded.
- Lock-screen headset capture is opt-in, requires Push to Record plus microphone permission, and must be torn down cleanly when Push to Record turns off.
- LiteRT failure should become `AI Offline`, `Model missing`, or raw fallback, not a dropped thought.
- Model download UI should stay in a download/progress state until installed-model refresh has confirmed the final model state. A below-minimum install may initialize synthesis and queue Inbox work when temporary resources permit.
- Requeued Inbox items should not be duplicated if synthesis falls back again.
- User-confirmed deletion must not allow a pending queue representation to recreate the removed Inbox note.
- Import merge approval must not depend on whether the suggestion came from LiteRT or fallback output.
- Topic routing should prefer the best existing topic based on persisted context; unresolved ambiguity must pause in the queue rather than silently write to the wrong topic.

## Android v1 release scope (2026-10-18)

`releaseCapabilities.ts` enables on-demand capture on Android only; headset button triggers remain deferred for v1. Audio import, assistant capture, wake word, and all iOS voice capture remain disabled. Android initializes Whisper only when needed for recording; typed capture and pasted-text imports remain available on both platforms and persist raw Inbox sources before queue insertion. Failed durable writes never enter the in-memory queue. Native permissions/services and UI must match the platform gates.

Widget text replies are durable in the native private outbox first. Foreground lifecycle imports them with `drainQuickTextOutbox`, reloads context, and queues only after durable Inbox persistence. Failed drain retains the native copy for a later attempt.
