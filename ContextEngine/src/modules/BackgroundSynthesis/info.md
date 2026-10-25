# `src/modules/BackgroundSynthesis` Architecture

This module bridges Android WorkManager scheduling with the app's durable Inbox and synthesis queue.

## Contract

- `scheduleQueuedSynthesis()` asks the Android native module to enqueue unique constrained work; on iOS and when native scheduling fails, it returns `false` so the store keeps foreground recovery messaging.
- Android app-background transitions first rehydrate the persisted Inbox through the store. Work is scheduled only while an eligible queue item remains; no note text is passed to WorkManager. The queue UI distinguishes an accepted retry request from a failed scheduling request and does not promise timing.
- `runBackgroundSynthesisTask()` restores the canonical topic path, reloads Inbox, and reassesses device readiness. When current resources are healthy, it first retries app-owned retained Inbox recordings through the store, initializing Whisper only if recoverable candidates exist. At most one recording is attempted per task. Durable per-recording timestamps suppress another background attempt for one hour, so empty/failed speech or process death cannot repeatedly block remaining recordings. A continuation is requested only for other eligible audio, including below the synthesis RAM baseline; explicit user retry bypasses the cooldown. No timer wakes work merely because the cooldown expires. Below the synthesis model RAM baseline, successful recovery updates the same Inbox note without starting synthesis.
- After retained-audio recovery, the task initializes synthesis without eagerly initializing audio and queues eligible Inbox notes. Successful recovered transcripts queue only after durable transcript persistence and confirmed recording cleanup; failed cleanup keeps the Inbox/audio recovery path.
- The task waits for the synthesis queue to settle using the remainder of a 7.5-minute budget measured from task entry, including recovery time. A single Whisper decode has no cancellable timeout here and can still exceed the native task window; its checkpoint and original recording remain durable. Temporary resource blocks or queue timeout request another unique work item; notes remain in Inbox across process death.
- Android's WorkManager worker requires battery and storage to be suitable, then checks that the screen is off plus memory and thermal state before starting React Native and the registered Headless JS task. Keeping idle gating in the worker allows retry backoff when resources are still low. JS reports whether a replacement job was accepted or the current work needs retry; an unreported result or headless timeout retries.
- Foreground and Headless JS share the in-process queue manager, which serializes queue processing, deduplicates durable source IDs against active/pending work, and remembers a bounded set of successful IDs with their transcript. This also covers a foreground caller resuming after background synthesis has already completed; changed transcript text remains eligible for synthesis. If Android kills the process, the next worker or app launch rebuilds the queue from Inbox.
- Android controls scheduling time and can defer, stop, or cancel background work. The user-facing status never promises a completion time.
- This module does not implement iOS BGProcessingTask scheduling; iOS retries on launch and foreground.

## Validation

- Jest covers platform gating, scheduling fallback, Inbox rehydration, low-resource retry, and local-engine initialization without audio.
- Store tests cover scheduling a durable note after temporary Android resource pressure.
- Kotlin unit tests cover the readiness policy. Simulator E2E exercises typed persistence and Inbox recovery; the current emulator is below the model RAM baseline, so real inference is not established by that device.

## Widget text outbox

Android Write widgets post a private notification with a RemoteInput action when notification permission and the channel are enabled. Otherwise they retain the direct Activity composer PendingIntent. MainActivity refreshes widget intents on resume so permission changes are reflected. A late permission change uses an explicit user-initiated Activity PendingIntent fallback. Record remains the existing Activity action.

`QuickTextCaptureReceiver` writes each non-empty reply to an app-private AtomicFile outbox with a stable UUID note identity before scheduling this worker. Confirmation notification errors cannot turn an already durable save into a failure. `quickTextCapture.ts` drains the outbox before headless readiness gates, at bootstrap, and on foreground return. It writes Inbox before acknowledgement and checks every topic for the identity so interrupted acknowledgements cannot recreate a filed note. Concurrent JS callers share one drain. Native outbox files survive deferred/failed work; malformed or failed writes are never acknowledged. No microphone service or synthesis model is needed to save text.

Outbox records retain capture timestamps; native reads sort by capture time and Inbox import preserves that timestamp. UUID filename order never determines reply order.
