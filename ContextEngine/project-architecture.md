# Project Architecture

Compact current architecture and user-flow map. Read before changes; update with runtime, ownership, persistence, or release-scope changes.

## Release scope

The Android v1 candidate supports typed notes, pasted-text import, optional on-demand voice capture from the app or home-screen widget with local Whisper transcription, local LiteRT synthesis, topic filing, clarification, Inbox fallback/retry, editing, and sharing. iOS remains text-only.

First launch checks RAM, available memory, free storage, thermal state, and OS version where native APIs expose them. The first-run notice offers an optional download of the selected writing assistant and a way to continue without it; Home and Settings retain explicit download actions. No model download starts on launch. Gemma3-1B-IT recommends 4 GiB total RAM and about 1 GiB available RAM; typed notes still persist to Inbox below that baseline. Temporary memory/thermal pressure holds queued work, with readiness refreshed on launch and foreground. User-initiated model download preflight needs the selected model size plus 512 MiB free. Inbox startup requeue is the recovery contract. Android also schedules temporary resource-blocked work through WorkManager when the device is idle, battery is healthy, and storage is not low; the worker waits for the Headless JS queue to finish and retries transient resource blocks. iOS still retries when the app returns to the foreground and has no BGProcessingTask integration.

Android recording starts only from an explicit in-app or widget action. A connected wired/Bluetooth microphone may be used during that recording. A dedicated microphone foreground service keeps an active user-started capture eligible to continue when the app backgrounds; Android 13+ requests notification access for its visible Stop action, and denial does not block capture. The action enters the existing JS store stop/finalize path. The service never starts recording itself. Headset media-button triggers and lock-screen-triggered capture are disabled in v1 by `src/core/releaseCapabilities.ts` and the native release gate; iOS microphone capture, audio import, wake words, assistant voice intents, and spoken summaries remain unavailable.

## Ownership and dependencies

`UI -> selectors/store actions -> core store -> services/modules -> native/filesystem`

- `App.tsx`: providers, shell, lifecycle; the headset hook returns immediately because its release capability is disabled.
- `src/app/AppBootstrap.ts`: sets canonical topic path and legacy migration path, loads context, eagerly initializes synthesis without Whisper.
- `src/app/AppShell.tsx`: local-state navigation, screen props, note editing, thread sharing, import approval.
- `src/core/store.ts`: capture durability, queue subscriptions, models/readiness/downloads, clarification, requeue, guarded deletion, release gates.
- `src/core/store.ts` also exposes user-initiated whole-library backup export and restore; selected file access stays behind the shared native document-picker utility.
- `src/modules/DeviceReadiness`: native RAM/thermal/OS and filesystem storage assessment, plus first-run notice persistence.
- `src/features`: capture composer, reflections, queue, import, settings, thread details, editor. Feature code uses store actions/selectors rather than native bridges.
- `src/modules/ContextManager`: topic Markdown parsing, serialized storage, stable note ids, legacy migration, append/update/removal.
- `src/modules/ContextManager`: versioned 10 MB JSON backups preserve note ids, timestamps, and transcript metadata, omit device audio paths, and restore additively without replacing local notes. Backup reads fail loudly if storage cannot be read; topic writes are serialized and repeatable after partial failure.
- `src/modules/SynthesisEngine`: LiteRT runtime policy, prompts/output normalization, queue, models/download verification.
- `src/modules/AudioEngine`, `HeadsetTrigger`, and headset hooks/native code: Android app/widget on-demand capture; Android PCM stop waits for the native reader to exit, and JS drains serialized PCM writes before WAV finalization. `ActiveRecordingService` supplies the notification and foreground lifetime for explicit captures; the stop bridge waits for `onDestroy` to remove the notification after WAV finalization and before transcription. Media-button/lock-screen triggers and assistant intake remain gated.
- `src/shared`: UI/design, lifecycle hooks, note identity/metadata, share/path utilities.

## Routes

Primary: `reflections`, `queue`, `import`, `settings`.
Secondary: `threadDetails`, `noteEditor`; editor has metadata and topic-picker modals.
No separate navigation library; AppShell owns route state.

## Typed capture flow

1. Composer trims nonempty text submitted with the save control or keyboard Done key; store persists a stable raw note in Inbox.
2. Store queues that durable note with its source identity.
3. Queue reads existing topics and persisted contents, excluding Inbox as a semantic candidate.
4. SynthesisService uses the local LiteRT model to identify/refine a route. Selected-topic edits take one pass; automatic routing may take identification and refinement passes.
5. Ambiguity keeps the source in Inbox and holds the queue with a question and 2–3 selectable topics.
6. Model-backed success appends the categorized note using its stable id, then removes only the matching Inbox source.
7. Disabled/missing/failing/malformed/timed-out AI leaves untouched raw text in Inbox. Repeated fallback must not duplicate it.
8. Queue completion reloads context; startup and successful model installation can silently requeue Inbox.

