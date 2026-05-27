# Functional QA Fix Plan

Date: 2026-05-26
Device: iPhone 16 simulator, iOS 18.6
Bundle: `com.meharaj.contextengine`
Phase: `phase-05-tests-docs-release`

## Validation Summary

Commands run:

- `npm run typecheck -- --pretty false` passed.
- `npm run lint` passed.
- `npm test -- --runInBand` passed: 8 suites, 29 tests.
- `npm run ios -- --no-packager` built, installed, and launched the app on the booted simulator.

Simulator flows exercised:

- App launch: successful.
- Manual typed capture: successful. A simulator thought was queued, synthesized, persisted, and shown under an existing topic.
- Queue view: active job appeared, then cleared after synthesis completed.
- Settings model status: selected Gemma3-1B-IT displayed as ready on device.
- Manual capture toggle: turning it off prevented text entry on the composer.
- Wake-word toggle: stayed off because wake-word readiness is unavailable.
- Push-to-record: starts recording, but stop interaction is unreliable and can leave the UI in recording state for too long.

Crash evidence:

- Multiple prior `ContextEngine` crash reports exist on the simulator.
- Latest inspected crash: `ContextEngine-2026-05-26-234406.ips`.
- Crash type: `EXC_BAD_ACCESS / SIGSEGV`.
- Faulting image includes `CLiteRTLM.framework`, indicating native LiteRT-LM can crash outside JavaScript error handling.

Release blocking issues:

1. Native LiteRT-LM can crash the app instead of falling back to raw `Inbox` persistence.
2. Push-to-record can appear stuck in the stop state and does not provide reliable user feedback while stopping/transcribing.
3. The app shows a React Native warning banner in the simulator, which should be zero before release.
4. Release validation is still mostly manual; there is no automated simulator smoke test that proves launch, capture, queue clear, settings toggles, and crash-free execution.

## Phase 1 - Stabilize Native LiteRT Runtime

Status: done. The native crash-containment slice shipped on 2026-05-27 and the tracker evidence now reflects the validated simulator build + unit test pass.

Goal: LiteRT failure must never crash the app or block thought persistence.

Code changes:

- In `ios/ContextEngine/LiteRtModule.swift`, isolate all `Engine`, `Conversation`, and `Conversation.sendMessage` calls behind a single serialized execution queue or actor.
- Add a native timeout for `synthesize(...)`. If the conversation does not return within the release budget, reject with `LITERT_SYNTHESIS_TIMEOUT`.
- Ensure `releaseLoadedModel()` cannot run concurrently with `loadModel(...)` or `synthesize(...)`.
- Stop reusing a potentially corrupted `Conversation` after a synthesis error. On error, nil out `conversation` and `engine`, reject to JS, and require reinitialization.
- Include model path, backend, max token count, and LiteRT state in every native rejection message.
- Add a simulator-only guard for known unsupported LiteRT configurations if the selected model/backend combination is unstable under iOS Simulator.

TypeScript changes:

- In `src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts`, wrap `LiteRtModule.synthesize(...)` in a JS timeout as a second line of defense.
- Mark the runtime not ready after any native synthesis failure so the next thought goes directly to raw fallback or forces a clean reinitialize.
- Return a detailed `RuntimeReadiness` status for native crash-risk states, such as unsupported simulator backend.

Queue changes:

- In `src/modules/SynthesisEngine/ProcessingQueueManager.ts`, add test coverage for slow/hanging `SynthesisService.synthesize(...)`.
- Keep `MAX_ATTEMPTS = 2`, but add a per-attempt timeout so the queue cannot remain in `PROCESSING` forever.

Tests:

- Add a `SynthesisService` test where LiteRT initialization succeeds but synthesis rejects; assert raw `Inbox` fallback.
- Add a queue test where synthesis never resolves; assert timeout, fallback append, and queue clear.
- Add a native smoke checklist in `docs/litert-evaluation.md` for crash report inspection after simulator synthesis.

Acceptance:

- No new `ContextEngine` crash report after 10 simulator manual captures.
- A native LiteRT error appears as raw `Inbox` persistence, not an app crash.
- Queue returns to clear state after success, rejection, or timeout.

## Phase 2 - Fix Push-to-Record Stop Reliability

Status: done. The recording-state slice shipped on 2026-05-27 and was verified with unit tests plus five live simulator start/stop cycles returning to `Start Recording`.

Goal: the record button must be a trustworthy two-state control.

Code changes:

- In `src/core/store.ts`, split recording into explicit states: `idle`, `starting`, `recording`, `stopping`, `transcribing`, `error`.
- Disable duplicate presses only during `starting` and `stopping`; allow exactly one stop action while `recording`.
- Move `set({ isRecording: false })` into a `finally` block in `stopCapture()` so UI state is reset on all outcomes.
- Preserve the current `No speech` behavior, but also clear any stale transcript before each start.
- Set status to `Stopping...` before awaiting `audioEngine.stopRecording()`.

