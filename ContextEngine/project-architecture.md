# Project Architecture

This file is the compact source of truth for the `ContextEngine` codebase. It is written so a small-context LLM can understand the full project architecture, runtime boundaries, primary user flows, and update obligations in one read.

Read this file before broad exploration. Update it whenever a code change alters architecture, runtime behavior, user flows, persistence, native integration, or major file ownership.

## 1. Product Summary

`ContextEngine` is an iOS-first React Native app for capturing thoughts locally and storing them in a markdown knowledge file.

Primary product behavior:

- Accept typed thought capture.
- Accept voice capture and transcribe locally with Whisper.
- Queue all non-empty captures for local synthesis.
- Use LiteRT-LM to refine/categorize captures into topic sections when available.
- Fall back safely to raw `Inbox` persistence when synthesis is blocked or fails.
- Let users review recent threads, inspect queue state, edit notes, manage local models, and share thread context.

Core safety invariant:

- No non-empty thought should be dropped.
- If capture succeeds but synthesis fails, the note must still persist locally.

Current platform posture:

- iOS is the active platform.
- Android exists in the repo, but iOS is the verified runtime path.
- Wake word is intentionally unavailable in the active MVP path until a real keyword spotter is bundled.
- There is no active network AI runtime in the main path. The app is local-first.

## 2. Top-Level Layering

The app follows this dependency direction:

`UI/screens -> selectors/store actions -> core store -> modules/services -> native bridges/filesystem`

Layer responsibilities:

- `App.tsx`
  - Root React Native entrypoint.
  - Mounts shell/background/safe-area providers.
  - Starts lifecycle and native-event hooks.
- `src/app`
  - App bootstrap.
  - Route types.
  - Top-level shell and screen switching.
- `src/core`
  - Global Zustand store.
  - Runtime orchestration across capture, queue, models, synthesis, and lifecycle.
- `src/features`
  - Screen-level UI and view model selectors.
  - No direct ownership of native/runtime internals.
- `src/modules`
  - Business/runtime services:
    - context persistence
    - audio capture/transcription
    - synthesis
    - queue processing
- `src/shared`
  - Reusable UI, design tokens, hooks, note metadata types, utilities.
- `ios/ContextEngine`
  - Native iOS bridges for LiteRT, assistant capture, headset events, and audio playback.

Rules:

- Feature code should prefer store actions and selectors.
- Native modules should stay isolated behind service/runtime wrappers.
- Persistence and fallback logic must stay in owned modules, not in screen components.

## 3. Canonical Runtime Components

### 3.1 React Root

Main file: `App.tsx`

Responsibilities:

- Start `useAppBootstrap()`.
- Start `useAppLifecycleSync()`.
- Start `useAssistantIntentCapture()`.
- Start `useHeadsetTripleTapCapture()`.
- Render `AppShell`.

This means app startup has three non-visual concerns:

- bootstrap and context path setup
- app foreground/background lifecycle sync
- native intent/headset event intake

### 3.2 App Bootstrap

Main file: `src/app/AppBootstrap.ts`

Responsibilities:

- Set `ContextManager` path to `RNFS.DocumentDirectoryPath/context.md`
- Load existing context into store state
- Enable push-to-record at startup
- Initialize audio readiness eagerly
- Avoid eager LiteRT initialization in bootstrap unless configured

Bootstrap output:

- `bootMessage`
- `contextPath`

Important note:

- `context.md` is created/read from the app documents directory at runtime, not from the repository root file.

### 3.3 App Shell and Routing

Main file: `src/app/AppShell.tsx`

This is the route owner for the app UI.

Primary routes:

- `reflections`
- `queue`
- `settings`

Secondary routes:

- `threadDetails`
- `noteEditor`

Main responsibilities:

- Hold current route state in React local state.
- Derive screen view models from store state and selectors.
- Open thread details from recent threads.
- Open note editor for queued jobs or persisted notes.
- Refresh models when entering Settings.
- Bridge screen button actions to store/module operations.

There is no separate navigation library in the active path. Routing is local state inside `AppShell`.

### 3.4 Global Store

Main file: `src/core/store.ts`

This is the orchestration center of the app.

Owned state:

- Parsed context sections
- Recording flags and explicit recording state
- Status text shown in the UI
- Queue size, pending count, active job, processing/blocking state
- Audio readiness
- Capture mode settings
- LiteRT model catalog and selected model state
- App foreground/background state
- Queue job snapshots for UI

Main actions:

