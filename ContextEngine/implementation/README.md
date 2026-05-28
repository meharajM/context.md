# Implementation Tracker

This directory is the working tracker for coding agents.

Use these files together:
- `status.json` is the canonical resume state.
- `phases.json` contains the current phase/task spec.
- `index.md` is the human-readable entrypoint and summary.
- `README.md` is the operating instruction set for the tracker.
- `../app-behaviour.md` is the target behavior roadmap and QA oracle.
- `../AGENTS.md` contains project-level agent rules that must be followed before and after code changes.
- `../info.md` and nested `info.md` files contain architecture notes that must be read before editing matching directories.

## Agent Rules

1. Read `status.json` first.
2. Read only the `phases.json` object whose key matches `status.json.currentPhase`.
3. Read `index.md` for the human summary of the current state.
4. Read `../app-behaviour.md` when the task touches user-facing behavior or QA scope.
5. Pick the earliest incomplete slice in the active phase unless the user assigns a specific slice.
6. Implement only the current phase tasks and selected slice.
7. Update `status.json` after changes, validation, blockers, or phase advancement.
8. Keep `index.md` synchronized with the current phase and any important tracker notes.
9. Use `../plan.md` only for broader context when the current phase is unclear.
10. Read relevant `info.md` files before coding and update them when architecture or behavior changes.

## Multi-Agent Coordination

- `status.json.phases[phase].evidence` is the append-only handoff log.
- Use evidence entries to record slice starts, partials, validation results, blockers, and completion.
- Prefix partial slice evidence with `PARTIAL:` and blocker evidence with `BLOCKED:`.
- Future agents must continue the earliest `PARTIAL:` slice before starting a new one, unless explicitly told otherwise.
- When a shared contract changes, update the nearest `info.md` and mention the contract in evidence.
- Keep phase gates conservative. A phase can be `done` only after implementation is complete; it can be `validated` only after validation passes.

## Do Not Read Old Phase Pages

The old detailed HTML phase pages were removed to avoid duplicate instructions. The source of truth is the tracker set above.
