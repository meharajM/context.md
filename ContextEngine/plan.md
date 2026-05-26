# Context Engine - Implementation Plan

## Summary
Build the first working milestone as an iOS-first React Native app that can capture thoughts manually, by push-to-record, and by foreground wake-word; synthesize them locally with LiteRT; and persist them into a structured local `context.md` file.

This plan is based on the actual repository state as of 2026-05-25. The current code has useful prototype modules, but the app entrypoint is incomplete, runtime orchestration is brittle, and the docs are ahead of verified behavior.

Locked decisions:
- MVP includes manual save, push-to-record, and foreground wake-word.
- Wake-word/background listening must be user-toggleable in app settings, but the first implementation only requires foreground wake-word while the app is open.
- Settings are stored in Zustand runtime state for this milestone.
- Failed or unavailable synthesis saves raw text under `Inbox`.
- Platform priority is iOS-first.
- LiteRT replaces direct `llama.rn` usage as the target full-synthesis runtime.
- Android LiteRT/NPU work is deferred until iOS MVP behavior works.

## LiteRT Direction

Sources reviewed:
- Google Developers Blog: https://developers.googleblog.com/litert-the-universal-framework-for-on-device-ai/
- LiteRT documentation: https://ai.google.dev/edge/litert
- LiteRT GenAI overview: https://ai.google.dev/edge/litert/genai/overview
- LiteRT iOS quickstart: https://ai.google.dev/edge/litert/ios/quickstart
- LiteRT Android docs: https://ai.google.dev/edge/litert/android
- LiteRT NPU acceleration docs: https://ai.google.dev/edge/litert/next/npu
- LiteRT GitHub: https://github.com/google-ai-edge/litert

Relevant findings:
- LiteRT is Google's successor/evolution of TensorFlow Lite for high-performance on-device ML and GenAI.
- LiteRT keeps `.tflite` deployment while adding newer conversion, optimization, GPU, NPU, and GenAI workflows.
- LiteRT supports native iOS via CocoaPods such as `TensorFlowLiteSwift` or `TensorFlowLiteObjC`.
- LiteRT supports Android with the newer `CompiledModel` API and hardware acceleration paths.
- LiteRT GenAI includes LiteRT Torch conversion, LiteRT-LM runtime concepts, and model/runtime components for local transformer inference.
- Android has the clearest NPU path; iOS should start with the native LiteRT pod and available delegate support.

Project implication:
LiteRT should become the primary synthesis target, but the app must remain usable when LiteRT assets or native bridge support are absent. The implementation should isolate LiteRT behind a runtime interface so the UI, queue, and persistence layers do not depend on a specific model engine.

## Current Repository State

What exists:
- React Native 0.84 iOS/Android scaffold.
- Zustand store in `src/core/store.ts`.
- `ContextManager` for markdown parsing and persistence.
- Partial `AudioEngineImpl` using `whisper.rn`.
- Partial `SynthesisService` using `llama.rn`.
- `ProcessingQueueManager` for async thought processing.
- iOS assets for Whisper and TinyLlama.
- Android asset for Whisper and native GGML Hexagon libraries.
- Some isolated Jest tests.

What is broken or unverified:
- `App.tsx` is not compile-ready; it contains placeholder content and references undefined handlers/state.
- `ContextManager.setPath(...)` is not reliably wired before reads/writes.
- `SynthesisService` is coupled directly to `llama.rn`, which conflicts with the LiteRT direction.
- The queue can retry indefinitely and does not expose durable failure state.
- The store creates polling intervals from `addThought()` without lifecycle ownership.
- Wake-word detection is effectively stubbed.
- Background service code only logs and implies a capability that is not implemented.
- `npm test` previously failed because local dependencies were not installed/resolved.
- Android build log shows native packaging/disk-space failures.
- Docs claim later phases are complete even when the implementation is partial.

## Target MVP Behavior

User-facing behavior:
- App launches even when no AI model assets are installed.
- User can type a thought and save it.
- User can press a capture button to start/stop recording when transcription is available.
- User can enable/disable manual save, push-to-record, foreground wake-word, and LiteRT synthesis in settings.
- Foreground wake-word only runs while the app is active and the setting is enabled.
- If LiteRT full synthesis succeeds, the thought is saved under the returned topic with refined text and tags.
- If LiteRT fails, is disabled, or assets are missing, the thought is still saved under `Inbox` with raw text and a fallback marker.
- The app never drops a valid captured thought because a local model failed.