- `loadContext`
- `addThought`
- `queueInboxForSynthesis`
- `updateQueuedThought`
- `removeQueuedThought`
- `startCapture`
- `stopCapture`
- `initializeEngine`
- `refreshModels`
- `selectModel`
- `downloadModel`
- `removeModel`
- `setCaptureSetting`
- `setAppLifecycleState`
- `runTranscriptionProbe`

Store responsibilities:

- Coordinate audio capture lifecycle.
- Mirror queue state from `ProcessingQueueManager`.
- Configure `SynthesisService` whenever LiteRT settings/models change.
- Gate queue processing when the selected LiteRT model is downloading.
- Reload context after queue completion/fallback.
- Requeue `Inbox` entries when user requests synthesis or a model download completes.

Design implication:

- Most cross-feature behavior should be added here or behind modules called from here.

## 4. Persistence Model

Main file: `src/modules/ContextManager/index.ts`

`ContextManager` owns the local markdown knowledge base.

Storage target:

- `${RNFS.DocumentDirectoryPath}/context.md`

Stored structure:

- markdown document
- top-level title header
- `## <section>` blocks
- per-note serialized bullet entries with metadata

Key concepts:

- `ContextSection`
- `ContextThought`
- note ids
- timestamps
- source metadata

Core operations:

- `setPath`
- `readContext`
- `appendThought`
- `getThoughtsFromSection`
- `getInboxThoughts`
- `removeThought`
- `updateThought`

Persistence guarantees:

- Empty thoughts are ignored.
- Writes are attempted atomically using temp-file move where possible.
- If atomic replace fails, direct write fallback is used.
- Notes can preserve metadata including source kind, transcript, source note id, source section, and retained audio path.

`Inbox` semantics:

- `Inbox` is the raw fallback topic.
- Failed or uncategorized captures must still be persisted there.
- Later synthesis can requeue `Inbox` notes and remove the original raw item after successful categorized write.

## 5. Capture Pipeline

### 5.1 Manual Text Capture

Main file: `src/features/capture/CaptureComposerContainer.tsx`

Flow:

1. User types text in the composer.
2. Save action calls store `addThought(trimmedText)`.
3. Store forwards to `ProcessingQueueManager.addToQueue(...)`.
4. Queue eventually synthesizes and persists.

Guardrails:

- Empty text is ignored.
- Manual save is rate-limited against immediate voice toggle accidents.
- Manual capture can be disabled in settings.

### 5.2 Voice Capture

Main files:

- `src/features/capture/CaptureComposerContainer.tsx`
- `src/core/store.ts`
- `src/modules/AudioEngine/AudioEngineImpl.ts`

Flow:

1. User taps record.
2. Store checks readiness and microphone permission.
3. `AudioEngineImpl.startRecording()` starts PCM stream + WAV writer.
4. User stops recording.
5. `AudioEngineImpl.stopRecording()` finalizes WAV and runs Whisper transcription.
6. If transcript text exists:
   - queue it as a `voice` thought
7. If transcription errors but audio exists:
   - persist retained audio note to `Inbox`
8. If no speech:
   - return to idle without queueing

Voice-specific invariant:

- Failed transcription with retained audio must not lose the capture.

### 5.3 Assistant Intent Capture

Main files:

- `src/shared/hooks/useAssistantIntentCapture.ts`
- `ios/ContextEngine/Intents/CaptureThoughtIntent.swift`
- `ios/ContextEngine/EventEmitter.swift`

Flow:

1. Siri/Shortcuts invokes `CaptureThoughtIntent`.
2. Native intent posts `AssistantCaptureRequested`.
3. Native `EventEmitter` forwards the event to React Native.
4. Hook normalizes payload and calls `addThought(..., 'text')`.
5. Capture enters normal queue flow.

### 5.4 Headset Triple-Tap Capture

Main files:

- `src/shared/hooks/useHeadsetTripleTapCapture.ts`
- `ios/ContextEngine/EventEmitter.swift`

Flow:

1. Native layer watches media remote toggle events.
2. Three taps inside the configured window emit `HeadsetTripleTapRequested`.
3. Hook inspects store state.
4. If currently recording:
   - stop capture
5. If idle and voice capture is enabled/ready:
   - start capture
6. If disabled/unavailable:
   - update status and optionally speak guidance natively

## 6. Queue and Synthesis Pipeline

### 6.1 Queue Manager

Main file: `src/modules/SynthesisEngine/ProcessingQueueManager.ts`

This owns asynchronous queued processing of captured thoughts.

Queue item shape:

- queue id
- note id
- transcript
- timestamp
- attempts
- kind: `voice | text | image`
- optional selected topic
- optional source context

Responsibilities:

