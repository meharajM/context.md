# `docs` Architecture

Project documentation that supports implementation and validation.

## Current Documents

- `litert-evaluation.md`: LiteRT-only synthesis direction, model contract, iOS native setup, model download notes, and validation caveats.
- `assistant-intents.md`: supported Siri/Shortcuts invocation patterns and platform limits for assistant capture.
- `real-device-qa-skill.md`: physical iPhone QA runbook backed by the project-local real-device QA skill and script.
- `release-credentials.md`: git-ignored release secret locations, local metadata variables, and the import/apply workflow for signing assets and policy text.
- `publish-readiness-plan.md`: phase-11 remediation workstreams, acceptance criteria, validation gates, and publisher-owned store requirements.
- `privacy-policy.md`: Android privacy policy for app- and widget-initiated capture with local transcription; public policy publication was verified on 2026-10-31.
- `store-submission-package.md`: draft App Store/Play listing copy, screenshot story, privacy declaration inputs, and submission checklists.
- `play-store-listing-agent-plan.md`: authoritative current Play listing draft, screenshot order, saved Console state, and safe update procedure for an AI agent.

## Agent Notes

- Keep docs aligned with actual code and tracker state.
- Device readiness requirements and scheduling limitations belong in `publish-readiness-plan.md` and `app-behaviour.md`; Android uses constrained WorkManager for idle synthesis retries, while iOS still retries on launch/foreground. Inbox remains the durable source of truth on both platforms.
- Do not document OpenAI, Ollama, or cloud synthesis paths as active.
- Do not claim Android NPU or background wake-word is implemented.

## Current release scope

Play Console currently shows Android 1.0.4 (code 5) live in Production at 100% rollout across 50/50 regions; the Production track reports zero installs. The English (United States) listing has a saved draft with refreshed copy and a topic-first screenshot order; it has not been sent for review. Current source adds three illustrated first-use Home cards; Android's first card also explains adding the Record/Write widget. This UI requires a future app build and validation before users receive it. Android supports app/widget-initiated voice capture with local English transcription; headset-button and lock-screen triggers are deferred. iOS remains text-only. Audio import, wake word, and assistant voice remain future scope. Compatible Android devices may automatically download the writing model when readiness and storage allow; incoming shared text may be organized on-device, with recoverable fallback. `implementation/status.json` records current evidence and blockers.
