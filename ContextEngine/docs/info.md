# `docs` Architecture

Project documentation that supports implementation and validation.

## Current Documents

- `litert-evaluation.md`: LiteRT-only synthesis direction, model contract, iOS native setup, model download notes, and validation caveats.
- `assistant-intents.md`: supported Siri/Shortcuts invocation patterns and platform limits for assistant capture.
- `real-device-qa-skill.md`: physical iPhone QA runbook backed by the project-local real-device QA skill and script.
- `release-credentials.md`: git-ignored release secret locations, local metadata variables, and the import/apply workflow for signing assets and policy text.
- `publish-readiness-plan.md`: phase-11 remediation workstreams, acceptance criteria, validation gates, publisher-owned store requirements, and the 2026-11-09 Meeting-mode follow-up evidence.
- `privacy-policy.md`: cross-platform privacy-policy draft for local capture, model selection, transcription, and sharing; verify it against the final store build before publication.
- `store-submission-package.md`: historical 2026-10-31 submission package, older listing copy, privacy declaration inputs, and checklists.
- `play-store-listing-agent-plan.md`: verified public Play listing copy, screenshot order, current release state, and safe procedure for future listing work.
- `marketing-and-release-plan.md`: verified Android production state, remaining QA gates, store-listing improvements, 30-day discovery plan, and staged ₹10,000 budget.
- `google-play-in-app-updates.md`: Android Play Core flexible-update behavior, Play Console release requirements, and internal app sharing test setup.

## Agent Notes

- Keep docs aligned with actual code and tracker state.
- Device readiness requirements and scheduling limitations belong in `publish-readiness-plan.md` and `app-behaviour.md`; Android uses constrained WorkManager for idle synthesis retries, while iOS uses opportunistic BGProcessingTask plus launch/foreground recovery. Inbox remains the durable source of truth on both platforms.
- Do not document OpenAI, Ollama, or cloud synthesis paths as active.
- Do not claim Android NPU or background wake-word is implemented.

## Current release scope

As of the last verified Play check (2026-11-19), production was Android 1.0.10/code 11 and 1.0.11/code 12 was in review. Current source contains newer cross-platform capture and model changes that are not represented by the previously submitted build; see `google-play-in-app-updates.md` before the next release. The live English listing has six screenshots. Follow the QA gate in `marketing-and-release-plan.md` before proposing paid promotion. Android API 34+ explicit user-started model downloads use UIDT; automatic downloads and older Android use WorkManager with verified-range recovery. Android widget processing is durable and retryable but may wait under OS/resource limits. iOS source registers BGProcessingTask; physical execution and iOS publication remain separate validation work. Android headset/lock-screen capture is opt-in in current source; iOS uses Lock Screen widget app handoff and keeps direct headset commands gated. Audio-file import, wake word, assistant voice, and spoken summaries remain deferred. `implementation/status.json` records the remaining QA gaps.
