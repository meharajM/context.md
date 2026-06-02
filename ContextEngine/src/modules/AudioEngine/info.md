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
- iOS Whisper init is now forced to CPU mode with `useGpu: false` and `useCoreMLIos: false` to avoid the default higher-memory path in `whisper.rn`.
- File transcription uses reduced decode settings (`maxThreads: 1`, `nProcessors: 1`, `maxContext: 0`, `beamSize: 1`, `bestOf: 1`) to lower peak memory pressure.
- Successful voice transcription is now persisted by the store directly into `Inbox` before any synthesis step.
- The automatic post-capture synthesis hop was removed from the stop path as a stability containment measure after real-device crashes during the richer flow.
- Real-device QA now passes record -> stop -> durable Inbox persistence, but transcription accuracy on device remains poor.

## Agent Notes

- Do not present background or lock-screen wake-word as implemented.
- Any audio error path must leave the store with `isRecording: false`.
- Lazy permission request belongs in the store action before recording starts.
- The store now distinguishes `starting`, `recording`, `stopping`, `transcribing`, and `error` capture phases.
