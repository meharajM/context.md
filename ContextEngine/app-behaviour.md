# App Behavior

This is the concise feature-level behavior contract for iOS and Android development and publishing. It describes intended behavior; it does not prove implementation, QA, or publication. Track those separately in `implementation/status.json` and release records.

## Features

### Notes and text capture
- Notes are stored locally as per-topic Markdown files in `Documents/topics`. Existing `Documents/context.md` content migrates before the library loads; conflicting legacy content is preserved separately.
- Every non-empty capture is first saved durably to Inbox. Text can be captured in the app, through supported widget/share entry points, or by pasting/importing. Save and keyboard Done use the same path.
- Capture remains saved if synthesis fails or is unavailable. The app files it only after the destination note is durable.

### Voice capture and transcription
- Recording starts only from an explicit user action and requires microphone access. A missing transcription model does not block recording.
- Captured WAV audio and a recoverable Inbox entry are retained until transcription and Inbox persistence succeed. Failed, empty, or delayed transcription keeps the source available for retry.
- Retained audio is retried when the app starts and when a transcription model becomes ready. Processing time depends on device resources and OS background scheduling.

### Models and downloads
- With automatic selection and LiteRT enabled, an eligible physical device needs at least 8 GiB RAM and free storage for Gemma 3n E2B (about 3.66 GB) plus 512 MiB setup headroom. It selects Gemma 3n for local English transcription and writing/topic synthesis.
- Other devices, including simulators, use Gemma3-1B-IT for writing and Whisper tiny.en for transcription. Other catalog models are optional downloads. A manual model choice is retained; legacy audio-model preferences migrate to automatic selection, while text-only choices stay manual.
- Transcription instructions cover English accents, including Indian English; this is not an accuracy guarantee. Setup shows download stages and resource guidance. Low storage, memory, or thermal headroom can delay work. Text and voice capture remain available while models prepare.

### Topic organization and Inbox
- Synthesis compares candidate topics with their saved content. Automatic routing identifies a topic and composes the note; choosing a topic uses one synthesis pass. The original capture and available summary/source details remain in the topic.
- If routing is ambiguous, the app asks one focused question and offers topic choices. On failure, it keeps the item in Inbox rather than guessing or creating a generic topic.
- Inbox entries retry after startup or model readiness without duplicate entries. Users can edit and re-synthesize notes. Deleting an Inbox item requires confirmation and cancels matching queued work; only app-owned retained recordings can be deleted from storage.

### Widgets
- **Android Write:** Opens quick text capture. Save writes to a durable outbox and requests processing; the app can drain the outbox later if background work is delayed.
- **Android Record:** Starts a microphone foreground service with a timer and Stop controls in the widget and notification. Stop saves WAV audio and a recovery descriptor, then queues processing. Whisper is not required to start. Android Meeting widget opens Meeting mode.
- **iOS Write:** Hands off to Thought Notes and opens a focused quick-note sheet; saving uses the normal note path.
- **iOS Record:** Hands off to Thought Notes and starts recording in the app, with an in-app Stop control. Recording does not run inside the WidgetKit view. Meeting opens Meeting mode.
- iOS matches the Android capture outcome through an app handoff; capture does not run inside WidgetKit.
- Widget actions are user initiated; they do not enable always-listening capture.

### Headset and lock-screen capture
- Headset capture is opt-in. On Android, three media-button presses start or stop a voice note; lock-screen arming uses a visible foreground notification with a Stop/disable action.
- On iOS, the Lock Screen Record widget opens Thought Notes and starts in-app recording. Direct headset-button capture is not enabled in the current build; use the widget handoff. The app does not fake media playback to receive headset commands.
- These controls require an explicit user action and microphone permission. If the OS does not deliver a headset command, use the app or widget Record action. No wake word or always-listening capture.

### Background work
- Android uses WorkManager for processing/retries and model downloads; eligible user-started downloads use a visible system transfer job. iOS uses opportunistic background processing and background-session downloads.
- The OS may defer or stop background work. Inbox/outbox data remains the recovery source, and the app resumes eligible work on launch or foreground. No completion time is promised.

### Meetings
- The user starts and stops meeting capture. Start requires a ready transcription engine; ordinary voice notes can still be recorded while a model is unavailable. Meeting capture is for in-person audio through the device/headset microphone.
- Transcription appears in timestamped 20-second segments during capture. Speaker labels are not provided. Stop finalizes the transcript, then attempts a local summary and suggested actions. If summarization fails, transcript highlights are shown; users keep or dismiss each suggested action. Suggestions do not create reminders.
- Meeting content can be shared by section through the OS share sheet or saved as one Inbox note; later updates refresh that note. Meeting audio and records stay local and are excluded from library backups. Audio is kept for five minutes by default after stop and transcript save; users can choose one hour, one day, or Keep. Failed transcription preserves audio.

### Automatic reminders (iOS and Android)
- Reminders are off by default. After the user enables them, new notes are checked locally for tasks; clear tasks may use local cues if model analysis cannot run. Old notes are not scheduled retroactively.
- Local notifications provide Done and Snooze. Editing replaces a pending reminder, deleting cancels it, moving a note does not duplicate it, and disabling reminders cancels pending ones. iOS requires notification authorization; Android may delay delivery.

### Library, search, and sharing
- Topic threads show saved captures and available summaries; original content remains available. Search matches topic names, note text, and transcripts, then opens the matching note in its topic.
- Share Context and Open with AI Agent use the OS share sheet. Assistant text is user initiated, limited to 250 words, and organized under Key findings, Decisions, Risks, Next steps, and Open questions. The app does not send context automatically.
- Optional Research with ChatGPT uses local FunctionGemma when available to prepare a query; the user chooses ChatGPT and sends task/context through the share sheet, then returns the response through normal import.
- Text shared back from ChatGPT or another AI app is durably saved, then automatically matched to existing topic content and synthesized when Thought Notes next opens or returns to foreground. The Inbox source is removed only after the topic update is durable. If routing is ambiguous, ask the user to choose; if a model is unavailable or processing fails, keep the share recoverable in Inbox and retry when ready. Repeated delivery must not duplicate notes.

### Import, backup, and restore
- Pasted or shared text can be reviewed and organized locally. Merging into a related topic requires user approval; users can choose a topic directly. If processing cannot finish, imported text stays recoverable. Audio-file import is deferred.
- Backup exports parsed notes to a user-chosen versioned JSON file, up to 10 MB. It includes IDs, timestamps, and source transcripts, but excludes recordings and device paths.
- Restore validates the full archive, adds missing notes, skips existing IDs, and does not run synthesis. It does not upload data; the chosen file provider controls any cloud location.

### First run and settings
- Fresh installs show a three-step capture/organization/research tutorial. Skip and Start capturing remain available while models download.
- Home and Settings show model readiness, progress, errors, and retry guidance. Resource warnings explain that inference may be slow or deferred; users can still capture. Home status links to waiting work, Inbox, or the destination topic when available. Settings control model choice, capture preferences, privacy information, backup, and reminders on both platforms.
- On Android, foregrounding the app checks Google Play for flexible updates. The user approves download and then approves restart to install; postponing suppresses that version's prompt for seven days. Play Store auto-update remains under device settings.
- Existing installs with saved notes or a dismissed readiness notice skip the first-run tutorial.

## Deferred behavior

- Custom wake words, Siri/Google assistant voice intents, speaker labels, and audio-file import are not available.
