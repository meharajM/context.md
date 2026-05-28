# Small Agent Handoff

This file is the compact entrypoint for small-context coding agents.

## Start Here

1. Read `implementation/status.json`.
2. Use `currentPhase` to find one phase object in `implementation/phases.json`.
3. Work only on the earliest incomplete slice in that phase.
4. Read only the `info.md` files for directories you will edit.
5. After changes, run the phase validation commands you can run.
6. Append evidence to `implementation/status.json`.

## Current Phase

As of 2026-05-28:

- Current phase: `phase-06-note-edit-and-topic-linking`
- Current status: `in_progress`
- Next safe slice: slice 1, stable note identity and source metadata types
- Do not start UI work until slice 1 and slice 2 contracts are done.
- Latest validation: `npm run validate:current-phase` and `npm run validate:regression` pass.

## Minimum Files To Read For Phase 06

- `implementation/status.json`
- `implementation/phases.json`, only `phase-06-note-edit-and-topic-linking`
- `app-behaviour.md`, sections 3, 4, 11, and 12
- `info.md`
- `src/modules/ContextManager/info.md`
- `src/modules/SynthesisEngine/info.md`
- `src/core/info.md`
- `src/shared/notes/info.md` when working with note identity or source metadata.
- Add feature-level `info.md` only when editing that feature directory.

## Phase 06 Slice Order

1. Define note identity and source metadata types.
2. Add persisted note read/update/remove helpers in `ContextManager`.
3. Add queue edit/remove/requeue behavior in `ProcessingQueueManager` and store.
4. Add edit screen for queue items.
5. Add edit entry points for Inbox/thread persisted notes.
6. Add source metadata modal.
7. Add searchable topic selector.
8. Add selected-topic one-pass and auto-topic two-pass synthesis behavior.
9. Run validation and update tracker evidence.

## Safety Rules

- Never drop a non-empty capture.
- Keep raw fallback to `Inbox`.
- Remove an original Inbox item only after a categorized replacement is written.
- Preserve original source metadata when editing or re-synthesizing.
- Do not mark planned behavior as implemented until code and tests exist.
- Do not edit generated build outputs or model binaries.

## Evidence Format

Append short evidence strings to `status.json.phases[phase].evidence`.

Use these prefixes:

- `STARTED slice N: ...`
- `PARTIAL slice N: ... Remaining: ...`
- `DONE slice N: ... Validation: ...`
- `BLOCKED slice N: ... Evidence: ...`

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
