# ContextEngine App Behaviour Roadmap

## Current release scope — 2026-11-01

Both platforms support typed notes, pasted-text import, optional on-demand microphone capture, local English or Hindi / Hinglish Whisper transcription, on-device synthesis, topic filing, ambiguous-topic clarification, Inbox fallback/retry, editing, sharing, local search, backup/restore, and opt-in automatic reminders. English remains the default. Users can download the optional multilingual Hindi / Hinglish model and select it in Settings; transcription auto-detects Hindi-English code-switching and retries with Hindi when Whisper reports English or the automatic text has no recognized Hindi/Hinglish evidence. A retry replaces the automatic transcript only when it contains Devanagari or recognized common Romanized Hindi. Android has a no-launch home widget recorder/text input and an ongoing recording notification with Stop. iOS has in-app recording and an iOS 17+ widget that opens the app for Write or Record; the app target supports iOS 15.1+.

Recording starts only after an explicit user action. Android widget recording runs in a microphone foreground service without opening the main app; the launcher widget shows a live timer and Stop action, and the service notification also has Stop. iOS background audio keeps an app-started capture running while the app backgrounds; users return to the app to stop it. Its widget writes a pending capture request through the App Group and opens the app, where the shared capture flow handles it. Transcription runs locally on both platforms. Neither platform is an autonomous listener. Headset media-button/lock-screen triggers, audio-file import, wake words, assistant voice intents, and spoken summaries remain deferred.

The current gate is E2E coverage of capture, model-backed synthesis, topic persistence, reminders, and platform-specific quick capture, plus durable fallback/relaunch and an Android widget/recording service regression. Unit tests or an Inbox fallback do not prove model synthesis or speech recognition. iOS idle background synthesis and current physical-device QA remain open. Production signing, approved current-brand screenshots, and complete publisher/privacy/store metadata remain separate publication requirements.

The app checks device resources on first launch. Compatible Android devices may automatically download Gemma3-1B-IT when readiness and storage allow; users can continue writing without it. A below-baseline device may still choose to install the model; synthesis is attempted when current resources permit and may be slow, fail, or be stopped by the OS. Every typed note remains durable in Inbox. Temporary memory or thermal pressure holds queued synthesis until readiness recovers. The app rechecks on launch and foreground. Android also asks WorkManager to retry temporary resource blocks while the battery is healthy and storage is not low; the screen can remain on, and Android controls when or whether that work runs. iOS currently recovers through launch and foreground checks. Notes are recovered from Inbox after relaunch on both platforms.

This scope supersedes older voice-MVP and headset release gates below; historical validation remains historical evidence.

### Transcription language

- English stays selected by default. Android downloads the existing tiny.en model automatically; iOS continues to use its bundled tiny.en model.
- Settings offers Hindi / Hinglish after the user downloads the optional multilingual base Q5_1 model. The choice is saved across launches and uses Whisper language auto-detection with a prompt to preserve English words in mixed speech; an English detection or auto transcript without recognized Hindi/Hinglish evidence triggers a Hindi-primary retry, accepted when the result contains Devanagari or common Romanized Hindi words.
- The Hindi model is 57 MiB and stays in app-private storage. On Android, its verified-range download runs while Thought Notes stays open and resumes from completed ranges after a retry. It is separate from the automatic English model download.
- Changing language requires stopping the current recording first. Transcription and retained audio stay on device.


This file is a target-behavior roadmap, not a claim that all items are already implemented.

## Scope

- Platform scope: iOS and Android publication targets.
- Data model: local-only per-topic Markdown files under `Documents/topics`; existing installs with the former consolidated `Documents/context.md` migrate it before loading, preserving ambiguous coexistence content under a separate `Legacy <topic>` file.
- Safety invariant: every non-empty capture must persist, even when audio or synthesis fails.
- Roadmap status model:
  - `Implemented`: already in production behavior.
  - `Planned`: approved target behavior not fully implemented yet.

## Capture Flows

### 1) Manual text capture (`Implemented`)

Expected behavior:
- Save control and keyboard Done both submit a non-empty note through the same capture path.
- Non-empty note is queued immediately after its raw Inbox copy is durable.
- Queue runs synthesis when available.
- On synthesis success, note is appended under a topic thread and the destination is shown.
- On synthesis failure, raw note remains in `Inbox` and the UI explains that it was not categorized.
- Queue returns to idle and reflections refreshes.

### 2) Voice note capture (`Implemented on Android; future on iOS`)

