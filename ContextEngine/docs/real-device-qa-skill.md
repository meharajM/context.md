# Real Device QA Skill Guide

This guide mirrors the project-local skill at `skills/real-device-qa/SKILL.md` and defines a repeatable physical iPhone QA flow.

## Run

```sh
npm run qa:real-device
```

Optional overrides:

```sh
node scripts/real-device-qa.js --wda http://192.168.29.124:8100 --bundle com.meharaj.contextengine
```

## Prerequisites

1. Connected, trusted, and unlocked iPhone.
2. App installed on device.
3. WebDriverAgent reachable (`curl http://<device-ip>:8100/status` returns `ready: true`).

## Output

Artifacts are written to:

`artifacts/real-device-qa/<timestamp>/`

Key files:

- `qa_results.json`: summary booleans for manual capture, queue tab checks, and voice state checks.
- `*.xml`: UI source snapshots used as evidence.

## Expected Usage

- Compare outcomes with `app-behaviour.md`.
- File issues for any behavior mismatch with artifact file references.
- Separate environment/tooling blockers from app regressions.
