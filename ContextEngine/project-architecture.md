# Project Architecture

Compact current architecture and user-flow map. Read before changes; update with runtime, ownership, persistence, or release-scope changes.

## Release scope

Both platforms support typed notes, pasted-text import, on-device LiteRT synthesis, topic filing, clarification, Inbox fallback/retry, editing, sharing, search, backup/restore, opt-in local reminders, and source-implemented Meeting mode. Android supports its launcher Record/Write widget and a foreground microphone service with notification Stop; Android voice transcription continues to use Whisper because its LiteRT bridge has no audio-input API. iOS automatically selects Gemma 3n E2B for unified transcription and note organization when RAM and free storage meet the model requirements; lower-memory or storage-constrained iPhones use Gemma3-1B plus Whisper. iOS 17+ WidgetKit shortcuts open the app through a registered URL scheme for Write, Record, or Meeting; the app target supports iOS 15.1+.

The source tree also includes an optional FunctionGemma 270M research handoff. FunctionGemma plans one allow-listed request on-device; the user then chooses an app in the system share sheet, submits the task and thread context in ChatGPT, and shares the result back through Thought Notes' existing import flow. This does not launch, inspect, or control another app. The model artifact and cross-platform round trip have not been validated, and this source addition is not in the published release.

Meeting mode is implemented in the current source tree and included in Android production 1.0.8. It has physical Android coverage through a 63:11 Redmi 3S/API 30 background and lock-screen run. The foreground service and microphone indicator persisted; Stop finalized 189 timestamped entries through 62:43; five-minute WAV cleanup, four modular Sharesheet previews, long transcript sharing, and one stable Inbox note update passed. A current-source 1:11 physical mic run generated two suggested actions and an on-device summary automatically after Stop, with the summary visible about 30 seconds later. Summary generation has no meeting-specific resource preflight; if local inference fails or is unavailable, up to three deduplicated transcript sentences become clearly labeled transcript highlights, preserved with that label in sharing and saved notes. Missing summaries get one automatic foreground/readiness retry, recover after app shutdown, and retry timed-out calls at smaller transcript chunk sizes. The earlier 63-minute transcript attempt timed out in LiteRT inference on the Redmi; smaller-chunk retry has not been validated on an hour-long device run, so long-meeting completion/time and broad-device inference remain unverified. The longer sample used noisy room/TV audio with recognition errors; human-meeting accuracy and iOS QA remain open.

First launch checks RAM, available memory, free storage, thermal state, and OS version where native APIs expose them. Compatible Android devices may automatically download the selected writing model when readiness and storage allow; Home and Settings retain explicit download actions. Explicit user-started Android downloads on API 34+ use a JobScheduler user-initiated data-transfer job with a visible notification. Automatic downloads and downloads on older Android use WorkManager's `dataSync` foreground path. All Android downloads use verified byte ranges for interruption recovery; Android may still defer or stop work under system quotas. Users can continue writing without the model. Gemma3-1B-IT recommends 4 GiB total RAM and about 1 GiB available RAM; typed notes still persist to Inbox below that baseline. Temporary memory/thermal pressure holds queued synthesis, with readiness refreshed on launch and foreground. Model download preflight needs the selected model size plus 512 MiB free. Inbox startup requeue is the recovery contract. Android gives explicit widget captures a separate expedited foreground WorkManager handoff: it drains durable widget text and attempts local audio transcription before queueing topic organization, while synthesis keeps its own memory and thermal gate. WorkManager may defer or stop automatic work; capture transcription waits during severe thermal or system low-memory conditions. iOS keeps its RNFS background model-transfer session and schedules eligible synthesis through BGProcessingTask when iOS grants runtime; launch and foreground requeue remain the recovery path.

Recording starts only from an explicit user action. Android's service keeps active capture running in background and its notification Stop uses the existing store finalization path. Android widget audio and text are retained durably and sent through an expedited foreground import/transcription handoff, followed by background synthesis recovery. iOS background audio keeps an app-started capture running; users return to the app to stop, and its widget action opens the app. Neither platform starts unattended capture. Audio import, wake words, assistant voice intents, headset triggers, and spoken summaries remain gated off. Opportunistic iOS BGProcessingTask and Android WorkManager runs may be deferred or expired by the OS; Inbox plus launch/foreground recovery remain authoritative.

