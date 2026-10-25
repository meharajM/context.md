# `src/modules/SynthesisEngine` Architecture

This module owns thought processing, LiteRT-LM synthesis integration, model catalog management, and queue safety.

## Files

- `SynthesisService.ts`: runtime selection and LiteRT/raw fallback policy.
- `ProcessingQueueManager.ts`: in-memory queue with capped retry and fallback persistence.
- `models.ts`: LiteRT model catalog and runtime config conversion.
- `modelManager.ts`: installed-model detection, download, deletion, and progress state.
- `runtimes`: runtime interface and concrete LiteRT/raw fallback implementations.
- `__tests__`: queue and synthesis service tests.

Android downloads use verified 16 MiB byte ranges, retry a failed range up to three times, and preserve configured timeouts and range headers across the hosting redirect. Complete ranges remain in the private `.download` file when a request is interrupted; the next download resumes at the next range. Misaligned or unverified data is discarded. Settings reports saved range progress as paused, and only a full-size, SHA-256-verified file is moved into the installed model path. On refresh, verified temporary or final files left by an interrupted installation are promoted/re-manifested.

iOS keeps the RNFS background-session and non-discretionary flags, and still calls `completeHandlerIOS` for the active job. A complete verified temporary/final file is recovered on refresh. RNFS resume handles are tied to a live job ID, so an incomplete iOS transfer is retried from the beginning. Progress during a live transfer is in-memory; Android can reconstruct only completed 16 MiB ranges after app restart. The Android RNFS transfer is not WorkManager-backed, so the OS may stop execution after reclaiming the app process; opening the app allows a saved-range download to resume. Background-session and process-reclaim behavior still need device validation.

## Runtime Policy

- LiteRT-LM is the only active synthesis runtime.
- Raw fallback is persistence-only, not another AI runtime.
- Raw fallback always retains the trimmed original transcript under `Inbox`; it never heuristically assigns a semantic topic or rewrites the capture.
- If LiteRT is disabled, missing, unavailable, or throws, the transcript is saved under `Inbox`.
- `Inbox` is treated as a fallback bucket, not a semantic candidate topic for model classification.
- Requeued Inbox items carry source context; only LiteRT-backed categorized success writes a replacement and removes the original. Resolved fallback leaves the original untouched and unduplicated.
- Queue calls include topic names plus a compact prompt and at most 240 characters of the latest content from each of six candidate topics to limit prompt size for Gemma3's 1,024-token input budget. Selected-topic synthesis uses the selected topic context in one pass; automatic synthesis identifies first and refines against matching topic content in a second pass.
- Automatic identification receives persisted content for candidate topics, compares context before choosing, and returns a clarification question with 2–3 topic options when the route is genuinely ambiguous.
- Clarification-needed items remain in the queue and are not written or removed until the user selects a topic; the selected topic then resumes the one-pass selected-topic path.
- Import previews require approval whenever an unselected suggestion matches an existing topic, independent of the synthesis source.
- Imported voice files skip the live-capture delay, and imported notes preserve source metadata for later edit/share/playback flows.
- Queue retries are capped with `MAX_ATTEMPTS = 2`.
- Queue synthesis attempts have a per-attempt timeout so a hanging native/runtime call cannot leave the queue in `PROCESSING` forever.
- Confirmed deletion of a persisted Inbox note can remove every matching pending queue representation by durable note id; an active matching item remains protected until processing finishes.
- Native synthesis failures mark LiteRT readiness as unavailable/error with crash-risk details so the next thought can use raw fallback or a clean reinitialize path.
- Resource-gated items remain recoverable in Inbox; the live in-memory queue pauses when available memory or thermal state is unsuitable. Total RAM below a model's recommendation warns about possible slow or failed inference but does not permanently block an opted-in model.
- Queue recovery across process death comes from the durable Inbox source and startup requeue. On Android, temporary resource blocks also request constrained WorkManager execution through a Headless JS runner; the worker waits for that task to finish and retries transient pressure. iOS BGProcessingTask integration is not implemented.

## Agent Notes

- UI and store should call `SynthesisService`, not native LiteRT directly.
- Model binaries should not be committed.
- Keep model setup and validation notes aligned with `docs/litert-evaluation.md`.
