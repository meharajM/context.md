# Real Device QA Skill

Use this skill when the user asks to run QA on a physical iOS device, validate behavior from `app-behaviour.md`, or verify real-user flows.

## Purpose

Run deterministic, evidence-backed real-device QA against the iOS app using WebDriverAgent (WDA), then report pass/fail by behavior area.

## Preconditions

1. Physical iPhone connected, unlocked, and trusted.
2. App build installed (`npm run ios -- --device "<Device Name>" --no-packager` when needed).
3. WDA reachable at `http://<device-ip>:8100/status` and returns `ready: true`.
4. `app-behaviour.md` reviewed before execution.
5. `project-architecture.md` reviewed before execution so QA is mapped to the actual runtime architecture and supported flows.

## Workflow

1. Verify device/tooling health:
   - `xcrun xctrace list devices`
   - `mobilecli devices --include-offline`
   - `curl http://<device-ip>:8100/status`
2. Run scripted QA:
   - `node scripts/real-device-qa.js --wda http://<device-ip>:8100 --bundle com.meharaj.contextengine`
3. Review generated evidence:
   - JSON summary in `artifacts/real-device-qa/<timestamp>/qa_results.json`
   - XML snapshots in the same directory.
4. Map outcomes to `app-behaviour.md` implemented flows.
5. Cross-check observed behavior against `project-architecture.md` when failures may reflect routing, queue, persistence, model, or native-boundary regressions.
6. File issues for confirmed regressions with repro and evidence file paths.

## Expected Outputs

- Behavior matrix with `PASS` / `FAIL` / `INCONCLUSIVE`.
- Concrete evidence files (XML/JSON).
- GitHub issues for defects when available.

## Maintenance

- If QA work leads to a code change that alters architecture or a primary user flow, update `project-architecture.md` in the same task.

## Failure Handling

- If session creation fails with a lock error, request the device be unlocked and rerun.
- If WDA is not reachable, treat as environment blocker and report separately from app failures.
- Distinguish tooling blockers from product regressions in the final QA report.