## Ownership and dependencies

`UI -> selectors/store actions -> core store -> services/modules -> native/filesystem`

- `App.tsx`: providers, shell, lifecycle; the headset hook returns immediately because its release capability is disabled.
- `src/app/AppBootstrap.ts`: sets canonical topic path and legacy migration path, loads context, eagerly initializes synthesis without Whisper or speech recognition.
- `src/app/AppShell.tsx`: local-state navigation, screen props, note editing, thread sharing, import approval.
- `src/core/store.ts`: capture durability, queue subscriptions, models/readiness/downloads, clarification, requeue, guarded deletion, release gates.
- `src/core/store.ts` also exposes user-initiated whole-library backup export and restore; selected file access stays behind the shared native document-picker utility.
- `src/modules/DeviceReadiness`: native RAM/thermal/OS and filesystem storage assessment, plus first-run notice persistence.
- Android `MainActivity` checks Google Play update availability on foreground, starts a flexible update after Play consent, and asks before restarting after download; a dismissed version is snoozed for seven days. Background auto-install remains controlled by Google Play settings.
- `src/features`: capture composer, reflections, queue, import, settings, meeting screen, thread details, editor. Feature code uses store actions/selectors rather than native bridges.
- `src/modules/ContextManager`: topic Markdown parsing, serialized storage, stable note ids, legacy migration, append/update/removal.
- `src/modules/ContextManager`: versioned 10 MB JSON backups preserve note ids, timestamps, and transcript metadata, omit device audio paths, and restore additively without replacing local notes. Backup reads fail loudly if storage cannot be read; topic writes are serialized and repeatable after partial failure.
- `src/modules/SynthesisEngine`: LiteRT runtime policy, prompts/output normalization, queue, models/download verification.
- `src/modules/AudioEngine` owns shared on-demand recording. Android uses local Whisper transcription; iOS uses Gemma audio on capable devices and Whisper when the selected writing model is text-only, preserving the full recording for retry. Meeting mode reuses the same microphone engine and Android `ActiveRecordingService`. Android's `WidgetVoiceCaptureService` backs launcher-widget capture through durable WAV recovery and the existing WorkManager/Headless JS processing path. iOS uses microphone disclosure and background audio; its WidgetKit links open the shared JS Write, Record, and Meeting flows through the registered URL scheme. `AutomaticReminderModule` schedules local notifications on iOS; Android retains its alarm/boot-recovery scheduler. Media-button/lock-screen triggers and assistant intake remain gated.
- `src/shared`: UI/design, lifecycle hooks, note identity/metadata, share/path utilities.

## Routes

Primary: `reflections`, `queue`, `import`, `settings`.
Secondary: `meeting`, `threadDetails`, `noteEditor`; editor has metadata and topic-picker modals.
No separate navigation library; AppShell owns route state.

## Typed capture flow

On a fresh install, `AppShell` shows a one-time, swipeable three-step illustrated tutorial before Home: capture (with platform-specific widget guidance), on-device topic organization, and returning assistant research to related notes. Home and navigation remain usable underneath. Completion is persisted separately from the device-readiness notice, and existing installs with saved notes or a dismissed readiness notice skip the tutorial. Home itself stays focused on notes and capture.

1. Composer trims nonempty text submitted with the save control or keyboard Done key; store persists a stable raw note in Inbox.
2. Store queues that durable note with its source identity.
3. Queue reads existing topics and persisted contents, excluding Inbox as a semantic candidate.
4. SynthesisService uses bounded local LiteRT calls to identify a route across topic candidates and summarize captures. Long input may require multiple parts and take time.
5. Ambiguity keeps the source in Inbox and holds the queue with a question and 2–3 selectable topics.
6. Model-backed success appends the full original with its stable id and optional separate generated summary, then removes only the matching Inbox source.
7. Disabled/missing/failing/malformed/timed-out AI leaves untouched raw text in Inbox. Repeated fallback must not duplicate it.
8. Queue completion reloads context; startup and successful model installation can silently requeue Inbox.