Expected behavior:
- Recording state transitions: `starting` -> `recording` -> `stopping` -> `transcribing` -> `idle`.
- Non-empty transcript queues as `voice`.
- Empty transcript does not queue.
- The WAV stays in app-owned retained storage until its transcript is durably saved to Inbox. If Inbox save fails, preserve the WAV and save a recovery note before reporting the capture as retained.
- Start/stop/transcribe failures surface error state and clear busy state.

### 3) Edit/re-synthesize note (`Implemented`)

Expected behavior:
- Edit action exists for both queue items and persisted Inbox/thread items.
- Edit opens a dedicated edit screen.
- Saving edited note re-queues it for re-synthesis.
- Original source metadata is preserved deeply.
- Source metadata view is available in a modal to avoid UI clutter.

### 4) Topic linking shortcut (`Implemented`)

Expected behavior:
- User can optionally select a topic for note linking.
- Without topic selection:
  - synthesis pass 1 identifies topic,
  - synthesis pass 2 composes comprehensive context against topic content.
- With topic selection:
  - a single synthesis pass composes against selected topic content.

## Voice Readiness and Triggers

### 5) Voice gating indicators (`Implemented on Android`)

Expected behavior:
- If Whisper readiness is false, home UI shows readiness guidance.
- If `pushToRecordEnabled` is false, home UI shows indicator and link to enable in settings.
- Microphone denial shows access-needed guidance.
- Indicators are evaluated and shown on each app launch and on record-trigger attempts.

### 6) Headset media-button and lock-screen triggers (`Deferred from Android v1`)

The Android v1 release does not start recording from headset media buttons or while locked. `RELEASE_CAPABILITIES.headsetTrigger` and the native release gate keep those prototype triggers disabled. Users can start an explicit recording in the app or widget; that active recording may continue in the background under `ActiveRecordingService`. Android 13+ requests notification access once for the visible Stop action. If the user denies it, recording still works and an in-app Stop remains visible on every route. Re-enable media-button or lock-screen triggers only in a later release after accessory and OS routing are validated on compatible hardware.

## Assistant Intents

### 7) Siri/Google intents and shortcuts (`Planned — future deliverable`)

Expected behavior:
- No custom wake word is required for this path.
- User can invoke assistant intents like:
  - "Hey Siri/Google, add this to my context: {content}".
- Integration is intents/shortcuts based only.
- App provides setup/binding guidance in settings where platform requires user action.

## Synthesis Flows

### Device resource readiness (`Implemented`)

Expected behavior:
- First launch reports RAM, available memory, free storage, thermal state, and OS version when the platform can provide them.
- Devices below the selected model's total-RAM recommendation warn that inference may be slow or fail; users may still install the model. Temporary resource gates may defer work, and failed categorization leaves the original note in Inbox.
- Temporary low-memory or serious thermal conditions keep eligible synthesis work queued and resume it after an active resource recheck reports recovery.
- Model download is held when free storage is below the selected model size plus 512 MiB of setup headroom.
- Android background work is constrained by WorkManager; iOS uses opportunistic BGProcessingTask scheduling. Both may be deferred or stopped by the OS.

### Android background synthesis (`Implemented`)

- Temporary resource-blocked queue work is requested through unique WorkManager work that requires battery not low and storage not low; it can run while the screen is on and the app is minimized.
- The worker rechecks available RAM, low-memory state, and serious thermal pressure before starting the Headless JS queue runner. Total RAM informs the warning but does not permanently block the user's opted-in model.
- The worker waits for the headless queue task to finish; transient resource pressure or a timed-out task returns to WorkManager's retry path.
- Android widget Write and finalized Record captures feed the same durable background queue; retained voice recovery transcribes locally before synthesis, while Inbox remains authoritative until the topic copy is durable.
- Explicit widget captures use a separate expedited foreground WorkManager handoff. It imports text and attempts Whisper transcription without waiting behind the synthesis available-memory gate; LiteRT topic organization remains separately queued and resource-aware. Severe thermal pressure or Android's system low-memory signal can postpone Whisper, in which case WorkManager retries the capture after backoff.
- Keep Inbox as the source of truth so expiration, force-stop, reboot, or OS deferral cannot lose the note.
- The UI says Android queued a background retry only after WorkManager accepts it; it does not promise a completion time.
- If scheduling fails, the UI directs the user to reopen the app after resources recover. Startup still reconstructs work from Inbox.

### Android background model downloads (`Implemented`)

