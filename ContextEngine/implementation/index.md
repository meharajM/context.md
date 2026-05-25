# Context Engine Implementation Tracker

This directory intentionally has a small surface area so coding agents do not get conflicting instructions.

## Agent Read Order

1. Read `status.json` first. It is the canonical progress and resume state.
2. Read `phases.json` second. Use only the object matching `status.json.currentPhase`.
3. Use `../plan.md` only for broader context if a phase is unclear.
4. After finishing a phase, update `status.json` with status, validation evidence, blockers, and next phase.

## Do Not Read Old Phase Pages

The detailed HTML phase pages were removed to prevent duplicate instructions. The source of truth is now `status.json` plus `phases.json`.