- Accept new queue items.
- Emit state updates to subscribers.
- Process one item at a time.
- Retry failures.
- Fall back safely after max attempts.
- Remove original `Inbox`/source entries after successful categorized persistence.

Important behavior:

- `MAX_ATTEMPTS = 2`
- Each synthesis attempt has a timeout.
- When queue processing is blocked, the queue pauses without losing items.
- One common block reason is model download in progress.

### 6.2 Synthesis Service

Main file: `src/modules/SynthesisEngine/SynthesisService.ts`

This is the runtime policy layer for thought synthesis.

Responsibilities:

- Hold current LiteRT-enabled config.
- Initialize LiteRT runtime.
- Decide between LiteRT and raw fallback.
- Run topic selection/refinement flow.
- Degrade to raw fallback if LiteRT is unavailable or errors.

Runtime choices:

- Preferred: `LiteRtSynthesisRuntime`
- Fallback: `RawFallbackSynthesisRuntime`

Important behavior:

- If transcript is empty, raw fallback is used.
- If LiteRT is disabled, raw fallback is used.
- If LiteRT is not ready/available, raw fallback is used.
- LiteRT errors mark runtime unavailable and return fallback output instead of dropping work.

### 6.3 LiteRT Runtime Bridge

Main files:

- `src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts`
- `ios/ContextEngine/LiteRtModule.swift`

JS responsibilities:

- Check platform/native availability.
- Resolve model file path.
- Load model through native module.
- Build synthesis prompt and request native synthesis.
- Mark runtime unready after synthesis failure.

Native responsibilities:

- Load LiteRT model and sampler config.
- Create conversation/session.
- Run synthesis with timeout.
- Release/reset model on errors or timeout.

Current constraints:

- iOS-only active runtime.
- iOS simulator is explicitly unsupported for live LiteRT synthesis in this bridge path.
- Missing model returns unavailable state rather than silent failure.

## 7. Model Management

Main files:

- `src/modules/SynthesisEngine/modelManager.ts`
- `src/modules/SynthesisEngine/models.ts`
- store model actions in `src/core/store.ts`
- settings UI in `src/features/settings/*`

Capabilities:

- enumerate available model definitions
- resolve installed/download state
- download model to device
- select active model
- remove installed model

Critical runtime effect:

- When the selected model is downloading, synthesis queue processing is blocked.
- After a download completes, the app refreshes models, reconfigures LiteRT, initializes synthesis, and requeues `Inbox` for synthesis.

User-facing screens:

- Settings model management section
- Reflections model prompt card when required model is not installed

## 8. Feature and Screen Map

### 8.1 Reflections Screen

Main files:

- `src/features/reflections/ReflectionsScreen.tsx`
- `src/features/reflections/reflectionsSelectors.ts`

Purpose:

- Show capture state and readiness.
- Show model-download prompt when local AI is unavailable due to missing model.
- Show recent threads derived from context sections.

Selector behavior:

- Recent threads are built directly from parsed markdown sections.
- Thread ids are derived from section headers plus index.

### 8.2 Queue Screen

Main files:

- `src/features/queue/QueueScreen.tsx`
- `src/features/queue/queueSelectors.ts`

Purpose:

- Show active queued item.
- Show pending queue items.
- Allow ending or editing non-active jobs.

Important behavior:

- Active item cannot be removed/edited through normal queue mutation.
- Idle queue is represented by a synthetic “Queue clear” card.

### 8.3 Thread Details Screen

Main files:

- `src/features/threads/ThreadDetailsScreen.tsx`
- `src/features/threads/threadSelectors.ts`

Purpose:

- Show one thread summary and source capture timeline.
- Support note editing.
- Support sharing context.
- Support AI-oriented share/export.
- Support `Inbox` re-synthesis action.
- Support playback/deletion of retained audio when available.

Important selector behavior:

- Thread details are derived by reparsing stored notes in a section.
- Capture type is inferred from structured metadata first, then heuristics.

### 8.4 Note Editor

Main file:

- `src/features/noteEditor/NoteEditorScreen.tsx`

Used for two modes:

- edit queued job before synthesis
- edit persisted capture note after persistence

Special behavior:

- Saving a persisted note in `Inbox` requeues it for synthesis.

### 8.5 Settings

Main files:

- `src/features/settings/SettingsScreen.tsx`
- `ModelManagementSection.tsx`
- `CaptureModesSection.tsx`
- `AssistantShortcutsSection.tsx`
- `DiagnosticsSection.tsx`
- `PrivacyCard.tsx`

Purpose:

