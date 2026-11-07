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

As of 2026-11-06:

- Current phase: `phase-11-roadmap-hardening-and-release-qa`
- Current status: `in_progress`
- Next safe work: fix delayed background handling of new widget captures, prevent disabled text capture from discarding a widget draft, and investigate unrelated notes being routed to Health. Repeat the physical background tests before publishing. Detailed evidence is in `artifacts/android-physical-qa-20261106/qa-results.md`.
- Latest validation: on a Redmi 3S/API 30, writing-model download advanced while minimized; live widget speech, widget text retention, interrupted-recording recovery, capture-setting persistence, search, edit, explicit-topic import, share-sheet launch, and duplicate-safe backup restore were exercised. Controlled widget voice and text tests did not begin processing promptly while the app was minimized and recovered after reopening. TypeScript/Jest passed 52 suites / 525 tests; lint had 0 errors / 20 warnings.
- Release state: the tested current-source device-test APK is `android/app/build/local-device-install/outputs/apk/release/app-release.apk`, 1.0.6/code 7 with a separate `.deviceTest` package. It is not a Play release artifact. Production remains 1.0.5/code 6; no update was submitted. Android release readiness, enlarged-text hardware QA, iOS E2E, and Apple Distribution signing remain open.

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
3. Complete physical-device QA and resolve owner-managed platform signing/store-console prerequisites before submission.

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

The paired iPhone has the existing Thought Notes app installed, so its app data was left untouched. CoreSimulator could not create a QA device because its service receives `EPERM` writing to the configured external device cache; iOS simulator E2E remains unverified. The widget microphone foreground-service start passed on API 36, but live capture-to-transcription and enlarged-text QA remain open; the emulator did not provide verifiable audio output. Final publication requires the Apple Distribution certificate/profile and current store-console checks; no release was submitted.
