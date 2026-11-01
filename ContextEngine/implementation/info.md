# `implementation` Architecture

This directory is the canonical implementation tracker for coding agents.

## Files

- `status.json`: machine-readable current state and phase status. Read this first.
- `phases.json`: compact task specs keyed by phase id.
- `README.md`: tracker operating rules.
- `index.md`: human-readable summary.
- `*.png`: simulator/QA screenshots used as evidence.

## Current State

- Current phase: `phase-11-roadmap-hardening-and-release-qa`, in progress.
- Release scope: typed note -> local synthesis -> topic/context filing on iOS and Android, plus opt-in Android headset/on-screen voice capture with local transcription.
- Audio import, wake word, assistant voice, and spoken summaries remain future scope. iOS user-started in-app voice capture and local reminders are implemented; Android retains its independent widget recorder and background synthesis retry.
- Follow current `status.json` evidence; old phase validation is historical, not proof of present release readiness.
- The 2026-10-29 final submission audit is recorded at `artifacts/play-console/submission-audit-2026-10-29/review.md`; current source validation does not make the older uploaded AAB ready.

## Agent Workflow

1. Read `status.json`.
2. Read only the matching object in `phases.json`.
3. Use `index.md` for human context.
4. Update tracker files only when implementation state changes.
