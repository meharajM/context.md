# Android Host Code Architecture

This package contains the React Native Android host classes.

## Files

- `MainActivity.kt`: Android activity entrypoint for the React Native app.
- `ActiveRecordingService.kt`: microphone-typed foreground notification for a recording already started by the user; its Stop PendingIntent opens the app and waits for JS to stop/finalize the active PCM capture.
- `MainApplication.kt`: React Native application setup and package registration.
- `EventEmitter.kt`: React Native event/guidance bridge and lifecycle owner for the headset MediaSession, widget requests, and lock-screen service state.
- `EventEmitter` waits for foreground startup before resolving JS start, queues notification Stop until its JS listener registers, and resolves service-stop requests only after `onDestroy` removes the foreground notification (or Android reports no service running).
- `HeadsetMediaButtonController.kt`, `HeadsetMediaButtonReceiver.kt`: foreground Activity keys, MediaSession transport callbacks, and the manifest media-button receiver route headset controls into `VoiceCaptureRequested`.
- `AudioInputRouter.kt`: selects wired or Bluetooth headset input during capture, waits for legacy SCO connection, and restores the previous route afterward.
- `AudioInputRouter.startModernRoute()` uses Android 12/API 31 communication-device APIs and is called only from the matching SDK-guarded branch; Android 11/API 30 and earlier use the legacy SCO path.
- `QuickCaptureWidgetProvider.kt`, `QuickCaptureWidgetActionReceiver.kt`: responsive home-screen actions and live recording/saved/error states. Record starts/stops the native widget microphone service without opening `MainActivity`.
- `WidgetVoiceCaptureService.kt`: user-started microphone foreground service that writes private 16 kHz mono PCM WAV, exposes a visible Stop action, and commits the normal retained-audio recovery descriptor before queuing existing local processing.
- `QuickCaptureActivity.kt`: small floating Write editor and first-use microphone permission surface; neither action opens the main React Native screen.
- `HeadsetTriplePressGate.kt`: pure timing gate for the 1.2-second raw-tap window and 1.5-second duplicate-command debounce; uses Android uptime to match `KeyEvent.eventTime`.
- `VoiceFilePickerModule.kt`: native document picker bridge for voice imports and JSON backup read/write via Storage Access Framework URIs.
- `ContextEnginePackage.kt`: package registration for the app's native modules.
- `LiteRtModule.kt`: typed LiteRT-LM `0.14.0` bridge for model loading, streamed synthesis, readiness snapshots, and release.
- `BackgroundSynthesisWorker.kt`, `BackgroundSynthesisTaskSession.kt`, `BackgroundSynthesisModule.kt`: constrained WorkManager dispatch, memory/thermal recheck, and completion-tracked Headless JS queue processing.

## Role

These files host the JavaScript bundle. Business logic, queueing, context persistence, and synthesis selection live in TypeScript under `src`.

Temporary Android resource blocks are scheduled by `BackgroundSynthesisWorker`; WorkManager constrains battery and storage, while the worker checks that the screen is off plus memory/thermal readiness before starting the registered Headless JS task through `ReactHost` and `HeadlessJsTaskContext`. Keeping screen-idle gating in the worker lets WorkManager apply retry backoff when resources are still low. `BackgroundSynthesisTaskSession` uses the task's explicit JS result as the authoritative worker signal and gives the matching task-finished callback a short cleanup grace period. No Android service start is required.

The LiteRT bridge preserves optional clarification question and topic-option fields from model JSON; the TypeScript queue owns the hold/resume decision and persistence ordering.
Malformed clarification flags or clarification data without a flag return raw fallback instead of selecting a topic silently.

The native system instruction stays below 96 UTF-8 bytes so the shared bounded-prompt planner can reserve its context space. Per-call task instructions belong in the TypeScript prompt; do not expand the native prefix without updating that budget.

Native response parsing requires nonempty string topic/refinedText fields and a string-array tags field. Incomplete output is explicitly marked raw-fallback so an echoed original cannot be mistaken for an AI-generated summary.

LiteRT native operations hold one coroutine mutex through inference suspension, so load/release cannot race an active conversation. Model loading uses typed `Backend`, `EngineConfig`, and `SamplerConfig` APIs; sampling uses the requested topK/topP/temperature independently of the context token budget. Each synthesis uses a fresh conversation, collects async response chunks with a 60-second timeout, cancels native inference on failure/cancellation, and closes the conversation before releasing a failed engine. React Native invalidation cancels active work and performs cleanup under the same mutex. Recoverable exceptions and JNI linkage errors reject bridge calls instead of escaping the background coroutine. `LiteRtResponseTest` covers streamed JSON assembly, timeout cleanup ordering, cancellation, native-library errors, and cleanup failures.

`AudioInputRouter` prefers wired/Bluetooth microphone input during an in-app recording and restores the prior route on stop. Headset button triggers, MediaSession key handling, and lock-screen capture are disabled in v1 while their device routing is unverified. There is intentionally no silent playback or fake media-state workaround.

## Android v1 scope

`VOICE_INTEGRATIONS_RELEASED` keeps in-app audio routing and speech guidance available. `HEADSET_TRIGGER_RELEASED` and `LOCK_SCREEN_CAPTURE_RELEASED` remain false, and audio import, wake word, and assistant capture stay gated. `ActiveRecordingService` continues to support the in-app JavaScript PCM stream. `WidgetVoiceCaptureService` owns only explicit widget-started PCM capture and writes the same retained-audio format used by normal crash recovery.

`QuickTextCaptureReceiver.kt` retains its notification RemoteInput path. The widget's Write action now opens `QuickCaptureActivity`, which saves text to `QuickTextOutbox.kt` using one app-private AtomicFile per UUID before WorkManager enqueue. The existing BackgroundSynthesisModule exposes read/ack calls; acknowledgement follows durable JS Inbox persistence. Notifications hide text on the lock screen.

Android text shares are written to the native outbox before the incoming Intent is cleared. If persistence fails, the Intent remains available for retry and the user sees a brief message.

Outbox records retain capture timestamps; native reads sort by capture time and Inbox import preserves that timestamp. UUID filename order never determines reply order.

Quick-text outbox reads isolate parse/read failures per AtomicFile; malformed records remain untouched while valid captures drain. Reply PendingIntents carry unique capture URIs. Notification prompt/result updates share a synchronized latest-capture guard and verify system notification identity, so delayed completion cannot replace a newer reply editor. Stale success is suppressed; stale save failure uses its capture UUID as a separate notification tag to retain the original unsaved text.

Outbox timestamp validation matches JavaScript Date bounds per record; invalid records log and remain on disk without blocking later valid captures.
