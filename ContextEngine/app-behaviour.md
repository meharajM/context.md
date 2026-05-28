# ContextEngine App Behaviour Roadmap

This file is a target-behavior roadmap, not a claim that all items are already implemented.

## Scope

- Platform priority: iOS-first.
- Data model: local-only `context.md` persistence.
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

### 3) Edit/re-synthesize note (`Planned`)

Expected behavior:
- Edit action exists for both queue items and persisted Inbox/thread items.
- Edit opens a dedicated edit screen.
- Saving edited note re-queues it for re-synthesis.
- Original source metadata is preserved deeply.
- Source metadata view is available in a modal to avoid UI clutter.

### 4) Topic linking shortcut (`Planned`)

Expected behavior:
- User can optionally select a topic for note linking.
- Without topic selection:
  - synthesis pass 1 identifies topic,
  - synthesis pass 2 composes comprehensive context against topic content.
- With topic selection:
  - a single synthesis pass composes against selected topic content.

## Voice Readiness and Triggers

### 5) Voice gating indicators (`Planned`)

Expected behavior:
- If Whisper readiness is false, home UI shows readiness guidance.
- If `pushToRecordEnabled` is false, home UI shows indicator and link to enable in settings.
- Microphone denial shows access-needed guidance.
- Indicators are evaluated and shown on each app launch and on record-trigger attempts.

### 6) Headset triple-tap trigger (`Planned`, active scope)

Expected behavior:
- Triple tap on supported ear/headphone button starts background voice capture.
- Triple tap again stops capture.
- If Whisper is ready, post-stop behavior follows normal voice pipeline.
- If Whisper is not ready, app announces readiness issue via audio output and directs user to app settings.

## Assistant Intents

### 7) Siri/Google intents and shortcuts (`Planned`, active scope)

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
- Synthesized topic and refined text are appended to context.
- Source metadata is retained (`Source kind`, optional `Source transcript`).

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

### 11) Model not installed (`Implemented` + `Planned`)

Implemented:
- Queue is not hard-blocked by missing model.
- Captures persist through fallback and can be re-synthesized later.

Planned:
- Unsynthesized text and voice notes are editable.
- Delete option exists for both text and voice.
- For voice entries:
  - if transcript exists, store transcript only.
  - if transcription fails, persist audio file and provide playback.

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

### 16) Import context for synthesis (`Planned`)

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

Roadmap QA additions when implemented:
1. Edit/re-synthesis works for queue and persisted items with metadata preserved.
2. Topic selection path executes one-pass synthesis against selected topic content.
3. Headset triple-tap trigger works for start/stop and respects readiness checks.
4. Siri/Google intent shortcut ingestion persists content correctly.
5. Import flow supports text and all listed voice formats with permissioned merge behavior.

## Known Operational Limits

- Physical-device and simulator validation depend on healthy CoreSimulator/CoreDevice host services.
- Lint may remain blocked by existing ESLint environment mismatch (`jest/globals`) until config is fixed.
