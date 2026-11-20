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

As of 2026-11-09:

- Current phase: `phase-11-roadmap-hardening-and-release-qa`
- Current status: `in_progress`
- Next safe work: Android 1.0.8/code 9 is live. The follow-up full-description opening and Meeting screenshot reorder (positions 1–2) were submitted for review; current public listing stays available during review. Verify the new text/order on the public page after approval. For a future release, address physical human-speech accuracy, long-meeting summary reliability, API 34+ UIDT, Balanced inference, enlarged-text, and iOS device/publication checks. Do not claim immediate transcription or complete phase-11 validation.
- Latest Meeting device evidence: a 1:11 Redmi 3S/API 30 current-source mic run showed live transcript text and, after Stop, generated two suggested actions plus a summary automatically in about 30 seconds. A 63-minute transcript inference timed out in LiteRT CPU inference; long-meeting summary completion remains unverified.
- Release state: Play production is 1.0.8/code 9. Signed AAB matches fingerprint `aa1a64ff2dfc33901bdcd9da4eaf0d5dde0c79d5d477fbf03a061afa5ffc17bb`; the Android preflight’s screenshot rule still expects two old filenames despite six submitted screenshots. The public gallery currently has Meeting images at positions 3–4; positions 1–2 and a Meeting-first description are pending review. No paid ad campaign was launched.

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
3. Complete physical-device, accessibility, and iOS publication checks; prepare another app release only if a reproducible issue requires a code change.

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

Physical Android validation remains open for widget capture-to-transcription, API 34+ UIDT, Balanced model behavior, and enlarged-text accessibility. iOS physical-device E2E and publication remain separate checks. Android 1.0.7/code 8 is already live; the next Android release needs a new version code and current preflight only if a reproducible issue requires a code change.\n
