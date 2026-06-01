# `scripts` Architecture

Project scripts directory.

## Active Scripts

- `validate-current-phase.js`: reads `implementation/status.json.currentPhase`, loads the matching phase from `implementation/phases.json`, and runs that phase's `validation` commands in order. Safe for local and CI use when the listed phase commands are supported by the environment.
- `real-device-qa.js`: runs repeatable real iOS device QA through a live WebDriverAgent endpoint, captures XML evidence snapshots, and writes a behavior summary JSON under `artifacts/real-device-qa/<timestamp>/`. Local/manual only (requires connected unlocked iPhone + WDA).

Before adding scripts, document their purpose, required environment, and whether they are safe to run in CI or only intended for local/manual use.
