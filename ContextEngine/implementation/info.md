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
- Android production: 1.0.7 / code 8 is published on Google Play at 100% rollout as of 2026-11-08. See docs/marketing-and-release-plan.md for current launch planning.
- Release scope: typed note -> local synthesis -> topic/context filing on iOS and Android, plus Android app/widget voice capture with local transcription.
- Meeting mode is implemented in source but is not part of Android production 1.0.7. Redmi physical QA covers background recording, sharing, saving, and five-minute WAV deletion. A controlled foreground run confirmed a live transcript chunk at 00:52 before Stop, with about 32 seconds of chunk lag and noisy recognition; LiteRT summary fell back. Thermal HAL reached 51°C/status 3 during the short run. One-hour behavior, a generated summary on capable hardware, destination-app delivery, and iOS device QA remain open.
- Audio import, wake word, assistant voice, and spoken summaries remain future scope. iOS user-started in-app voice capture, local reminders, and opportunistic BGProcessingTask synthesis are implemented; Android has its independent widget recorder and OS-scheduled synthesis retry.
- Follow current `status.json` evidence; old phase validation is historical, not proof of present release readiness.
- Phase 11 remains open for physical Android voice/UIDT/Balanced-device checks, enlarged text, and iOS device/publication validation. The 2026-10-29 final submission audit is historical at artifacts/play-console/submission-audit-2026-10-29/review.md.

## Agent Workflow

1. Read `status.json`.
2. Read only the matching object in `phases.json`.
3. Use `index.md` for human context.
4. Update tracker files only when implementation state changes.
