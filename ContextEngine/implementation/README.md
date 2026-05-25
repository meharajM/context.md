# Implementation Tracker

Machine-readable entrypoint for coding agents:

1. Read `status.json`.
2. Read only the `phases.json` object whose key matches `status.json.currentPhase`.
3. Implement only that phase.
4. Run the phase validation commands.
5. Update `status.json` with status, evidence, blocker if any, and next `currentPhase`.

Status meanings:
- `not_started`: do not implement until dependencies are validated.
- `in_progress`: continue here.
- `blocked`: stop and resolve blocker first.
- `done`: code done, validation not complete.
- `validated`: phase complete; next phase may start.

Human-readable tracker starts at `index.md`.
