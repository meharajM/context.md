# Agent Instructions

These instructions apply to the `ContextEngine` project. Follow them before and after every coding change.

## Required Reading Before Changes

1. Read `project-architecture.md` first for the compact full-project architecture and user-flow map.
2. Read `plan.md` for the product direction, MVP boundaries, and deferred work.
3. Read `implementation/status.json` first for the canonical current phase and project state.
4. For small-context or low-reasoning agents, read `implementation/SMALL_AGENT_HANDOFF.md` before any broad exploration.
5. Read only the matching phase object in `implementation/phases.json` unless the task explicitly requires broader history.
6. Read `implementation/README.md` and `implementation/index.md` for tracker workflow and human-readable state.
7. Read `app-behaviour.md` when the task changes user-facing behavior, roadmap scope, or QA expectations.
8. Read the relevant `info.md` files before editing a directory. At minimum:
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

1. Update `project-architecture.md` whenever the project architecture, ownership boundaries, persistence semantics, runtime integrations, or primary user flows change.
2. Update the relevant directory `info.md` files so future agents understand the new architecture.
3. Update `implementation/status.json` with evidence, blocker, status, or phase advancement when implementation state changes.
4. Update `implementation/index.md` when the human-readable current state changes.
5. Update `implementation/phases.json` only when the phase task spec itself changes.
6. Update `docs/*` when user-facing setup, model, validation, platform, or runtime behavior changes.
7. Keep `README.md` aligned when the verified MVP behavior or setup commands change.

`project-architecture.md` is the mandatory small-agent architecture handoff. Keep it dense enough that a low-context agent can recover the whole system shape in one pass.

## Multi-Agent Handoff Rules

- Treat `implementation/status.json` and `implementation/phases.json` as the shared coordination contract.
- Use `implementation/SMALL_AGENT_HANDOFF.md` as the compact start-here file for small-context agents.
- Before editing, identify the current phase and the specific slice number being worked.
- Prefer completing one slice end-to-end: code, focused tests, docs/info updates, and `status.json` evidence.
- If a slice is only partially complete, add evidence that starts with `PARTIAL:` and includes remaining work.
- Do not silently start a later slice when an earlier slice is incomplete unless the user explicitly directs parallel work.
- Avoid overlapping ownership: if another agent has recorded active or partial work for a slice, inspect that evidence and continue it instead of starting a duplicate approach.
- Keep changes scoped to the slice touch areas unless the implementation requires a shared contract change; document shared contract changes in the relevant `info.md`.
- Never mark a phase `validated` unless the phase gate and validation commands have passed or an environment blocker is explicitly recorded.

## Validation Expectations

Use both focused validation and regression validation:

- During slice development, run the validation listed in the active phase.
- Before marking a slice done, committing, or advancing a phase, run broad regression validation.

Recommended commands:

```sh
node scripts/validate-current-phase.js
npm run validate:regression
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

`npm run validate:current-phase` is a focused phase gate; it is not a complete regression suite. `npm run validate:regression` is the non-lint broad regression gate. `npm run lint` remains required when the local ESLint environment is healthy.

Native validation such as `cd ios && bundle exec pod install` or `npm run ios` should be run when native iOS behavior changes and the environment supports it.

## QA Skill Workflow

- Treat user requests like "test", "validate", "QA", "real QA", "find issues", or "regression check" as explicit triggers to run QA workflows.
- Use the `qa` skill for interactive QA sessions and issue triage when available.
- For physical iOS QA, use the project-local `skills/real-device-qa/SKILL.md` workflow and prefer `npm run qa:real-device` for evidence-backed runs.
- Use `app-behaviour.md` as the canonical behavior oracle for test scenarios and expected outcomes.
- For QA passes, always report:
  - What was validated successfully.
  - What failed and exact failure evidence.
  - What was blocked by environment/tooling vs application behavior.
  - Severity-ordered findings with concrete reproduction steps.
- When QA uncovers a bug, prefer implementing the fix in the same turn when feasible, then rerun the relevant validations.
