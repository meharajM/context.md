# `docs` Architecture

Project documentation that supports implementation and validation.

## Current Documents

- `litert-evaluation.md`: LiteRT-only synthesis direction, model contract, iOS native setup, model download notes, and validation caveats.
- `assistant-intents.md`: supported Siri/Shortcuts invocation patterns and platform limits for assistant capture.
- `real-device-qa-skill.md`: physical iPhone QA runbook backed by the project-local real-device QA skill and script.
- `release-credentials.md`: git-ignored release secret locations, local metadata variables, and the import/apply workflow for signing assets and policy text.
- `publish-readiness-plan.md`: phase-11 remediation workstreams, acceptance criteria, validation gates, and publisher-owned store requirements.
- `privacy-policy.md`: publisher-review draft describing the current local-first data flow and required public-policy placeholders.
- `store-submission-package.md`: draft App Store/Play listing copy, screenshot story, privacy declaration inputs, and submission checklists.

## Agent Notes

- Keep docs aligned with actual code and tracker state.
- Do not document OpenAI, Ollama, or cloud synthesis paths as active.
- Do not claim Android NPU or background wake-word is implemented.
