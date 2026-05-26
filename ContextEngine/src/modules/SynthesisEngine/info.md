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
- Queue retries are capped with `MAX_ATTEMPTS = 2`.

## Agent Notes

- UI and store should call `SynthesisService`, not native LiteRT directly.
- Model binaries should not be committed.
- Keep model setup and validation notes aligned with `docs/litert-evaluation.md`.
