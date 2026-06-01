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

Active phase as of 2026-05-29:
- `phase-09-headset-triple-tap-trigger` (`in_progress`)

## Continue Current Phase

When the user says "continue current phase" or "continue from where we left":

1. Read `implementation/status.json`.
2. If context budget is small, read `implementation/SMALL_AGENT_HANDOFF.md`.
3. Open `phase-09-headset-triple-tap-trigger` in `implementation/phases.json`.
4. Implement the active phase tasks in order, starting with headset button detection and capture gating before later slices.
5. Run the focused validation for touched modules, then append evidence to `status.json`.
6. Do not advance to phase 10 until phase 09 gate is satisfied.

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
- Validation on 2026-05-27 passed `npm run typecheck -- --pretty false` and `npm test -- --runInBand` with 14 suites and 69 tests. `npm run lint` remains blocked by the existing ESLint config error: `Environment key "jest/globals" is unknown`.
- 2026-05-29 simulator bootstrap redbox cleared after fixing the assistant capture hook's native event emitter construction; fresh simulator launch now reaches the home shell and a screenshot confirms normal UI rendering.
- 2026-06-01 phase-09 trigger implementation is in progress: iOS native triple-tap event emission, JS hook wiring to existing capture start/stop, and spoken+visual readiness guidance have been added; physical-device headset validation is still pending.

## Roadmap Expansion (2026-05-28)

- `app-behaviour.md` now governs target behavior as a roadmap with explicit `Implemented` vs `Planned` states.
- New execution phases were added:
  - phase 06: note edit + topic-linking acceleration
  - phase 07: voice error surfaces + audio retention fallback
  - phase 08: assistant intents/shortcuts ingestion
  - phase 09: headset triple-tap trigger
  - phase 10: import + permissioned merge
  - phase 11: roadmap hardening + release QA
- Hardware trigger and intents are active scope roadmap items; they are not yet marked as implemented behavior.