Explicitly not required for this milestone:
- Locked-screen or always-on background wake-word.
- Hardware button interception beyond OS-supported shortcuts.
- Agent-to-app API sync.
- Android LiteRT/NPU implementation.
- Persistent settings across app restart.
- Durable queue persistence across app restart.

## Implementation Plan

### 1. Rebuild App Entrypoint
- Replace `App.tsx` with a complete component that can compile.
- Add startup flow:
  - compute `RNFS.DocumentDirectoryPath/context.md`
  - call `ContextManager.setPath(...)`
  - load existing context sections
  - request microphone permission only when needed for audio
  - initialize audio and synthesis runtimes without crashing on failure
- Add UI states for booting, idle, recording, processing, model missing, permission denied, and failed fallback.
- Add controls:
  - thought text input
  - manual save button
  - push-to-record button
  - settings panel with runtime toggles
  - section list rendered from loaded context
- Remove unused imports such as `NativeEventEmitter`, `NativeModules`, and background service hooks until they are wired intentionally.

### 2. Refactor Store and Settings
- Add runtime settings in Zustand:
  - `manualCaptureEnabled`
  - `pushToRecordEnabled`
  - `wakeWordEnabled`
  - `liteRtEnabled`
- Add app state domains:
  - initialization status
  - audio readiness
  - synthesis readiness
  - capture state
  - queue state
  - settings
  - loaded context sections
- Replace freeform status strings with typed state plus display text derived in the UI.
- Remove interval polling from `addThought()`.
- Refresh context after queue job completion through a callback/subscriber or an awaited queue result.
- Ensure capture failures always reset `isRecording`.

### 3. Harden Context Persistence
- Validate that `ContextManager` has a non-empty path before any read/write.
- Normalize empty, invalid, or failed-synthesis topics to `Inbox`.
- Match existing topics case-insensitively and trim whitespace.
- Keep the markdown schema stable:
  - `# Context Master File`
  - `## Topic`
  - `- [ISO timestamp] thought text`
- Use temp write plus move when supported by `react-native-fs`; otherwise keep direct write and document the limitation.
- Preserve parse tolerance for manually edited markdown.

### 4. Add Runtime-Neutral Synthesis
- Introduce a synthesis runtime interface:

```ts
export interface SynthesizedThought {
  topic: string;
  refinedText: string;
  tags: string[];
  source: 'litert' | 'heuristic' | 'raw-fallback';
}

export interface SynthesisRuntime {
  id: string;
  initialize(): Promise<RuntimeReadiness>;
  synthesize(input: {
    transcript: string;
    existingTopics: string[];
  }): Promise<SynthesizedThought>;
  release(): Promise<void>;
}
```

- Refactor `SynthesisService` to select runtimes in this order:
  - `LiteRtSynthesisRuntime` when enabled and available
  - heuristic synthesis
  - raw `Inbox` fallback
- Move current prompt/parse behavior out of direct `llama.rn` ownership.
- Keep `llama.rn` code only as a temporary reference or remove it once LiteRT runtime is wired.
- Harden JSON parsing so malformed model output cannot block persistence.

### 5. Integrate LiteRT for iOS First
- Add iOS LiteRT dependency through CocoaPods using `TensorFlowLiteSwift` or `TensorFlowLiteObjC`.
- Add a native iOS React Native module for LiteRT with a small bridge surface:
  - `isAvailable()`
  - `loadModel(modelPath)`
  - `synthesize(input)`
  - `benchmark(fixtures)`
  - `release()`
- Add TypeScript wrapper `LiteRtSynthesisRuntime`.
- Do not commit large LiteRT model artifacts.
- Add model setup documentation with source URL, license, expected path, checksum, and expected size.
- If no suitable LiteRT full-synthesis model artifact is available during implementation, keep bridge/runtime code complete and route synthesis to `Inbox` fallback with clear readiness state.
- Add `docs/litert-evaluation.md` to track selected model, model limitations, benchmark results, and adoption recommendation.

