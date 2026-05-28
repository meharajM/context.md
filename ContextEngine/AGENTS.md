# Agent Instructions

These instructions apply to the `ContextEngine` project. Follow them before and after every coding change.

## Required Reading Before Changes

1. Read `plan.md` for the product direction, MVP boundaries, and deferred work.
2. Read `implementation/status.json` first for the canonical current phase and project state.
3. Read only the matching phase object in `implementation/phases.json` unless the task explicitly requires broader history.
4. Read `implementation/README.md` and `implementation/index.md` for tracker workflow and human-readable state.
5. Read `app-behaviour.md` when the task changes user-facing behavior, roadmap scope, or QA expectations.
6. Read the relevant `info.md` files before editing a directory. At minimum:
   - Start with `info.md` at the project root.
   - Read each `info.md` along the path to the files being changed.
   - Read sibling module or feature `info.md` files when behavior crosses boundaries.

## Coding Change Rules

- Keep changes inside the current implementation phase unless the user explicitly requests otherwise.
- In multi-agent workflows, work on one tracker `slice` at a time and record slice evidence before starting another broad slice.
- Preserve the MVP safety invariant: every non-empty thought must persist, even when audio, LiteRT, or synthesis fails.
- Do not claim unimplemented behavior as complete. Treat `app-behaviour.md` as roadmap authority and align tracker/docs before moving roadmap items into active implementation claims.
- Keep UI and feature components out of native/runtime details. Feature code should use store actions and selectors, not native modules directly.
- Keep native LiteRT access isolated behind `ios/ContextEngine/LiteRtModule.*` and `src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts`.
- Do not commit large model binaries. Document source, license, size, and checksum for any model artifact.
- Avoid editing generated files, native build outputs, Gradle caches, Xcode user data, or vendored LiteRT-LM internals unless explicitly required.

## Required Updates After Changes

After any completed task that changes code, architecture, behavior, validation status, or project scope:

1. Update the relevant directory `info.md` files so future agents understand the new architecture.
2. Update `implementation/status.json` with evidence, blocker, status, or phase advancement when implementation state changes.
3. Update `implementation/index.md` when the human-readable current state changes.
4. Update `implementation/phases.json` only when the phase task spec itself changes.
5. Update `docs/*` when user-facing setup, model, validation, platform, or runtime behavior changes.
6. Keep `README.md` aligned when the verified MVP behavior or setup commands change.

## Multi-Agent Handoff Rules

- Treat `implementation/status.json` and `implementation/phases.json` as the shared coordination contract.
- Before editing, identify the current phase and the specific slice number being worked.
- Prefer completing one slice end-to-end: code, focused tests, docs/info updates, and `status.json` evidence.
- If a slice is only partially complete, add evidence that starts with `PARTIAL:` and includes remaining work.
- Do not silently start a later slice when an earlier slice is incomplete unless the user explicitly directs parallel work.
- Avoid overlapping ownership: if another agent has recorded active or partial work for a slice, inspect that evidence and continue it instead of starting a duplicate approach.
- Keep changes scoped to the slice touch areas unless the implementation requires a shared contract change; document shared contract changes in the relevant `info.md`.
- Never mark a phase `validated` unless the phase gate and validation commands have passed or an environment blocker is explicitly recorded.

## Validation Expectations

Use the validation listed in the active phase. For the current release/readiness phase, prefer:

```sh
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

Native validation such as `cd ios && bundle exec pod install` or `npm run ios` should be run when native iOS behavior changes and the environment supports it.

## QA Skill Workflow

- Treat user requests like "test", "validate", "QA", "real QA", "find issues", or "regression check" as explicit triggers to run QA workflows.
- Use the `qa` skill for interactive QA sessions and issue triage when available.
- Use `app-behaviour.md` as the canonical behavior oracle for test scenarios and expected outcomes.
- For QA passes, always report:
  - What was validated successfully.
  - What failed and exact failure evidence.
  - What was blocked by environment/tooling vs application behavior.
  - Severity-ordered findings with concrete reproduction steps.
- When QA uncovers a bug, prefer implementing the fix in the same turn when feasible, then rerun the relevant validations.
