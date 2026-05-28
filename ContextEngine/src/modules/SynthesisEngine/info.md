# `src/modules/SynthesisEngine` Architecture

This module owns thought processing, LiteRT-LM synthesis integration, model catalog management, and queue safety.

## Files

- `SynthesisService.ts`: runtime selection and LiteRT/raw fallback policy.
- `ProcessingQueueManager.ts`: in-memory queue with capped retry and fallback persistence.
- `models.ts`: LiteRT model catalog and runtime config conversion.
- `modelManager.ts`: installed-model detection, download, deletion, and progress state.
- `runtimes`: runtime interface and concrete LiteRT/raw fallback implementations.
- `__tests__`: queue and synthesis service tests.

## Runtime Policy

- LiteRT-LM is the only active synthesis runtime.
- Raw fallback is persistence-only, not another AI runtime.
- If LiteRT is disabled, missing, unavailable, or throws, the transcript is saved under `Inbox`.
- `Inbox` is treated as a fallback bucket, not a semantic candidate topic for model classification.
- Requeued Inbox items carry source context; on success the queue writes the categorized topic entry and then removes the original Inbox entry.
- Queue retries are capped with `MAX_ATTEMPTS = 2`.
- Queue synthesis attempts have a per-attempt timeout so a hanging native/runtime call cannot leave the queue in `PROCESSING` forever.
- Native synthesis failures mark LiteRT readiness as unavailable/error with crash-risk details so the next thought can use raw fallback or a clean reinitialize path.

## Agent Notes

- UI and store should call `SynthesisService`, not native LiteRT directly.
- Model binaries should not be committed.
- Keep model setup and validation notes aligned with `docs/litert-evaluation.md`.
