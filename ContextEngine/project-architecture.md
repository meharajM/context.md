# Project Architecture

This file is the compact source of truth for the `ContextEngine` codebase. It is written so a small-context LLM can understand the full project architecture, runtime boundaries, primary user flows, and update obligations in one read.

Read this file before broad exploration. Update it whenever a code change alters architecture, runtime behavior, user flows, persistence, native integration, or major file ownership.

## 1. Product Summary

`ContextEngine` is a React Native app for iOS and Android that captures thoughts locally and stores them in topic markdown files.

Primary product behavior:

- Accept typed thought capture.
- Accept voice capture and transcribe locally with Whisper.
- Import pasted text or local voice files into topic threads with permissioned merge decisions.
- Queue all non-empty captures for local synthesis.
- Use LiteRT-LM to refine/categorize captures into topic sections when available.
- Compare candidate topics against their persisted content instead of defaulting to a topic name or list position.
- Hold ambiguous captures in the queue with a focused clarification question and 2–3 topic choices until the user resolves the route.
- Fall back safely to raw `Inbox` persistence when synthesis is blocked or fails.
- Let users review recent threads, inspect queue state, edit notes, manage local models, and share thread context.

Core safety invariant:

- No non-empty thought should be dropped.
- If capture succeeds but synthesis fails, the note must still persist locally.

Current platform posture:

- iOS and Android are active publication targets; iOS has the broader historical real-device evidence.
- Both platforms share the TypeScript capture, queue, import, persistence, and synthesis orchestration layers.
- Platform-native bridges provide signing, assistant intake, file selection, audio, and LiteRT integration.
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
- `ios` and `android/app/src/main`
  - Platform bridges for LiteRT, assistant capture, headset/media-button events, file selection, and audio playback.

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

- Set the canonical `ContextManager` root to `RNFS.DocumentDirectoryPath/topics` and supply `RNFS.DocumentDirectoryPath/context.md` as the legacy migration source; coexistence preserves divergent sections under `Legacy <topic>` instead of attempting a lossy merge
- Load existing context into store state
- Enable push-to-record at startup
- Initialize audio and synthesis readiness eagerly so persisted Inbox entries can requeue during bootstrap

Bootstrap output:

- `bootMessage`
- `contextPath`

Important note:

- Canonical topic files are created/read under the app's `Documents/topics` directory at runtime, not from repository Markdown files. The former `Documents/context.md` layout is accepted only as one-time migration input.

### 3.3 App Shell and Routing

Main file: `src/app/AppShell.tsx`

This is the route owner for the app UI.

Primary routes:

- `reflections`
- `queue`
- `import`
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
- Topic clarification state for ambiguous queued captures
- Audio readiness
- Capture mode settings
- LiteRT model catalog and selected model state
- App foreground/background state
- Queue job snapshots for UI

Main actions:

- `loadContext`
- `addThought`
- `queueInboxForSynthesis`
- `resolveQueueClarification`
- `updateQueuedThought`
- `removeQueuedThought`
- `deleteUnsynthesizedNote`
- `deleteRetainedAudioFromNote`
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
- Persist manual, Assistant, and successful voice captures to `Inbox` before placing them in the in-memory synthesis queue.
- Mirror queue state from `ProcessingQueueManager`.
- Configure `SynthesisService` whenever LiteRT settings/models change.
- Gate queue processing when the selected LiteRT model is downloading.
- Surface clarification questions/options from the queue and resume the held item under the selected topic.
- Reload context after queue completion/fallback.
- Requeue `Inbox` entries when user requests synthesis or a model download completes.
- Delete confirmed unsynthesized `Inbox` notes, canceling matching pending synthesis work and refusing deletion while that note is actively processing.
- Route retained-recording deletion through the audio engine's app-owned path guard; imported audio paths are never unlinked.

Design implication:

- Most cross-feature behavior should be added here or behind modules called from here.

## 4. Persistence Model

Main file: `src/modules/ContextManager/index.ts`

`ContextManager` owns the local markdown knowledge base.

Storage target:

- `${RNFS.DocumentDirectoryPath}/topics/*.md` (canonical), with `${RNFS.DocumentDirectoryPath}/context.md` accepted as one-time legacy migration input