- Android writing-model and Whisper downloads are continued by unique WorkManager jobs with a connected network and storage-not-low constraints.
- Downloads use a visible foreground notification and the existing resumable, checksum-verified downloader. Completed byte ranges survive a retry.
- This background path remains for the automatic English model. The optional Hindi / Hinglish model is downloaded from Settings in the foreground and requires the app to stay open; its completed ranges remain resumable.
- Android may still defer or stop a job because of OS scheduling, force-stop, or device policy. iOS keeps its existing RNFS background-session download behavior.

### iOS idle synthesis (`Implemented`)

- BGProcessingTask launches the shared queue runner when iOS grants idle runtime; app lifecycle and task completion bridge through the native event emitter.
- Keep Inbox as the source of truth and fall back to launch/foreground recovery when iOS defers or expires the task. No completion time is promised.

### 8) LiteRT synthesis available (`Implemented`)

Expected behavior:
- Queue attempts LiteRT synthesis with candidate topics.
- Candidate topics are compared against their persisted topic content, not just their names or list order.
- The selected topic receives the full original capture and, when generated successfully, a separate short AI summary. Bounded multi-part processing can take time.
- Source metadata is retained (`Source kind`, optional `Source transcript`, optional generated summary). Editing the original clears a stale summary.

### 8a) Ambiguous topic routing (`Implemented`)

Expected behavior:
- If the model cannot confidently distinguish between plausible topics, it does not guess or create a generic topic.
- The thought remains in the processing queue and keeps its raw Inbox source intact.
- The queue asks one focused clarification question and shows 2–3 topic options.
- Selecting an option resumes synthesis under that topic and removes the raw source only after categorized persistence succeeds.

### 9) LiteRT synthesis unavailable or failing (`Implemented`)

Expected behavior:
- App degrades to raw fallback.
- Non-empty capture is appended to `Inbox`.
- Capture is never dropped.

### 10) Model download in progress (`Implemented`)

Expected behavior:
- Queue processing is blocked while the selected model is downloading or the device fails the model's resource-readiness check.
- UI shows stage-aware status (prepare/download/verify/install/finalize/installed).
- Download state remains visible until post-download refresh resolves installed state.

### 11) Model not installed (`Implemented`)

Implemented:
- Queue is not hard-blocked by missing model.
- Captures persist through fallback and can be re-synthesized later.
- Queue and persisted notes remain editable and can be re-queued.
- Voice failures retain audio with playback and delete controls when available.
- Persisted unsynthesized text and voice notes expose a dedicated delete action from the `Inbox` thread.
- Deletion always requires destructive confirmation and is refused while matching synthesis work is active.
- Deleting an unsynthesized note also cancels matching pending synthesis work so the note cannot reappear later.
- Only recordings generated inside `Documents/retained-audio` with Context Engine's retained filename contract can be deleted. Imported or unrelated files are never unlinked.
- Retained audio can be deleted independently after confirmation while leaving its Inbox note intact.

## Inbox Re-synthesis Flows

### 12) Manual Inbox re-synthesis (`Implemented`)

Expected behavior:
- Inbox entries queue for synthesis with source context references.
- `Inbox` is excluded from semantic topic candidates.
- On successful categorization, original Inbox entry is removed.
- On repeated fallback, entry is not duplicated.

### 13) Auto Inbox requeue (`Implemented`)

Expected behavior:
- Existing Inbox entries are silently re-queued during startup and after successful model download.
- Auto-queue does not spam user-facing status text.

## Automatic Reminders (Android)

Automatic reminders are off by default and controlled by one Settings switch. After the user enables them, newly saved notes are checked locally for a likely task, category, priority, and time. No reminder form or detail confirmation interrupts capture. The local model supplies the suggestion when available; simple local cues can schedule clear tasks if the model cannot run. Completed, past, and non-task notes do not create reminders. Existing notes from before enablement are not retroactively scheduled.

Reminder times use the captured note's local date. Clear same-day errands default to 7 PM; category, priority, and explicit time/deadline cues adjust the schedule. Android stores reminder metadata privately and posts ordinary notifications with Done and Snooze actions. Moving a note between topics does not duplicate its reminder; editing replaces a pending reminder, deleting it cancels one, and turning the switch off cancels pending reminders. Android's inexact alarm delivery may be delayed by the OS. Reminder analysis and scheduling do not block or alter note capture, transcription, topic filing, or sharing.

## Thread and Sharing Flows

### 14) Thread details rendering (`Implemented`)

Expected behavior:
- Thread shows source captures and available generated per-capture summaries. Full originals remain available in the topic and OS share/export.
- Voice/image/text labels map from capture metadata when present.

### 15) Share actions (`Implemented`)

Expected behavior:
- `Share Context` opens native share sheet with structured context payload.
- `Open with AI Agent` opens share sheet with AI-oriented analysis prompt and context payload.

