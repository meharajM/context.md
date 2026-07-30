# `src/modules/AudioEngine` Architecture

This module abstracts speech capture and wake-word readiness.

## Files

- `index.ts`: abstract interface and readiness/result types.
- `AudioEngineImpl.ts`: current implementation backed by `whisper.rn`.
- `BackgroundService.ts`: feature-gated no-op path for MVP background behavior.
- `__tests__`: store/audio behavior tests.

## Current Behavior

- iOS expects `whisper-tiny.en.bin` in the app bundle.
- Android relies on `whisper.rn` asset handling for `whisper-tiny.en.bin`.
- Wake-word readiness is always `false` until a real keyword-spotter model and runtime are bundled.
- `startRecording()` uses `AudioPcmStreamAdapter` plus `WavFileWriter` to stream microphone PCM into a temporary WAV file.
- `stopRecording()` stops the stream, finalizes the WAV file, then runs a single `whisperContext.transcribe(...)` pass over the retained file.
- Thrown transcription failures and non-throwing error results such as Whisper aborts move the finalized WAV into `Documents/retained-audio` before returning its path for failure-safe Inbox persistence.
- Retained-audio filenames combine timestamp, random suffix, and collision checks. If a native move fails, the engine copies first and removes the temporary source only after that copy succeeds; if durable storage fails entirely, it keeps and returns the original temporary source rather than deleting the only recording.
- User-requested retained-audio deletion validates that the target is a generated `contextengine-retained-*.wav` directly under `Documents/retained-audio`; imported, nested, path-traversal, and unrelated paths are rejected before filesystem access.
- iOS Whisper init is now forced to CPU mode with `useGpu: false` and `useCoreMLIos: false` to avoid the default higher-memory path in `whisper.rn`.
- File transcription uses reduced decode settings (`maxThreads: 1`, `nProcessors: 1`, `maxContext: 0`, `beamSize: 1`, `bestOf: 1`) to lower peak memory pressure.
- Successful voice transcription is persisted by the store directly into `Inbox` before the durable source note is queued for synthesis.
- Real-device QA now passes record -> stop -> durable Inbox persistence, but transcription accuracy on device remains poor.

## Agent Notes

- Do not present background or lock-screen wake-word as implemented.
- Any audio error path must leave the store with `isRecording: false`.
- Lazy permission request belongs in the store action before recording starts.
- The store now distinguishes `starting`, `recording`, `stopping`, `transcribing`, and `error` capture phases.
