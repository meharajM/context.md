# Implementation Tracker

This directory is the working tracker for coding agents.

Use these files together:
- `status.json` is the canonical resume state.
- `phases.json` contains the current phase/task spec.
- `index.md` is the human-readable entrypoint and summary.
- `README.md` is the operating instruction set for the tracker.
- `../AGENTS.md` contains project-level agent rules that must be followed before and after code changes.
- `../info.md` and nested `info.md` files contain architecture notes that must be read before editing matching directories.

## Agent Rules

1. Read `status.json` first.
2. Read only the `phases.json` object whose key matches `status.json.currentPhase`.
3. Read `index.md` for the human summary of the current state.
4. Implement only the current phase tasks.
5. Update `status.json` after changes, validation, blockers, or phase advancement.
6. Keep `index.md` synchronized with the current phase and any important tracker notes.
7. Use `../plan.md` only for broader context when the current phase is unclear.
8. Read relevant `info.md` files before coding and update them when architecture or behavior changes.

## Do Not Read Old Phase Pages

The old detailed HTML phase pages were removed to avoid duplicate instructions. The source of truth is the tracker set above.
