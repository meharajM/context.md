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
- `startRecording()` uses realtime Whisper transcription and stores the latest transcript.
- `stopRecording()` now clears the active realtime capture handle, returns the latest transcript and confidence `1.0` when non-empty, and can surface timeout/native stop errors.

## Agent Notes

- Do not present background or lock-screen wake-word as implemented.
- Any audio error path must leave the store with `isRecording: false`.
- Lazy permission request belongs in the store action before recording starts.
- The store now distinguishes `starting`, `recording`, `stopping`, `transcribing`, and `error` capture phases.