## Import and Merge Flows

Android text shared from another app may be organized automatically on-device when the model is ready. If processing cannot finish, the shared text remains recoverable. Manual pasted import retains its review and approval flow.

### 16) Import pasted text for synthesis (`Implemented`; audio import is `Planned`)

Expected behavior:
- Dedicated import screen supports:
  - paste text input,
  - upload voice note.
- Supported voice formats include `.m4a`, `.mp3`, `.wav`, `.aac`, `.ogg`, `.opus`.
- Imported content queues and synthesizes.
- If related topic exists, merge requires explicit user permission.
- If no related topic exists, create a new topic thread.
- Import screen provides optional searchable topic selector for direct append.

## Saved Note Search and Backup

- Home search matches saved note text, source transcripts, and topic names on device. A result opens its owning topic at the matching note, briefly marks that note, and keeps the original timeline order; an empty query leaves the topic list unchanged.
- Home hides search while the library is empty; it appears once saved topics exist, or remains visible for an active search query. The compact empty state points users to the composer, while the hero explains on-device sorting or durable fallback.
- A fresh install shows a one-time, swipeable three-step illustrated tutorial before Home: capture, on-device topic organization, and returning assistant research to related notes. Android's capture step explains adding the Record/Write Thought Notes widget. The guide is the visual focus; model progress stays compact beneath it. Back/Next remain available, while Skip and Start capturing unlock when the local Whisper transcription model is ready. A download/setup error offers retry. The composer and navigation remain usable. Completion is saved separately from device-readiness dismissal; existing installs with saved notes or a dismissed readiness notice skip it.
- While Android models prepare, Home shows approximate model size, progress when available, mobile-data disclosure, and reassurance that captures remain saved. The voice and writing models have separate progress states.
- Dismissing the first-run readiness card returns Home to the top so its capture introduction stays visible after the card is removed.
- Home status links to Waiting while queue work exists, to Inbox for a saved fallback when Inbox exists, and to the named topic after organization when that topic exists. A missing destination shows no link. The first-run readiness notice replaces the Home download prompt while visible.
- Settings exports all parsed notes to a versioned plain JSON file chosen through the operating system document picker. The archive preserves ids, timestamps, and source transcript metadata, excludes audio recordings and device-specific file paths, and is limited to 10 MB.
- Restore validates the complete archive before writing, adds notes without replacing current content, skips notes already present, and does not trigger synthesis. A picker cancellation changes nothing; a storage failure is shown and the same backup can be retried safely.
- The app does not upload backups. If the user chooses a cloud-backed file location, that file provider handles the selected file under its own terms.

## QA Regression Checklist

Run for each release candidate:
1. Manual text capture persists and exits queue cleanly.
2. Voice start/stop/transcribe state machine does not stall; overlapping jobs are serialized, and Hindi / Hinglish retries with Hindi when auto-detection returns English or the automatic text has no recognized Hindi/Hinglish evidence, accepting Devanagari or common Romanized Hindi and keeping the auto result when the retry has no Hindi evidence.
3. Voice fallback to Inbox works when LiteRT/model unavailable.
4. Download status stages and final installed state remain consistent.
5. Inbox re-synthesis removes successful entries and avoids duplicate fallback entries.
6. Share actions open native share sheet with expected payload content.
7. Relaunch behavior preserves context integrity and auto Inbox requeue behavior.
8. Error indicators appear in composer, queue rows, and thread capture rows for empty/failing voice outcomes.
9. Siri/Google intent shortcut ingestion persists content correctly.
10. Ambiguous topic routing holds the item, presents options, and resumes into the selected topic without duplicating the Inbox source.
11. Search finds note text, transcript, and topic matches; opening a result reaches the existing topic thread.
12. Valid backup restore adds missing notes and skips repeats; malformed/oversized archives leave the existing library unchanged.

Validated roadmap additions:
1. Edit/re-synthesis works for queue and persisted items with metadata preserved.
2. Topic selection path executes one-pass synthesis against selected topic content.
3. Headset trigger event routing works for start/stop and respects readiness checks; lock-screen arming is now code-backed on both platforms, but physical-device validation remains pending.
4. Import flow supports text and all listed voice formats with permissioned merge behavior.
5. Unsynthesized Inbox text/voice deletion requires confirmation, cancels pending work, and restricts audio unlinking to app-owned retained recordings.

## Known Operational Limits

- Physical-device and simulator validation depend on healthy CoreSimulator/CoreDevice host services.
- Final release validation requires owner credentials and physical-device runs; simulator and automated checks do not replace store review or hardware QA.