### 6. Stabilize Audio and Foreground Wake-Word
- Update `AudioEngine` to return structured readiness:
  - `transcriptionReady`
  - `wakeWordReady`
  - `missingModels`
  - `errors`
- Keep push-to-record backed by `whisper.rn`.
- Make missing Whisper model disable push-to-record while preserving manual save.
- Implement foreground wake-word only when:
  - app is active
  - `wakeWordEnabled` is true
  - audio readiness says wake-word support is available
- Do not present background wake-word as working in UI or docs.
- Feature-gate or remove `BackgroundService` from the MVP runtime path.

### 7. Make Queue Failure-Safe
- Add capped retry behavior per thought.
- Persist raw text to `Inbox` after synthesis failure instead of rotating forever.
- Expose queue state to the store:
  - pending count
  - current item
  - last failure
  - completed item callback
- Ensure every valid transcript reaches `ContextManager.appendThought(...)`.

### 8. Repair Test and Dev Workflow
- Add `typecheck` script using `tsc --noEmit`.
- Add/repair Jest mocks for:
  - `react-native-fs`
  - `react-native-permissions`
  - `whisper.rn`
  - LiteRT native module
  - `react-native-sherpa-onnx` if still imported
- Split validation into fast unit tests and native/manual smoke tests.
- Keep experimental scripts documented or move them later; do not rely on them for MVP validation.

### 9. Align Documentation
- Keep the implementation tracker docs and JSON in sync: `implementation/README.md`, `implementation/index.md`, `implementation/status.json`, and `implementation/phases.json`.
- Document foreground-only wake-word clearly.
- Document LiteRT as the target synthesis runtime and Android/NPU as deferred work.

## Test Plan

Unit tests:
- `App.tsx` renders with no model assets available.
- Manual save writes to `context.md` and refreshes sections.
- Disabled manual/push/wake settings prevent those actions.
- Missing LiteRT saves raw text under `Inbox`.
- LiteRT malformed JSON falls back without losing the thought.
- Queue retries are capped.
- Context parsing handles missing file, malformed markdown, duplicate topics, empty topic, and repeated appends.

Native/mock tests:
- Mock LiteRT native module returns `topic`, `refinedText`, and `tags`.
- Mock LiteRT unavailable path falls back to heuristic/raw persistence.
- Mock Whisper unavailable path disables push-to-record without crashing.
- Foreground wake-word toggle starts/stops only while app is active.

Validation commands:
- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run ios` for iOS simulator smoke test after pods are restored.

Manual scenarios:
- Launch with no models, save typed thought, confirm `Inbox` fallback.
- Launch with Whisper and LiteRT assets, record a thought, confirm synthesized section appears.
- Toggle wake-word off and confirm foreground listener stops.
- Toggle push-to-record off and confirm record control is disabled.
- Disable LiteRT and confirm raw fallback still saves.

## Execution Order

1. Repair `App.tsx`, store state, and `ContextManager` path setup so the app can launch and manually save.
2. Add settings toggles and make disabled features visibly unavailable.
3. Refactor synthesis behind the runtime interface with `Inbox` fallback.
4. Add LiteRT iOS bridge and TypeScript runtime wrapper.
5. Stabilize push-to-record and foreground wake-word behavior.
6. Harden queue failure behavior.
7. Repair tests and validation scripts.
8. Align README, progress, and backlog docs.

## Risks
- LiteRT full-synthesis model availability may become the main blocker; the app must still work through fallback persistence.
- Native iOS LiteRT bridge work adds complexity to the MVP, so the bridge surface must stay small.
- Foreground wake-word may need a different engine than the current Sherpa placeholder; keep the feature gated by readiness.
- Android build currently has native packaging/disk-space issues and should not block the iOS-first MVP.
- Runtime settings are not persistent in this milestone by design.

## Acceptance Criteria
- The app compiles and launches on iOS simulator.
- Manual capture, push-to-record, and foreground wake-word are represented in UI settings and obey their toggles.
- A valid thought is always persisted, either synthesized by LiteRT or saved raw under `Inbox`.
- LiteRT is no longer coupled directly to UI, queue, or persistence concerns.
- Tests cover the fallback paths that protect against data loss.
- Documentation no longer claims unverified background, hardware trigger, Android NPU, or agent-sync behavior.