Before inference, the store applies the selected model's total-RAM threshold and current memory/thermal check. Temporary blocks resume after readiness recovery. Queue state itself is in memory, while each accepted source remains in Inbox for launch-time recovery. On Android, a temporary resource block also requests constrained WorkManager execution through a Headless JS queue runner. The system can defer or stop this work; Inbox remains authoritative. iOS currently uses launch/foreground recovery only.

## Persistence contract

Canonical storage: `${RNFS.DocumentDirectoryPath}/topics/*.md`; one `# Topic` file with timestamped entries and metadata per topic. Former `Documents/context.md` is migration input; divergent same-name content is preserved under `Legacy <topic>` before removing the old source.

Every public storage read/mutation shares one serialized operation chain so captures and source cleanup cannot overwrite each other. A failed operation does not poison later saves. Re-appending a stable note id to the same topic is idempotent for interrupted cleanup retries.

Writes use temp file plus move when available, with direct-write fallback. This is process-level serialization, not a cross-process database transaction. Do not imply a stronger power-loss guarantee.

Inbox deletion requires UI confirmation, cancels matching pending work, and refuses deletion while that note is processing. Existing retained audio can only be deleted under the app-owned retained-path contract; imported/arbitrary paths are never unlinked.

## Search and library backup

Home search derives results from the hydrated topic sections and matches note text, original transcripts, and topic names on device; it stores no index or query history. Selecting a result passes its stable note id through AppShell to thread details, which scrolls to and briefly marks the matching capture without reordering the timeline. Home status links to existing Waiting, Inbox, or named-topic destinations, and the first-run readiness notice suppresses the separate Home download prompt while visible. Settings exports a versioned plain JSON file through the OS document picker and restores only after full schema/size validation. Restore keeps existing notes, skips matching ids/content, assigns a deterministic alternate id when the same id has different text, and never runs synthesis. The backup excludes retained audio file paths and recordings. If a multi-topic write fails, already written topics stay intact and retrying the same archive is safe.

## Synthesis/native boundaries

- `SynthesisService.ts`: runtime choice/readiness, selected vs automatic route, raw Inbox fallback.
- `ProcessingQueueManager.ts`: serial in-memory queue, bounded retries/timeouts, clarification state, source replacement.
- `runtimes/LiteRtSynthesisRuntime.ts`: isolated React Native bridge wrapper; prompts include transcript and candidate topic contents.
- `ios/ContextEngine/LiteRtModule.*`: serial native Swift LiteRT access; simulator inference is explicitly unavailable. Physical iPhone inference requires separate evidence.
- Android `LiteRtModule.kt`: typed pinned LiteRT-LM 0.14.0 Kotlin API, serialized engine lifecycle, cancellable streaming synthesis and cleanup.
- `models.ts`/`modelManager.ts`: catalog, optional downloads, size/checksum verification, manifest and install status.

Native LiteRT must remain behind its runtime wrapper; UI must not depend on it directly. No network AI runtime is active. Model downloads are the only intended network requirement; model binaries stay outside Git.

## Import, editing, sharing

Pasted text is previewed against topic context; suggestions to merge with an existing topic need explicit approval. An explicit selected topic is also supported. Audio import is gated out. Accepted imports persist a stable raw Inbox source before queue insertion, so an interrupted process can recover the transcript through startup Inbox requeue.

Editor preserves note identity and source metadata. Editing Inbox can requeue synthesis. Thread details show captures and a lightweight first-notes preview, not a generated conversation summary. Sharing sends structured text or an AI-oriented prompt through the OS share sheet; it is not an agent API integration.

## Validation and publication

Use `app-behaviour.md` as behaviour authority, `implementation/status.json` for current phase/evidence, and matching `implementation/phases.json` task spec. Historical docs never override current source or fresh test evidence.

Run focused tests, then typecheck, lint and Jest regression. Shared Detox tests cover text capture surfaces, persistence, imports, fallback/relaunch; live model test requires `CONTEXTENGINE_MODEL_PATH` and must genuinely file outside Inbox. Simulator fallback must never be reported as inference success. Physical Android app/widget voice capture and intelligible local transcription still require compatible hardware QA; headset media-button and lock-screen paths are deferred from v1.

Physical iPhone QA uses WDA and records XML/screenshots/JSON. Android emulator/hardware uses Detox and sandbox topic-file checks. Store publication also requires owner signing, complete public privacy/support metadata, approved current screenshots, and store-console validation.

## Android widget text capture

When notifications are enabled, Write posts a private system notification with an inline text reply. Disabled/denied notifications retain direct composer launch; Record retains its existing action. The private receiver writes a stable UUID capture into an app-private AtomicFile outbox before WorkManager scheduling. Headless JS imports it before resource/model checks, and bootstrap/foreground return also drain it. A native copy is acknowledged only after durable Inbox persistence or finding its identity in an existing topic, so interrupted acknowledgement cannot duplicate a filed note. System scheduling can defer Inbox import; the notification reports that text is saved on this device and when Inbox will update. No microphone or model is required for text storage.
