# ContextEngine App Behaviour Roadmap

## Current release scope — 2026-11-19

Android production version 1.0.8 (version code 9) is live on Google Play. It includes typed capture, app/widget voice capture, local English Whisper transcription, on-device LiteRT synthesis, Meeting mode, topic filing, clarification, Inbox fallback/retry, editing, sharing, search, backup/restore, and opt-in local reminders. iOS source dynamically chooses one of two local voice setups: capable iPhones with at least 8 GB RAM and enough free space automatically download Gemma 3n E2B for both transcription and note organization; lower-memory or storage-constrained iPhones automatically use Gemma3-1B plus Whisper. The prompts request verbatim English across regional accents, including Indian English. Physical iOS accuracy QA and publication remain open.

The current Android source adds a Google Play flexible in-app update check on foreground. Play requests the user's consent before downloading; after download, a separate confirmation restarts the app to install it. Declining or postponing suppresses that version's prompt for seven days. The published 1.0.8/code 9 build does not include this source change. Google Play's background auto-update setting remains under the user's Play Store/device controls.

Meeting mode is included in public Android 1.0.8. On the live listing, its two screenshots are currently positions 3 and 4, and the expanded description includes the feature details. A follow-up listing-only change with a Meeting-first description opening and screenshots in positions 1 and 2 is in Google Play review; the current public listing remains available meanwhile. Redmi 3S/API 30 physical QA completed a 63:11 background and lock-screen capture; Stop persisted 189 timestamped entries through 62:43, and the WAV was deleted at the five-minute post-transcript deadline. Separate Android Sharesheet previews passed for summary, transcript, action items, and all available content; a long transcript preview opened without selecting a recipient. Saving and updating the long transcript kept one Inbox note. Shorter physical runs generated suggested actions and an on-device summary automatically after Stop, with summary latency ranging from about 30 seconds to about three minutes. A 63-minute transcript inference timed out in LiteRT CPU inference on the Redmi, so long-meeting summary completion remains unverified. Noisy room/TV audio does not establish human-meeting accuracy or live latency. Capable-device long-meeting inference, recipient delivery, physical iOS, and other release gates remain open.

Recording starts only after an explicit user action. Android widget recording runs in a microphone foreground service without opening the main app; the launcher widget shows a live timer and Stop action, and the service notification also has Stop. iOS WidgetKit links open the app into the shared Write composer or start its user-initiated Record flow; Meeting opens the shared Meeting screen. iOS background audio keeps an app-started capture running while the app backgrounds; users return to the app to stop it. Transcription runs locally on both platforms. Neither platform is an autonomous listener. Headset media-button/lock-screen triggers, audio-file import, wake words, assistant voice intents, and spoken summaries remain deferred.

Android explicit user-started model downloads on API 34+ use a visible JobScheduler user-initiated data-transfer job; automatic downloads and older Android use a visible WorkManager dataSync path. Verified byte ranges support interruption recovery, but the OS may defer or stop either path. Widget captures use a separate expedited foreground handoff. Voice transcription may be postponed by severe thermal or system low-memory conditions, and LiteRT synthesis remains resource-gated.

Android 1.0.8/code 9 is public; a listing-only description and screenshot reorder are awaiting Google review. Phase-11 validation remains open. Redmi physical runs show capture, transcript persistence, and post-stop summary/action generation on short samples, but recognition had errors and 63-minute summary inference timed out. API 34+ UIDT runtime, Balanced-model completion/inference, high-spec physical behavior, enlarged-text accessibility, and iOS device E2E remain unverified. Unit tests or an Inbox fallback do not prove speech recognition or model-backed synthesis. `implementation/status.json` is the current evidence source.

The app checks device resources on first launch. Compatible Android devices may automatically download Gemma3-1B-IT when readiness and storage allow; users can continue writing without the model. A below-baseline device may still choose to install it; synthesis can be slow, fail, or be stopped by the OS. Every typed note remains durable in Inbox. Temporary memory or thermal pressure holds queued synthesis until readiness recovers. Android requests constrained WorkManager retries while battery and storage permit. iOS requests opportunistic BGProcessingTask execution and retains launch/foreground recovery. Neither platform promises a completion time.