Before inference, the store applies the selected model's total-RAM threshold and current memory/thermal check. Temporary blocks resume after readiness recovery. Queue state itself is in memory, while each accepted source remains in Inbox for launch-time recovery. On Android, a temporary resource block also requests constrained WorkManager execution through a Headless JS queue runner. The system can defer or stop this work; Inbox remains authoritative. On iOS, eligible synthesis is also requested through BGProcessingTask; the OS can defer or expire it, so launch/foreground recovery remains authoritative.

## Persistence contract

Canonical storage: `${RNFS.DocumentDirectoryPath}/topics/*.md`; one `# Topic` file with timestamped entries and metadata per topic. Former `Documents/context.md` is migration input; divergent same-name content is preserved under `Legacy <topic>` before removing the old source.

Every public storage read/mutation shares one serialized operation chain so captures and source cleanup cannot overwrite each other. A failed operation does not poison later saves. Re-appending a stable note id to the same topic is idempotent for interrupted cleanup retries.

Writes use temp file plus move when available, with direct-write fallback. This is process-level serialization, not a cross-process database transaction. Do not imply a stronger power-loss guarantee.

Inbox deletion requires UI confirmation, cancels matching pending work, and refuses deletion while that note is processing. Existing retained audio can only be deleted under the app-owned retained-path contract; imported/arbitrary paths are never unlinked.

Meeting sessions use revisioned JSON files under `${RNFS.DocumentDirectoryPath}/meetings`, separate from the library backup. Meeting audio remains in app-owned retained storage until the configured interval after both recording stops and the complete transcript is saved; failed transcription keeps the WAV. Expired audio deletion is best-effort while the app can run and retries on the next foreground.

## Meeting mode (source implementation; release QA pending)

Meeting action extraction is independent of reminder scheduling: recognized commitments and explicit “Action item” lines remain reviewable even when a weekday deadline cannot be converted to a reminder date. Negated and completed phrases are excluded; suggested actions never schedule reminders.

The Home button and Android/iOS Meeting widgets open a dedicated screen; recording still requires an explicit Start tap. Recording can continue in the background through the existing iOS audio mode and Android microphone foreground service. The screen shows a live indicator and appends timestamped transcript chunks from local transcription: Android Whisper or the selected iOS voice path (Gemma 3n on capable devices, Whisper on lower-resource devices), each on 20-second segments. The core store pauses queued note synthesis from meeting start through transcript and summary completion, then restores the current model/resource gate. An already-running synthesis is allowed to finish before a chunk is transcribed; microphone capture continues, so live text may trail. If the queue wait times out, full meeting audio stays available for transcription retry. Recovered meeting transcription uses the same queue pause and prevents starting another capture until it finishes. Startup failures return a meeting-specific message for retryable inline display. Stop waits for queued transcription and durable transcript writes, then automatically requests an on-device summary and heuristic action suggestions; no manual create step is shown. One missing summary retries on foreground or writing-helper readiness. If inference fails, transcript and heuristic actions remain saved. A current-source 1:11 Redmi 3S/API 30 test generated a summary and two actions automatically after Stop; the 63-minute transcript attempt timed out in LiteRT inference on this low-end phone. Actions remain local to the meeting and need a user decision. Meeting detail shares summary, timestamped transcript, and suggested action states separately, or combines all available sections; the assistant shortcut explicitly shares everything with an analysis prompt. Saving creates or updates one stable Inbox note containing the full available content; that library note is included in library JSON backup, while session records and recordings remain excluded. Speaker labels are out of scope for v1. Interrupted recordings can be retried from the meeting detail. The prior 63:11 background and lock-screen run completed with 189 timestamped segments through 62:43 and configured WAV cleanup; human-meeting accuracy and iOS coverage remain unverified.

## Search and library backup

Home search derives results from the hydrated topic sections and matches note text, original transcripts, and topic names on device; it stores no index or query history. Selecting a result passes its stable note id through AppShell to thread details, which scrolls to and briefly marks the matching capture without reordering the timeline. Home status links to existing Waiting, Inbox, or named-topic destinations, and the first-run readiness notice suppresses the separate Home download prompt while visible. Settings exports a versioned plain JSON file through the OS document picker and restores only after full schema/size validation. Restore keeps existing notes, skips matching ids/content, assigns a deterministic alternate id when the same id has different text, and never runs synthesis. The backup excludes retained audio file paths and recordings. If a multi-topic write fails, already written topics stay intact and retrying the same archive is safe.

