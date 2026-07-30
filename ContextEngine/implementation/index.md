# Implementation Tracker

Current source of truth:
- `implementation/status.json`
- `implementation/phases.json`

Human-readable companion files:
- `implementation/README.md` for tracker instructions
- `implementation/SMALL_AGENT_HANDOFF.md` for small-context coding agents
- this file for the current phase summary
- `AGENTS.md` for project-level coding-agent rules
- `info.md` files for directory-level architecture notes

## Current Phase

Read `status.json.currentPhase` first, then open the matching phase object in `phases.json`.

Active phase as of 2026-07-18:
- `phase-11-roadmap-hardening-and-release-qa` (`in_progress`)

## Continue Current Phase

When the user says "continue current phase" or "continue from where we left":

1. Read `implementation/status.json`.
2. If context budget is small, read `implementation/SMALL_AGENT_HANDOFF.md`.
3. Open `phase-11-roadmap-hardening-and-release-qa` in `implementation/phases.json`.
4. Resolve the legitimate headset audio/Now Playing eligibility contract, run physical-device QA on connected iOS and Android hardware, then complete owner-managed App Store and Play signing/submission setup.
5. Run the focused validation for touched modules, then append evidence to `status.json`.
6. Do not consider the roadmap complete until phase 11 gate is satisfied on both simulator and physical device.
7. Current gate nuance: capture/synthesis/delete hardening, lint, 145 Jest tests, shared iOS/Android E2E, debug native builds, generated screenshot sets, the minified APK/AAB build, and Android 16 KB validation are green. Reliable global earphone delivery is still planned because neither platform routes media commands to this non-playing app without legitimate audio/Now Playing eligibility. Physical-device QA, production signing, published privacy metadata, asset approval, and store-console submission remain.

## Multi-Agent Handoff

- Multiple coding agents may work this roadmap over time; the tracker must remain sufficient without chat history.
- Agents should claim progress by appending evidence in `status.json`, not by relying on conversation memory.
- Continue any `PARTIAL:` evidence before starting a new slice.
- Keep shared contracts in `info.md` files, especially note identity, metadata shape, queue contracts, and synthesis route behavior.
- If parallel work is requested, split only along the `parallelization` guidance in the active phase.

## Notes

- Keep the tracker files in sync whenever implementation changes.
- Read `plan.md`, the active tracker phase, and relevant `info.md` files before code changes.
- Update relevant `info.md` files and tracker docs after behavior or architecture changes.
- Do not use stale markdown trackers outside this directory.
- Use `../plan.md` only when you need broader project context.

## Release QA Findings