Audio changes:

- In `src/modules/AudioEngine/AudioEngineImpl.ts`, unsubscribe the realtime capture listener on stop if `whisper.rn` exposes an unsubscribe method.
- Always clear `realtimeCapture` in `stopRecording()` after attempting `stop()`.
- Add a timeout around `realtimeCapture.stop()` and return the latest transcript if timeout is hit.
- Capture `event.error` from realtime subscription and surface it through `stopRecording()`.

UI changes:

- In `src/features/capture/CaptureComposerView.tsx`, show distinct visual states for `starting`, `recording`, and `stopping`.
- Keep the stop button accessible with a descriptive label such as `Stop Recording`.

Tests:

- Add store tests for start failure, stop success with transcript, stop with empty transcript, stop rejection, and stop timeout.
- Add a component test asserting the record button changes label/state across recording states.

Acceptance:

- A simulator recording can be started and stopped 5 times in a row without the stop icon getting stuck.
- Empty audio never queues blank thoughts.
- Non-empty transcription queues exactly one thought.

## Phase 3 - Remove Release Warnings

Status: done. The startup warning banner was removed by switching the whisper import to the React Native source entry and demoting the missing-model notice to a non-warning log; the app shell test and live simulator launch both verified the clean startup path on 2026-05-27.

Goal: app launch should not show a runtime warning banner.

Code changes:

- Run the app with Metro attached and inspect the warning shown by the in-app banner.
- Fix the underlying warning instead of hiding LogBox globally.
- Import whisper through `whisper.rn/src/index` so Metro resolves the module without the package-root fallback warning.
- Demote the missing-model startup notice to a normal log because readiness state already surfaces the condition in the UI.
- Likely areas to inspect first:
  - duplicate/unlabeled accessibility text from icon wrappers,
  - deprecated React Native prop usage,
  - NativeEventEmitter/native module warning from third-party libraries,
  - non-serializable values crossing the native bridge.

Tests:

- Add a Jest spy around `console.warn`/`console.error` in the app shell test and fail on unexpected warnings.
- Add a simulator smoke script that checks the screen tree does not contain the warning banner text.
- Verify the live simulator launches to the normal app shell with no redbox or warning banner.

Acceptance:

- App launch shows no React Native warning banner.
- Jest app shell test fails on newly introduced warnings.
- Live simulator launch reaches the home shell without the warning banner.

## Phase 4 - Automated Simulator Smoke Test

Goal: make the release gate reproducible without hand tapping.

Code changes:

- Replace ad hoc scripts such as `verify_sim.js` and `functional_test.js` with one maintained simulator script under `scripts/` or `e2e/`.
- Use stable `testID`s already present:
  - `thought_input`
  - `save_button`
  - `record_button`
  - `tab_queue`
  - `tab_settings`
  - `switch_manual`
  - `switch_wakeword`
  - `switch_litert`
- Add missing `testID`s for queue clear status, settings diagnostics, and active model status.
- Make the script install/launch the app, enter a unique thought, save, wait for queue clear, navigate back, and assert the thought appears in reflections.
- Add crash report count before/after the run and fail if a new `ContextEngine` crash appears.

Package changes:

- Add `npm run test:simulator:smoke`.
- Keep `npm run test:e2e` for Detox once Detox config is repaired.

Acceptance:

- `npm run test:simulator:smoke` launches the app and proves manual capture persistence on the iPhone 16 simulator.
- The smoke test detects new native crashes.

## Phase 5 - Documentation and Tracker Alignment

Goal: docs describe verified behavior, not intended behavior.

Code/doc changes:

- Update `docs/litert-evaluation.md` to replace the stale disk-space blocker with the current state:
  - Gemma3-1B-IT is installed on this simulator.
  - LiteRT synthesis can complete at least one manual capture.
  - Native crash reports still exist and must be treated as release blockers.
- Update `README.md` validation notes with the simulator smoke command after Phase 4.
- Update `implementation/status.json` evidence only after each acceptance criterion passes.
- Keep `implementation/index.md` in sync with the current release blocker list.

Acceptance:

- Tracker, README, and LiteRT docs all agree on what is verified.
- `phase-05-tests-docs-release` remains `in_progress` until the simulator smoke and crash-free gates pass.

## Recommended Order

1. Fix native LiteRT crash containment first because it can invalidate every higher-level QA result.
2. Fix push-to-record state handling next because it is a core MVP capture path.
3. Remove the warning banner so release QA starts from a clean app.
4. Add the simulator smoke test to prevent regressions.
5. Update release docs and mark tracker evidence only after the gates are green.