## Synthesis/native boundaries

- `SynthesisService.ts`: runtime choice/readiness, selected vs automatic route, raw Inbox fallback.
- `ProcessingQueueManager.ts`: serial in-memory queue, bounded retries/timeouts, clarification state, source replacement.
- `runtimes/LiteRtSynthesisRuntime.ts`: isolated React Native bridge wrapper; bounded prompts consider capture chunks and candidate topic contents.
- `ios/ContextEngine/LiteRtModule.*`: serial native Swift LiteRT access; simulator inference is explicitly unavailable. Blocking iOS `sendMessage` uses a cooperative timeout because LiteRT conversation handles cannot receive overlapping cancellation calls. Physical iPhone inference requires separate evidence.
- Android `LiteRtModule.kt`: typed pinned LiteRT-LM 0.14.0 Kotlin API, serialized engine lifecycle, cancellable streaming synthesis and cleanup.
- `models.ts`/`modelManager.ts`: catalog, optional downloads, size/checksum verification, manifest and install status.

Native LiteRT must remain behind its runtime wrapper; UI must not depend on it directly. Queue work waits in Inbox until the selected model is installed, and the bundled LiteRT test fixture is not a runtime fallback or app resource. No network AI runtime is active. Model downloads are the only intended network requirement; model binaries stay outside Git.

After a verified model download, the store configures LiteRT and silently requeues durable Inbox notes. It does not load the large runtime just to confirm installation; queue work initializes LiteRT when processing starts. The iOS bridge creates the configured cache directory before initializing `EngineConfig`, so XNNPack can persist its CPU weight cache.

## Import, editing, sharing

Android shared text may be automatically organized on-device when the model is ready; pending text remains recoverable if processing cannot finish. Pasted text is previewed against topic context; suggestions to merge with an existing topic need explicit approval. An explicit selected topic is also supported. Audio import is gated out. Accepted imports persist a stable raw Inbox source before queue insertion, so an interrupted process can recover the transcript through startup Inbox requeue.

Editor preserves note identity and source metadata; changing note text clears a stale generated summary. Editing Inbox can requeue synthesis. Per-capture AI summaries are separate from full originals; topic details and OS share/export preserve original content. Sharing sends structured text or an AI-oriented prompt through the OS share sheet. Thread and meeting prompts request plain-text responses capped at 250 words with fixed headings; research also requests dated clickable sources. The optional research handoff uses that user-mediated sheet; there is no agent API integration or generic cross-app control.

## Validation and publication

Use `app-behaviour.md` as behaviour authority, `implementation/status.json` for current phase/evidence, and matching `implementation/phases.json` task spec. Historical docs never override current source or fresh test evidence.

Run focused tests, then typecheck, lint and Jest regression. Shared Detox tests cover text capture surfaces, persistence, imports, fallback/relaunch; live model test requires `CONTEXTENGINE_MODEL_PATH` and must genuinely file outside Inbox. Simulator fallback must never be reported as inference success. Physical Android app/widget voice capture and intelligible local transcription still require compatible hardware QA; headset media-button and lock-screen paths are deferred from v1.

Physical iPhone QA uses WDA and records XML/screenshots/JSON. Android emulator/hardware uses Detox and sandbox topic-file checks. The intended Android 1.0.3 (code 4) release is pending final verified build and review. Store publication also requires owner signing, complete public privacy/support metadata, approved current screenshots, and store-console validation.

## Android widget text capture

When notifications are enabled, Write posts a private system notification with an inline text reply. Disabled/denied notifications retain direct composer launch; Record retains its existing action. The private receiver writes a stable UUID capture into an app-private AtomicFile outbox before WorkManager scheduling. Headless JS imports it before resource/model checks, and bootstrap/foreground return also drain it. A native copy is acknowledged only after durable Inbox persistence or finding its identity in an existing topic, so interrupted acknowledgement cannot duplicate a filed note. System scheduling can defer Inbox import; the notification reports that text is saved on this device and when Inbox will update. No microphone or model is required for text storage.
