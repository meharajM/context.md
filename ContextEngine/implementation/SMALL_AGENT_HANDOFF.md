# Small Agent Handoff

This file is the compact entrypoint for small-context coding agents.

## Start Here

1. Read `implementation/status.json`.
2. Use `currentPhase` to find one phase object in `implementation/phases.json`.
3. Work only on the earliest incomplete slice in that phase.
4. Read only the `info.md` files for directories you will edit.
5. After changes, run the phase validation commands you can run.
6. Append evidence to `implementation/status.json` (you can use `npm run update-status` to automate this).

## Current Phase

As of 2026-05-29:

- Current phase: `phase-09-headset-triple-tap-trigger`
- Current status: `not_started`
- Next safe slice: slice 1, headset button triple-tap detection and debounce logic
- Keep trigger behavior on the standard capture pipeline; do not duplicate recording flows.
- Latest validation: `npm run typecheck -- --pretty false`, focused Jest coverage, and simulator launch on 2026-05-29.

## Minimum Files To Read For Phase 09

- `implementation/status.json`
- `implementation/phases.json`, only `phase-09-headset-triple-tap-trigger`
- `app-behaviour.md`, sections 6, 11, and 16
- `info.md`
- `src/modules/ContextManager/info.md`
- `src/modules/SynthesisEngine/info.md`
- `src/core/info.md`
- `src/shared/hooks/info.md`
- `src/features/settings/info.md`
- `ios/ContextEngine/info.md`
- Add feature-level `info.md` only when editing that feature directory.

## Phase 09 Task Order

1. Implement triple-tap headset button detection and debounce logic.
2. Map triple-tap to standard capture start/stop transitions.
3. Surface readiness guidance when audio is unavailable.
4. Reuse the existing capture, transcription, queueing, and fallback pipeline.
5. Run validation and update tracker evidence.

## Safety Rules

- Never drop a non-empty capture.
- Keep raw fallback to `Inbox`.
- Do not claim free-form assistant parsing beyond intents/shortcuts.
- Preserve queue/persistence invariants when assistant content arrives.
- Do not edit generated build outputs or model binaries.

## Evidence Format

Append short evidence strings to `status.json.phases[phase].evidence`.

Use these prefixes:

- `STARTED slice N: ...`
- `PARTIAL slice N: ... Remaining: ...`
- `DONE slice N: ... Validation: ...`
- `BLOCKED slice N: ... Evidence: ...`

You can automate appending these messages using the status script:
- To start a slice: `npm run update-status -- --slice N --started --evidence "Beginning layout"`
- To record progress: `npm run update-status -- --slice N --partial --evidence "Finished layout" --remaining "Events"`
- To mark slice complete: `npm run update-status -- --slice N --done --evidence "Finished event handlers" --validation-msg "Jest passed"`
- To block a slice: `npm run update-status -- --slice N --blocked-slice --evidence "Microphone crash" --slice-blocker "Access permission issue"`

## Validation

Use the active phase validation first while developing a slice:

```sh
npm run validate:current-phase
```

Before marking a slice done, committing, or advancing the phase, also run:

```sh
npm run validate:regression
```

Equivalent expanded commands:

```sh
npm run typecheck -- --pretty false
npm test -- --runInBand src/modules/SynthesisEngine src/modules/ContextManager src/features/reflections src/features/threads src/features/queue
npm test -- --runInBand __tests__/App.test.tsx
```

Regression validation is intentionally broader than the current phase and can catch stale tests, type fallout, and behavior regressions outside the touched slice.

Known blocker:

```sh
npm run lint
```

Lint currently fails before linting files with `Environment key "jest/globals" is unknown`.