Stored structure:

- one Markdown document per topic
- one `# <topic>` title header per file
- per-note serialized bullet entries with metadata
- legacy aggregate files may contain `## <section>` blocks only as migration input

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

Unsynthesized deletion semantics:

- The dedicated delete affordance exists only in the persisted `Inbox` thread, not categorized topic history.
- The store removes matching pending queue representations before deleting a persisted Inbox entry, but refuses the operation when that note is the active synthesis item.
- Retained WAV deletion accepts only generated files directly under `Documents/retained-audio`; arbitrary, imported, nested, or path-traversal inputs are rejected.

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
3. Store durably appends the raw capture to `Inbox` with a stable note id.
4. Store queues the persisted note as a source-context item.
5. Queue synthesis writes the categorized replacement before removing the original `Inbox` entry.

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
   - persist it to `Inbox`, then queue that durable source as a `voice` thought
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
5. Store persists the capture to `Inbox` before it enters the normal queue flow.

### 5.4 Headset Triple-Tap Capture

Main files:

- `src/shared/hooks/useHeadsetTripleTapCapture.ts`
- `ios/EventEmitter.swift`
- `android/app/src/main/java/com/meharaj/contextengine/EventEmitter.kt`
- `android/app/src/main/java/com/meharaj/contextengine/HeadsetMediaButtonController.kt`

Flow:

1. A compatible headset/OS maps a triple press to a previous/skip-back media command. Android also accepts three raw headset/play-pause events within the configured window.
2. The foreground-scoped native handler debounces the command and emits `HeadsetTripleTapRequested`.
3. Hook inspects store state.
4. If currently recording:
   - stop capture
5. If idle and voice capture is enabled/ready:
   - start capture
6. If disabled/unavailable:
   - update status and optionally speak guidance natively

Platform constraint:

- Android activates its flagged, paused MediaSession only while the React host is resumed. It can handle commands explicitly dispatched to that session, but stock Android global routing selects sessions from UIDs with actual audio playback; Context Engine does not fake playback or play silence to enter that list.
- iOS listens to `previousTrackCommand` only while active and does not fabricate Now Playing eligibility. Background/lock-screen interception is not an implemented capability.

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
- optional clarification question and topic options
- optional source context

Responsibilities:

- Accept new queue items.
- Emit state updates to subscribers.
- Process one item at a time.
- Retry failures.
- Fall back safely after max attempts.
- Remove original `Inbox`/source entries only after model-backed categorized persistence.

Important behavior:

- `MAX_ATTEMPTS = 2`
- Each synthesis attempt has a timeout.
- When queue processing is blocked, the queue pauses without losing items.
- One common block reason is model download in progress.
- When synthesis identifies an ambiguous route, the current item remains queued with clarification state; no topic write or source removal occurs until the user chooses an option.
- Resolving a clarification sets the selected topic and resumes the normal selected-topic synthesis path.
- Resolved `raw-fallback` output persists the untouched transcript to `Inbox`; for an Inbox requeue it leaves the existing source in place without duplicating it.
- Candidate topic names and persisted topic contents travel as separate inputs so refinement can use the selected/identified topic's actual context.

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
- Raw fallback always returns the trimmed original transcript under `Inbox`; it does not heuristically assign or rewrite a topic.
- LiteRT errors mark runtime unavailable and return fallback output instead of dropping work.
- Selected-topic synthesis uses that topic's persisted content in one pass. Auto-topic synthesis identifies a topic first, then supplies matching persisted content to the refinement pass.
- Auto-topic identification receives persisted content for all candidate topics so the model can compare contexts before selecting a route. If it cannot decide, it returns a clarification object instead of guessing.

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
- iOS simulator is validated for live LiteRT synthesis on the iPhone 16 simulator with the current model path.
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
- Show clarification questions and topic options for ambiguous active items.

Important behavior:

- Active item cannot be removed/edited through normal queue mutation.
- Idle queue is represented by a synthetic “Queue clear” card.
- A clarification item remains active until a topic option is selected; resolving it resumes processing.

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
- Support destructive-confirmation deletion of persisted unsynthesized Inbox text and voice notes.

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

### 8.6 Import

Main files:

- `src/features/import/ImportScreen.tsx`
- `src/shared/utils/voiceFilePicker.ts`
- `src/shared/utils/voiceImport.ts`

Purpose:

- Import pasted text or local voice files.
- Offer searchable existing-topic targeting.
- Require explicit approval for related-topic merges.
- Queue imports through the same persistence-safe flow as manual capture.

## 9. Native Platform Boundaries

Main files:

- `ios/ContextEngine/AppDelegate.swift`
- `ios/EventEmitter.swift`
- `ios/ContextEngine/LiteRtModule.swift`
- `ios/ContextEngine/Intents/CaptureThoughtIntent.swift`
- `android/app/src/main/java/com/meharaj/contextengine/EventEmitter.kt`
- `android/app/src/main/java/com/meharaj/contextengine/HeadsetMediaButtonController.kt`

Native-owned capabilities:

- React Native app boot
- assistant intent bridge
- foreground-scoped headset/media-command routing
- spoken guidance feedback
- local audio playback for retained recordings
- LiteRT native model loading and synthesis

Boundary rules:

- Keep UI/business logic in TS where possible.
- Android release metadata targets API 36, removes dependency-injected legacy
  shared-storage permissions, treats microphone hardware as optional, and
  excludes every app-private storage domain from cloud and device transfer.
- iOS ships one app privacy manifest with the required React Native/app reasons,
  no tracking or collected-data declarations, and no background-audio mode.
- The post-install dependency preparation removes `react-native-fs`'s unused
  iOS disk-capacity export so the linked executable does not contain a required-
  reason API that the product never calls.
- Keep LiteRT native access isolated to the LiteRT bridge files.
- JS should interact with native features through narrow wrappers/hooks/services.
- Native media-button handlers must not claim background playback or microphone capabilities that the app does not actually provide.

## 10. Primary User Flows

### Flow A: Manual Capture to Categorized Thread

1. User types a note.
2. Composer saves via `addThought`.
3. ContextManager appends the raw note to `Inbox`.
4. A queue item references that durable source note.
5. Queue calls synthesis.
6. LiteRT returns refined text + topic.
7. ContextManager appends the categorized note, then removes the raw source.
8. Store reloads context and Reflections shows the updated thread.

### Flow B: Voice Capture to Categorized Thread

1. User starts recording.
2. Audio engine records local WAV.
3. User stops recording.
4. Whisper transcribes locally.
5. Transcript persists to `Inbox` before it queues as `voice`.
6. Queue synthesizes, writes the categorized note, then removes the raw source.
7. Context reload updates threads.

### Flow C: Voice Failure with Safe Persistence

1. User records voice.
2. Stop/transcription returns error but retained audio exists.
3. AudioEngine moves or copies the WAV into the app-owned `Documents/retained-audio` directory; a failed durable copy leaves the temporary source untouched.
4. App appends “Voice capture retained” note to `Inbox` with the resulting audio file metadata.
5. User can later inspect `Inbox` and play or delete retained audio.

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
5. Original `Inbox` entry is removed only after a LiteRT-backed categorized write.
6. Raw fallback or failure leaves the original Inbox entry intact and does not create a duplicate.

### Flow F: Assistant Shortcut Capture

1. Siri/Shortcut passes content into native intent.
2. Event reaches JS hook.
3. Hook calls `addThought`.
4. Store persists the raw content to `Inbox` before queueing it.
5. Normal synthesis and categorized replacement flow continues.

### Flow G: Import and Permissioned Merge

1. User opens Import.
2. User pastes text or picks a local voice file.
3. App analyzes the draft against existing topics and the optional selected topic.
4. If the suggested topic matches an existing topic and no topic was selected, user approval is required before merge regardless of synthesis source.
5. If no related topic exists, the import creates a new topic thread.
6. The import enters the same queue, synthesis, and fallback path as manual capture.

## 11. Critical Invariants

Do not break these:

- Every non-empty capture must persist or remain queued.
- Queue failures must not silently drop a note.
- LiteRT unavailability must degrade to blocked/fallback behavior, not data loss.
- `Inbox` is the canonical raw fallback topic.
- Only model-backed, categorized re-synthesis of an `Inbox` item may remove the original raw source note.
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
- import: `src/features/import/*`

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
