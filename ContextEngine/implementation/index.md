# Implementation Tracker

Current source of truth:
- `implementation/status.json`
- `implementation/phases.json`

Human-readable companion files:
- `implementation/README.md` for tracker instructions
- this file for the current phase summary
- `AGENTS.md` for project-level coding-agent rules
- `info.md` files for directory-level architecture notes

## Current Phase

Read `status.json.currentPhase` first, then open the matching phase object in `phases.json`.

## Notes

- Keep the tracker files in sync whenever implementation changes.
- Read `plan.md`, the active tracker phase, and relevant `info.md` files before code changes.
- Update relevant `info.md` files and tracker docs after behavior or architecture changes.
- Do not use stale markdown trackers outside this directory.
- Use `../plan.md` only when you need broader project context.

## Release QA Findings

- Functional QA plan: `../docs/functional-qa-fix-plan.md`.
- iPhone 16 iOS 18.6 simulator launch, manual capture, queue clear, settings model status, manual toggle, and wake-word unavailable state were exercised on 2026-05-26.
- Release blockers found: native LiteRT-LM crash reports and missing automated simulator smoke coverage. Push-to-record stop reliability has a phase-2 fix implemented and live-simulator verified.
- React Native startup warning banner has been removed and verified on the live simulator.
- Keep `phase-05-tests-docs-release` in progress until the crash-free simulator smoke gate passes.
- Phase 1 crash-containment work is implemented in code: native LiteRT calls are serialized, native and JS synthesis timeouts are in place, synthesis failures mark LiteRT unready, and queue attempts time out before raw `Inbox` fallback.
- Phase 2 push-to-record work is implemented in code: the store tracks explicit recording phases, audio stop clears realtime capture handles, stop timeouts no longer leave the UI stuck, and the record button exposes state-specific accessibility labels.
