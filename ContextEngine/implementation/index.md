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