This scope supersedes older voice-MVP and headset release gates below; historical validation remains historical evidence.

### Meeting mode (`Implemented in source; release QA pending`)

- Suggested-action rules recognize action verbs and explicit “Action item” lines independently of reminder date parsing, so weekday deadlines can remain reviewable without scheduling reminders. Negated and completed items are skipped; users still confirm or dismiss each suggestion.
- Home and Android/iOS Meeting widgets open Meeting mode; recording begins only after the user taps Start.
- If recording cannot start because a prerequisite such as microphone permission is missing, Meeting mode shows the specific error and keeps Start available for retry.
- Meeting Start stays disabled until transcription is ready: Android Whisper or the selected iOS voice engine (Gemma 3n on capable devices, Whisper on lower-resource devices); a setup message explains why.
- Capture is for in-person room meetings through the phone or connected headset microphone. Android shows a foreground-service recording notification; iOS uses the app's existing background audio mode and system microphone indicator.
- On-device transcription produces timestamped 20-second chunks during capture: Whisper on Android and on lower-resource iPhones, or Gemma 3n E2B on capable iPhones. Speaker labels are out of scope for v1.
- Queued note synthesis pauses while a meeting is recording, transcribing, summarizing, or retrying recovered audio, then resumes. If synthesis was already running, audio capture continues while a chunk waits for the model; live text can lag, and timeout preserves the full WAV for retry. A second meeting cannot start during recovery transcription.
- Stop waits for transcription and durable transcript persistence, then automatically attempts an on-device summary and heuristic suggested actions. No manual create action is required. If on-device inference is unavailable or fails, up to three deduplicated recognized transcript sentences are shown as clearly labeled transcript highlights; check them against the transcript because speech recognition can be wrong. A missing summary gets one automatic retry when the app returns to the foreground; enabling/downloading the writing helper also retries it. If the app closes during inference, the saved transcript resumes automatically on next foreground. Slow summary inference retries with smaller transcript chunks while preserving all source text. The user must keep or dismiss each suggested action; this does not schedule a reminder.
- Meeting detail offers separate OS share-sheet payloads for summary only, timestamped transcript only, suggested action items only, or all available meeting content. Unavailable sections stay disabled; action state remains visible. “Share everything with an assistant” asks for plain text capped at 250 words, with the same fixed headings and no repetition of source notes; dismissed suggestions remain dismissed, not commitments.
- “Save to notes” creates one stable Inbox note with the meeting content; after summary generation, “Update saved note” refreshes that same note rather than adding another. The note enters the normal library and backup flow. Meeting JSON and audio remain separate; audio is not copied into a note or shared with meeting text.
- Retained audio defaults to five minutes after both recording has stopped and the complete transcript has been saved. Other choices are one hour, one day, or Keep. Failed transcription preserves the audio. Expired deletion runs when the app can run or on the next open.
- Meetings and audio are local and are not part of library JSON backups. Interrupted meeting audio can be retried from the meeting detail.
- Meeting duration and transcript timestamps display `HH:MM:SS` once a session reaches one hour; shorter times remain `MM:SS`.
- Redmi 3S/API 30 current-source run lasted 10:50 with the app backgrounded for most of capture. The Android foreground service, mic privacy indicator, and persistent recording notification remained active. Live timestamped text appeared during the run; finalization saved 52 entries through 10:44. Recognition included errors and ambient room/TV audio. A later 1:11 physical microphone run captured a laptop-spoken QA phrase live, then generated its summary and two suggested actions automatically after Stop; the summary appeared about 30 seconds later without a manual trigger. A 63-minute transcript attempt previously timed out during LiteRT inference; bounded chunk retries now split timed-out calls further, but this fix has not yet had a new hour-long physical run. The share-sheet preview was verified for summary only, transcript only, action items only, and all available content; no recipient was selected. High-quality transcription, recipient delivery, and iOS device QA remain open.


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

