# Small Agent Handoff

This file is the compact entrypoint for small-context coding agents.

## Start Here

1. Read `implementation/status.json`.
2. Use `currentPhase` to find one phase object in `implementation/phases.json`.
3. Work only on the earliest incomplete slice in that phase.
4. Read only the `info.md` files for directories you will edit.
5. After changes, run the phase validation commands you can run.
6. Append evidence to `implementation/status.json` (you can use `npm run update-status` to automate this).

## Current Phase

As of 2026-07-18:

- Current phase: `phase-11-roadmap-hardening-and-release-qa`
- Current status: `in_progress`
- Next safe work: choose a legitimate platform audio/Now Playing design for reliable earphone delivery, run fresh iOS and Android physical-device QA, then complete owner-managed production signing and store submission.
- Latest validation: typecheck, lint, 25 Jest suites / 145 tests, shared Detox 4/4 on iPhone 16 and 4/4 on Android 11, iOS Debug build, Android Debug/AndroidTest builds, Android headset gate tests, production APK/AAB builds, and the 15-library Android 16 KB check all pass.
- Release state: deterministic iPhone, iPad, and Play phone screenshots are generated; `npm run release:preflight` is 11/16. Owner-signed artifacts still require production credentials.

## Minimum Files To Read For Phase 11

- `implementation/status.json`
- `implementation/phases.json`, only `phase-11-roadmap-hardening-and-release-qa`
- `app-behaviour.md`
- `README.md`
- `project-architecture.md`
- `info.md`
- `src/modules/ContextManager/info.md` when editing persistence contracts
- `src/modules/SynthesisEngine/info.md` when editing synthesis contracts
- `src/core/info.md` when editing store orchestration
- `src/shared/hooks/info.md` when editing native event intake hooks
- `src/features/settings/info.md` when editing validation/setup guidance
- `ios/ContextEngine/info.md` when editing native iOS bridges
- Add feature-level `info.md` only when editing that feature directory.

## Phase 11 Task Order

1. Resolve the product/platform contract for reliable earphone delivery without silent or fake playback.
2. Rerun physical-device QA on both platforms and append the evidence to `implementation/status.json`.
3. Replace privacy/publisher placeholders, approve the generated store assets, and complete production signing and store-console submission.

## Safety Rules

- Never drop a non-empty capture.
- Keep raw fallback to `Inbox`.
- Do not claim free-form assistant parsing beyond intents/shortcuts.
- Preserve queue/persistence invariants when assistant content arrives.
- Do not edit generated build outputs or model binaries.

## Evidence Format

Append short evidence strings to `status.json.phases[phase].evidence`.

Use these prefixes:

- `STARTED slice N: ...`
- `PARTIAL slice N: ... Remaining: ...`
- `DONE slice N: ... Validation: ...`
- `BLOCKED slice N: ... Evidence: ...`

You can automate appending these messages using the status script:
- To start a slice: `npm run update-status -- --slice N --started --evidence "Beginning layout"`
- To record progress: `npm run update-status -- --slice N --partial --evidence "Finished layout" --remaining "Events"`
- To mark slice complete: `npm run update-status -- --slice N --done --evidence "Finished event handlers" --validation-msg "Jest passed"`
- To block a slice: `npm run update-status -- --slice N --blocked-slice --evidence "Microphone crash" --slice-blocker "Access permission issue"`

## Validation

Use the active phase validation first while developing a slice:

```sh
npm run validate:current-phase
```

Before marking a slice done, committing, or advancing the phase, also run:

```sh
npm run validate:regression
```

Equivalent expanded commands:

```sh
npm run typecheck -- --pretty false
npm test -- --runInBand src/modules/SynthesisEngine src/modules/ContextManager src/features/reflections src/features/threads src/features/queue
npm test -- --runInBand __tests__/App.test.tsx
```

Regression validation is intentionally broader than the current phase and can catch stale tests, type fallout, and behavior regressions outside the touched slice.

Remaining external gate:

```sh
npm run ios:device
npm run android
```

The prior iOS development-provisioning failure is resolved, but the current connected iPhone cannot mount its Developer Disk Image or enable Development services. Final publication still requires physical-device evidence, a legitimate headset-session design, owner production credentials, Xcode 26+, placeholder-free published privacy metadata, asset approval, and App Store/Play Console completion.
