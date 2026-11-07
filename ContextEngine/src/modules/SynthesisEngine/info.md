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

iOS keeps the RNFS background-session and non-discretionary flags, forwards background URLSession completion from AppDelegate, and calls `completeHandlerIOS` for the active job. A complete verified temporary/final file is recovered on refresh. RNFS resume handles are tied to a live job ID, so an incomplete iOS transfer is retried from the beginning. Android schedules active model downloads through a foreground WorkManager worker, which calls the same verified range downloader; after interruption, completed 16 MiB ranges can resume. Progress is in-memory during a live transfer, and process-reclaim behavior still needs device validation.

## Runtime Policy

- LiteRT-LM is the only active synthesis runtime.
- Raw fallback is persistence-only, not another AI runtime.
- Raw fallback always retains the trimmed original transcript under `Inbox`; it never heuristically assigns a semantic topic or rewrites the capture.
- If LiteRT is disabled, missing, unavailable, or throws, the transcript is saved under `Inbox`.
- `Inbox` is treated as a fallback bucket, not a semantic candidate topic for model classification.
- Requeued Inbox items carry source context; only LiteRT-backed categorized success writes a replacement and removes the original. Resolved fallback leaves the original untouched and unduplicated.
- Successful synthesis returns the complete original capture in `refinedText` plus a separate optional AI `summary`; it never substitutes generated text for source text. Raw fallback has no summary.
- The 1,024-token default context is **combined input and output**. Every prompt is bounded to 640 UTF-8 bytes (or configured context minus 384), reserving 128 tokens for the native system/template and 256 for output. Model context and RAM targets are unchanged. UTF-8 splitting preserves every code point, including unbroken and multilingual input.
- Long captures are summarized chunk by chunk, then reduced through further bounded calls until a single concise summary remains. Each generated summary is requested at 120 UTF-8 bytes and accepted up to 240 bytes; non-converging, malformed, oversized, or failed output returns the full raw capture without a summary. Token/context-limit errors retry smaller pieces after reinitialization, at most two split depths per piece.
- Automatic routing scans **all** unique non-Inbox topics in bounded groups after summarization. Each candidate carries its title prefix (32 UTF-8 bytes) and latest persisted context suffix (24 bytes); numbered IDs retain full original topic names when choosing. A winning candidate or 2–3 clarification contenders participate in the next group. A proposed new topic is used only after all candidates were compared. This is a sequential comparison, not a full-library prompt or lexical top-ten cutoff.
- Selected-topic synthesis skips automatic routing and summarizes against only that selected topic's bounded latest context. Short selected captures use one call; long selected captures still cover every source chunk. Automatic ambiguity returns a focused question and 2–3 topic options after the scan.
- Clarification-needed items remain in the queue and are not written or removed until the user selects a topic; the selected topic then resumes the one-pass selected-topic path.
- Import previews require approval whenever an unselected suggestion matches an existing topic, independent of the synthesis source.
- Imported voice files skip the live-capture delay, and imported notes preserve source metadata for later edit/share/playback flows.
- Queue retries are capped with `MAX_ATTEMPTS = 2`.
- Queue synthesis has a 35-second idle watchdog refreshed while waiting for the service lock, during initialization, and after each completed bounded call. Model initialization starts only after a note is durable in Inbox and has a 180-second native and JavaScript limit; each native inference has a 60-second native limit and a 65-second JavaScript guard. Availability checks and release keep their 30-second limit. Long captures can take many calls without a fixed whole-attempt cutoff. Expired attempts cannot start later. The service serializes each complete capture operation, reconfiguration, and release.
- Confirmed deletion of a persisted Inbox note can remove every matching pending queue representation by durable note id; an active matching item remains protected until processing finishes.
- Native synthesis failures mark LiteRT readiness as unavailable/error with crash-risk details so the next thought can use raw fallback or a clean reinitialize path.
- Resource-gated items remain recoverable in Inbox; the live in-memory queue pauses when available memory or thermal state is unsuitable. Total RAM below a model's recommendation warns about possible slow or failed inference but does not permanently block an opted-in model.
- Queue recovery across process death comes from the durable Inbox source and startup requeue. On Android, temporary resource blocks request constrained WorkManager execution through a Headless JS runner. On iOS, they request opportunistic BGProcessingTask execution through the app's JS bridge; the OS can defer or expire it, so foreground recovery remains authoritative.

## Agent Notes

- UI and store should call `SynthesisService`, not native LiteRT directly.
- Model binaries should not be committed.
- Keep model setup and validation notes aligned with `docs/litert-evaluation.md`.
