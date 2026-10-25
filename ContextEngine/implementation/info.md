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
- Audio import, wake word, assistant voice, spoken summaries, and iOS voice capture remain future scope.
- Follow current `status.json` evidence; old phase validation is historical, not proof of present release readiness.

## Agent Workflow

1. Read `status.json`.
2. Read only the matching object in `phases.json`.
3. Use `index.md` for human context.
4. Update tracker files only when implementation state changes.
