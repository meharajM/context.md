# `docs` Architecture

Project documentation that supports implementation and validation.

## Current Documents

- `litert-evaluation.md`: LiteRT-only synthesis direction, model contract, iOS native setup, model download notes, and validation caveats.
- `assistant-intents.md`: supported Siri/Shortcuts invocation patterns and platform limits for assistant capture.
- `real-device-qa-skill.md`: physical iPhone QA runbook backed by the project-local real-device QA skill and script.
- `release-credentials.md`: git-ignored release secret locations, local metadata variables, and the import/apply workflow for signing assets and policy text.
- `publish-readiness-plan.md`: phase-11 remediation workstreams, acceptance criteria, validation gates, and publisher-owned store requirements.
- `privacy-policy.md`: Android v1 privacy policy for app- and widget-initiated capture with local transcription; the public Gist was refreshed on 2026-10-23.
- `store-submission-package.md`: draft App Store/Play listing copy, screenshot story, privacy declaration inputs, and submission checklists.

## Agent Notes

- Keep docs aligned with actual code and tracker state.
- Device readiness requirements and scheduling limitations belong in `publish-readiness-plan.md` and `app-behaviour.md`; Android uses constrained WorkManager for idle synthesis retries, while iOS still retries on launch/foreground. Inbox remains the durable source of truth on both platforms.
- Do not document OpenAI, Ollama, or cloud synthesis paths as active.
- Do not claim Android NPU or background wake-word is implemented.

## Current release scope

As of 2026-10-23, Android v1 supports app- and home-screen-widget-initiated capture with local transcription; headset-button and lock-screen triggers are deferred. A connected headset microphone may be used during an active recording. iOS remains text-only. Audio import, wake word, and assistant voice remain future scope. `implementation/status.json` records current evidence and blockers.
