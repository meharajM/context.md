# ContextEngine App Behaviour Roadmap

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
- Non-empty note is queued immediately.
- Queue runs synthesis when available.
- On synthesis success, note is appended under a topic thread.
- On synthesis failure, raw note is appended to `Inbox`.
- Queue returns to idle and reflections refreshes.

### 2) Voice note capture (`Implemented`)

Expected behavior:
- Recording state transitions: `starting` -> `recording` -> `stopping` -> `transcribing` -> `idle`.
- Non-empty transcript queues as `voice`.
- Empty transcript does not queue.
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

### 5) Voice gating indicators (`Implemented`)

Expected behavior:
- If Whisper readiness is false, home UI shows readiness guidance.
- If `pushToRecordEnabled` is false, home UI shows indicator and link to enable in settings.
- Microphone denial shows access-needed guidance.
- Indicators are evaluated and shown on each app launch and on record-trigger attempts.

### 6) Headset triple-tap trigger (`Implemented` + `Planned`)

Implemented:
- The shared trigger toggles normal voice start/stop and ignores duplicate input while capture is transitioning.
- If push-to-record or Whisper is unavailable, the app announces guidance and directs the user to Settings.
- On Android, a foreground-scoped `MediaSession` advertises media-button/transport handling and normalizes either an OS skip-back command or three raw headset/play-pause events when a device dispatches them to the app.
- On iOS, a received EarPods triple press is handled as `previousTrackCommand`, which is the command produced by the OS, instead of being counted as three play/pause events.

Planned:
- Reliable Android hardware delivery while Context Engine is not actually playing media. Stock Android selects the global media-button session from UIDs with real audio playback; a foreground, flagged, paused session remains unselected. A controlled emulator probe also confirmed that falsely declaring `STATE_PLAYING` without audio does not change this selection, so the app does not ship that workaround.
- Reliable background or lock-screen capture. Android requires a user-visible microphone foreground-service contract, while iOS remote commands require legitimate Now Playing eligibility. The app does not start silent playback or publish fake media metadata merely to intercept controls.
- Physical-earphone validation across representative wired and Bluetooth controls. Build/simulator validation does not prove that an accessory or OS will route its command to Context Engine.

## Assistant Intents

### 7) Siri/Google intents and shortcuts (`Implemented`)

Expected behavior:
- No custom wake word is required for this path.
- User can invoke assistant intents like:
  - "Hey Siri/Google, add this to my context: {content}".
- Integration is intents/shortcuts based only.
- App provides setup/binding guidance in settings where platform requires user action.

## Synthesis Flows

### 8) LiteRT synthesis available (`Implemented`)

Expected behavior:
- Queue attempts LiteRT synthesis with candidate topics.
- Candidate topics are compared against their persisted topic content, not just their names or list order.
- Synthesized topic and refined text are appended to context.
- Source metadata is retained (`Source kind`, optional `Source transcript`).

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
- Queue processing is blocked only while selected model is actively downloading.
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

## Thread and Sharing Flows

### 14) Thread details rendering (`Implemented`)

Expected behavior:
- Thread shows summary and source capture timeline.
- Voice/image/text labels map from capture metadata when present.

### 15) Share actions (`Implemented`)

Expected behavior:
- `Share Context` opens native share sheet with structured context payload.
- `Open with AI Agent` opens share sheet with AI-oriented analysis prompt and context payload.

## Import and Merge Flows

### 16) Import context for synthesis (`Implemented`)

Expected behavior:
- Dedicated import screen supports:
  - paste text input,
  - upload voice note.
- Supported voice formats include `.m4a`, `.mp3`, `.wav`, `.aac`, `.ogg`, `.opus`.
- Imported content queues and synthesizes.
- If related topic exists, merge requires explicit user permission.
- If no related topic exists, create a new topic thread.
- Import screen provides optional searchable topic selector for direct append.

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

Validated roadmap additions:
1. Edit/re-synthesis works for queue and persisted items with metadata preserved.
2. Topic selection path executes one-pass synthesis against selected topic content.
3. Headset trigger event routing works for start/stop and respects readiness checks; accessory routing and background/lock-screen behavior remain pending physical/platform validation.
4. Import flow supports text and all listed voice formats with permissioned merge behavior.
5. Unsynthesized Inbox text/voice deletion requires confirmation, cancels pending work, and restricts audio unlinking to app-owned retained recordings.

## Known Operational Limits

- Physical-device and simulator validation depend on healthy CoreSimulator/CoreDevice host services.
- Final release validation requires owner credentials and physical-device runs; simulator and automated checks do not replace store review or hardware QA.