### 2) Voice note capture (`Implemented on both platforms; entry points differ`)

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
- If transcription readiness is false, home UI shows readiness guidance. Android checks Whisper; iOS checks Gemma 3n on capable devices or Whisper when the lightweight split is selected.
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

- Explicit user-started Android writing-model and Whisper downloads on API 34+ use JobScheduler user-initiated data-transfer jobs with a visible notification.
- Automatic Android downloads and API 33-and-lower downloads use unique WorkManager jobs with network and storage constraints plus a visible dataSync foreground notification.
- Both Android paths use the same resumable, checksum-verified downloader; complete byte ranges survive retries. Android may still defer or stop work because of OS quotas, force-stop, or device policy.
- iOS keeps its RNFS background-session download behavior.

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
- If the selected model is missing or downloading, queue processing stays blocked and the durable source remains in `Inbox` until the model is installed.
- If an attempted inference fails, raw fallback keeps the non-empty capture in `Inbox` without filing it under a guessed topic.
- Capture is never dropped.

### 10) Model download in progress (`Implemented`)

Expected behavior:
- Queue processing is blocked while the selected model is missing or downloading, or the device fails the model's resource-readiness check.
- UI shows stage-aware status (prepare/download/verify/install/finalize/installed).
- Download state remains visible until post-download refresh resolves installed state.
- Download completion does not load the synthesis runtime just to probe it; existing Inbox entries are requeued and initialize LiteRT when processing starts.

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
- `Open with AI Agent` opens share sheet with AI-oriented analysis prompt and context payload. It asks for plain text capped at 250 words, with exact headings for Key findings, Decisions, Risks, Next steps, and Open questions. Empty headings are omitted; source notes are not repeated; only useful additional insights are included.
- The source-only `Research with ChatGPT` action asks for a task, uses the optional local FunctionGemma model to prepare a query, and shares that task plus the current thread context through the OS share sheet. The user selects ChatGPT and sends the request; the response returns through the app's normal shared-text import flow. No app is opened or read automatically. Artifact and device validation are pending, and this action is not in the published build.
- Assistant research responses follow the same 250-word cap and headings, add a Sources heading with clickable links and dates, separate verified facts from inference, and state important gaps.

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
- A fresh install shows a one-time, swipeable three-step illustrated tutorial before Home: capture, on-device topic organization, and returning assistant research to related notes. Android's capture step explains adding the Record/Write Thought Notes widget. The guide is the visual focus; model progress stays compact beneath it. Back/Next remain available, while Skip and Start capturing unlock when transcription is ready: Android Whisper, or iOS Gemma 3n or Whisper according to the selected setup. A download/setup error offers retry. The composer and navigation remain usable. Completion is saved separately from device-readiness dismissal; existing installs with saved notes or a dismissed readiness notice skip it.
- While Android models prepare, Home shows approximate model size, progress when available, mobile-data disclosure, and reassurance that captures remain saved. The voice and writing models have separate progress states.
- Dismissing the first-run readiness card returns Home to the top so its capture introduction stays visible after the card is removed.
- Home status links to Waiting while queue work exists, to Inbox for a saved fallback when Inbox exists, and to the named topic after organization when that topic exists. A missing destination shows no link. The first-run readiness notice replaces the Home download prompt while visible.
- Settings exports all parsed notes to a versioned plain JSON file chosen through the operating system document picker. The archive preserves ids, timestamps, and source transcript metadata, excludes audio recordings and device-specific file paths, and is limited to 10 MB.
- Restore validates the complete archive before writing, adds notes without replacing current content, skips notes already present, and does not trigger synthesis. A picker cancellation changes nothing; a storage failure is shown and the same backup can be retried safely.
- The app does not upload backups. If the user chooses a cloud-backed file location, that file provider handles the selected file under its own terms.

## QA Regression Checklist

Run for each release candidate:
1. Manual text capture persists and exits queue cleanly.
2. Voice start/stop/transcribe state machine does not stall.
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
