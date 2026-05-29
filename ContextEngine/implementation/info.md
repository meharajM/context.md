# `implementation` Architecture

This directory is the canonical implementation tracker for coding agents.

## Files

- `status.json`: machine-readable current state and phase status. Read this first.
- `phases.json`: compact task specs keyed by phase id.
- `README.md`: tracker operating rules.
- `index.md`: human-readable summary.
- `*.png`: simulator/QA screenshots used as evidence.

## Current State

As of `status.json` dated 2026-05-29:

- Current phase: `phase-09-headset-triple-tap-trigger`.
- Current phase status: `not_started`.
- Phases 00 through 08 are marked `validated`.
- LLM plan phases 1 through 8 are implemented; release and roadmap validation are reflected in `index.md`.
- Android LiteRT/NPU is deferred.
- Primary synthesis runtime is LiteRT.
- Required capture modes are manual save, push-to-record, foreground wake-word, and assistant intents/shortcuts.

## Agent Workflow

1. Read `status.json`.
2. Read only the matching object in `phases.json`.
3. Use `index.md` for human context.
4. Update tracker files only when implementation state changes.