- Functional QA plan archived in the tracker history.
- iPhone 16 iOS 18.6 simulator launch, manual capture, queue clear, settings model status, manual toggle, and wake-word unavailable state were exercised on 2026-05-26.
- Resolved release blockers: native LiteRT-LM crash containment is implemented in code and covered by unit tests, push-to-record stop reliability has been live-simulator verified, and the React Native startup warning banner has been removed.
- `phase-05-tests-docs-release` is complete after live simulator validation.
- Phase 1 crash-containment work is implemented in code: native LiteRT calls are serialized, native and JS synthesis timeouts are in place, synthesis failures mark LiteRT unready, and queue attempts time out before raw `Inbox` fallback.
- Phase 2 push-to-record work is implemented in code: the store tracks explicit recording phases, audio stop clears realtime capture handles, stop timeouts no longer leave the UI stuck, and the record button exposes state-specific accessibility labels.
- Live simulator validation on 2026-05-27 confirmed a 10-capture smoke run with queue clear and no new `ContextEngine` crash report.
- Download progress presentation now stays in progress state until the installed model refresh completes, avoiding a temporary return to "Not downloaded".
- Inbox fallback entries can be requeued for topic classification. The queue excludes `Inbox` from semantic candidate topics, removes the original Inbox entry after successful categorization, and avoids duplicate fallback entries if synthesis fails again.
- Thread details now use the native share sheet for general context sharing and AI-oriented analysis prompts, so compatible installed AI apps can receive the thread content.
- 2026-06-29 lint/workaround follow-up is complete: `npm run lint` now passes cleanly and the NativeEventEmitter deep-import compatibility path is documented inline where the current Jest/native setup still requires it.
- 2026-05-29 simulator bootstrap redbox cleared after fixing the assistant capture hook's native event emitter construction; fresh simulator launch now reaches the home shell and a screenshot confirms normal UI rendering.
- 2026-06-01 phase-09 trigger implementation landed: iOS native triple-tap event emission, JS hook wiring to existing capture start/stop, and spoken+visual readiness guidance are in place.
- 2026-06-26 phase-10 import and permissioned merge validation passed on the iPhone 16 simulator, including simulator build/install/launch and simulator E2E coverage for text and voice import.
- 2026-06-29 phase-11 simulator validation passed again after release-hardening cleanup: `npm run typecheck -- --pretty false`, `npm run lint`, `npm test -- --runInBand`, `npm run ios`, and `npm run test:e2e` all succeeded.
- 2026-07-18 automatic iOS signing successfully obtained a development profile and produced `build/ContextEngine.xcarchive`; the prior provisioning blocker is resolved.
- 2026-07-18 the Android release pipeline produced a signed, minified, resource-shrunk AAB using externally supplied validation credentials. The real Play upload key remains owner-managed.
- 2026-07-18 remediation validation passed: typecheck, lint, 24 Jest suites / 127 tests, 4/4 Detox journeys on iPhone 16, 4/4 on Android 11, iOS Debug build, Android Debug/AndroidTest APK builds, and 5/5 Android headset-gate tests.
- 2026-07-18 headset runtime probes proved that Android leaves a flagged foreground MediaSession unselected without actual playback, even when temporarily reporting PLAYING. The probe was reverted; reliable Android delivery and iOS Now Playing eligibility remain planned, with no silent/fake playback workaround.
- 2026-07-18 final validation passed: typecheck, lint, 25 Jest suites / 145 tests, shared Detox 4/4 on both platforms, minified release APK/AAB creation, and 16 KB compatibility for all 15 packaged arm64 libraries.
- 2026-07-18 deterministic store assets passed preflight: 4 iPhone `1320 x 2868`, 4 iPad `2064 x 2752`, and 4 Play phone `1080 x 2160` alpha-free screenshots.
- 2026-07-18 release preflight is 12/17. Remaining gates: Xcode 26+, Apple Distribution identity, Play upload credentials, placeholder-free published privacy policy, and the store-submission draft fields.
- 2026-07-18 synthesis routing hardening now compares candidate topics against persisted content, rejects generic/first-topic defaults, and holds genuinely ambiguous items in the queue with a focused question and 2–3 selectable topic options until resolved.
- 2026-07-18 internal free space was raised to 37 GB without relocating Codex, agents, runtimes, or plugins. Occasional apps and recoverable Xcode cache/device-support data were moved to the connected APFS SSD.
- 2026-07-18 git-ignored Apple/Play credential inputs, publisher/store metadata wiring, and import helpers were added; the disk gate now passes and release preflight is 12/17.
- 2026-06-01 compiled-target EventEmitter mismatch was fixed after real-device QA exposed a startup redbox for `HeadsetTripleTapRequested`.
- 2026-06-01 to 2026-06-02 real-device QA narrowed the first blocker to an iOS jetsam kill during the richer voice-stop flow; evidence is in `artifacts/device-crashlogs/` and `artifacts/real-device-qa/2026-06-01T18-22-06-555Z`.
- 2026-06-02 the AudioEngine now uses PCM stream -> WAV file -> single file transcription and forces CPU-only Whisper on iOS.
- 2026-06-02 direct voice persistence was restored on device by writing successful captures to `Inbox` before any synthesis step. Real-device evidence shows `ContextManager` append + save completes and the app survives the post-stop window.
- 2026-06-02 automatic post-capture synthesis was removed from the stop path as a stability containment step. The remaining QA failure is transcription quality, not durable capture persistence.

## Roadmap Expansion (2026-05-28)

- `app-behaviour.md` now governs target behavior as a roadmap with explicit `Implemented` vs `Planned` states.
- New execution phases were added:
  - phase 06: note edit + topic-linking acceleration
  - phase 07: voice error surfaces + audio retention fallback
  - phase 08: assistant intents/shortcuts ingestion
  - phase 09: headset triple-tap trigger
  - phase 10: import + permissioned merge
  - phase 11: roadmap hardening + release QA
- Hardware trigger, assistant intents, and import are now implemented and validated behavior; phase 11 is the remaining roadmap work.
