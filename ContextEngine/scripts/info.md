# `scripts` Architecture

Project scripts directory.

## Active Scripts

- `validate-current-phase.js`: reads `implementation/status.json.currentPhase`, loads the matching phase from `implementation/phases.json`, and runs that phase's `validation` commands in order. Safe for local and CI use when the listed phase commands are supported by the environment.

Before adding scripts, document their purpose, required environment, and whether they are safe to run in CI or only intended for local/manual use.