- Manage models.
- Toggle manual/voice/wake-word/LiteRT settings.
- Show diagnostics/state.
- Expose assistant shortcut support.
- Reinforce privacy/local-first behavior.

## 9. Native iOS Boundary

Main files:

- `ios/ContextEngine/AppDelegate.swift`
- `ios/ContextEngine/EventEmitter.swift`
- `ios/ContextEngine/LiteRtModule.swift`
- `ios/ContextEngine/Intents/CaptureThoughtIntent.swift`

Native-owned capabilities:

- React Native app boot
- assistant intent bridge
- headset triple-tap detection
- spoken guidance feedback
- local audio playback for retained recordings
- LiteRT native model loading and synthesis

Boundary rules:

- Keep UI/business logic in TS where possible.
- Keep LiteRT native access isolated to the LiteRT bridge files.
- JS should interact with native features through narrow wrappers/hooks/services.

## 10. Primary User Flows

### Flow A: Manual Capture to Categorized Thread

1. User types a note.
2. Composer saves via `addThought`.
3. Queue item is created.
4. Queue calls synthesis.
5. LiteRT returns refined text + topic.
6. ContextManager appends note to topic section.
7. Store reloads context.
8. Reflections shows updated thread.

### Flow B: Voice Capture to Categorized Thread

1. User starts recording.
2. Audio engine records local WAV.
3. User stops recording.
4. Whisper transcribes locally.
5. Transcript queues as `voice`.
6. Queue synthesizes and persists categorized note.
7. Context reload updates threads.

### Flow C: Voice Failure with Safe Persistence

1. User records voice.
2. Stop/transcription returns error but retained audio exists.
3. App appends “Voice capture retained” note to `Inbox` with audio file metadata.
4. User can later inspect `Inbox` thread.
5. User can play or delete retained audio.

### Flow D: Missing Model / Delayed Synthesis

1. User captures note while LiteRT model is not installed or still downloading.
2. Queue item still exists.
3. Queue is blocked until model becomes usable, or fallback path persists raw note.
4. After model installation, app reinitializes synthesis and can requeue `Inbox`.

### Flow E: Inbox Re-Synthesis

1. User opens `Inbox` thread.
2. User taps `Synthesize Inbox`.
3. Store reads raw `Inbox` notes and queues them if not already queued.
4. Successful synthesis writes categorized note to target section.
5. Original `Inbox` entry is removed after successful categorized write.

### Flow F: Assistant Shortcut Capture

1. Siri/Shortcut passes content into native intent.
2. Event reaches JS hook.
3. Hook calls `addThought`.
4. Normal queue and persistence flow continues.

## 11. Critical Invariants

Do not break these:

- Every non-empty capture must persist or remain queued.
- Queue failures must not silently drop a note.
- LiteRT unavailability must degrade to blocked/fallback behavior, not data loss.
- `Inbox` is the canonical raw fallback topic.
- Successful re-synthesis of an `Inbox` item should remove the original raw source note.
- Feature UI should not directly couple to native modules except through established wrappers already in use.
- Wake-word/background behavior must not be claimed as working unless explicitly implemented and validated.
- Model download state must gate synthesis clearly so partial downloads do not process queued thoughts.

## 12. File Map for Fast Orientation

Start here in this order:

1. `project-architecture.md`
2. `AGENTS.md`
3. `info.md`
4. `implementation/status.json`
5. `implementation/SMALL_AGENT_HANDOFF.md`
6. `app-behaviour.md`
7. `src/app/AppShell.tsx`
8. `src/core/store.ts`
9. `src/modules/ContextManager/index.ts`
10. `src/modules/AudioEngine/AudioEngineImpl.ts`
11. `src/modules/SynthesisEngine/ProcessingQueueManager.ts`
12. `src/modules/SynthesisEngine/SynthesisService.ts`

Use these for feature-specific follow-up:

- capture: `src/features/capture/*`
- queue: `src/features/queue/*`
- reflections: `src/features/reflections/*`
- threads: `src/features/threads/*`
- settings: `src/features/settings/*`

## 13. How To Update This File

Update this file after any completed task that changes:

- route structure
- store ownership
- module boundaries
- persistence format or semantics
- queue behavior
- synthesis runtime selection
- native bridge behavior
- model-management behavior
- core user flows
- platform support claims

When updating:

- keep sections compact and factual
- prefer architecture facts over implementation trivia
- reflect actual code, not roadmap intent
- include new invariants when a change introduces a new safety rule
- remove obsolete claims immediately

If a small LLM could not understand the changed architecture from this file alone, the file is not complete enough.
