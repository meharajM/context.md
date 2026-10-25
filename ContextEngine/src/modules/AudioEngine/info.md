# `src/modules/AudioEngine` Architecture

This module abstracts speech capture and wake-word readiness.

## Files

- `index.ts`: abstract interface and readiness/result types.
- `AudioEngineImpl.ts`: current implementation backed by `whisper.rn`.
- Android `EventEmitter`/`AudioInputRouter`: selects a connected wired or Bluetooth headset microphone before recording and restores the prior audio route afterward.
- `BackgroundService.ts`: feature-gated no-op path for MVP background behavior.
- `__tests__`: store/audio behavior tests.

## Current Behavior

- iOS expects `whisper-tiny.en.bin` in the app bundle.
- Android relies on `whisper.rn` asset handling for `whisper-tiny.en.bin`.
- Wake-word readiness is always `false` until a real keyword-spotter model and runtime are bundled.
- `startRecording()` uses `AudioPcmStreamAdapter` plus `WavFileWriter` to stream microphone PCM into a temporary WAV file.
- Android waits for the dedicated `ActiveRecordingService` to enter foreground before opening the PCM stream. Its notification Stop action is queued through `MainActivity` and the native event bridge until JS can call the store's normal stop/finalize flow; the service ends after WAV finalization, and its bridge acknowledgement waits for `onDestroy` to remove the foreground notification before Whisper transcription. Start, stop, and timeout failures also attempt cleanup.
- Android 13+ asks once for notification permission when the user starts recording so the ongoing Stop action is visible. A denied choice is remembered and can be changed in Android Settings; denial does not block the microphone, and in-app Stop remains visible on every route.
- On Android, recording prefers an attached wired or Bluetooth microphone; Bluetooth SCO is awaited on API 24–30 and the communication device is selected on API 31+. If no headset route is available or Bluetooth access is denied, status identifies the phone microphone fallback.
- Android PCM stop calls `AudioRecord.stop()` before joining the native reader thread so a blocking `AudioRecord.read()` can exit; the persistent post-install patch lives in `scripts/patch-rn-audio-pcm-stream.js`.
- `stopRecording()` serializes and drains pending PCM writes, finalizes the WAV file, then awaits the store's retention callback before starting Whisper.
- If Android has discarded Whisper's native context while its JS handle remains, file transcription reinitializes it and retries once; retained audio remains the recovery path if that retry fails.
- The store writes a recovery note to Inbox before transcription. If Whisper outlasts the UI timeout, the note stays visible while transcription continues; a later transcript updates that same note and queues it once. Failed transcription or Inbox persistence keeps the audio and writes a recoverable Inbox entry.
- Retained-audio filenames combine timestamp, random suffix, and collision checks. If a native move fails, the engine copies first and removes the temporary source only after that copy succeeds; if durable storage fails entirely, it keeps and returns the original temporary source rather than deleting the only recording.
- User-requested retained-audio deletion validates that the target is a generated `contextengine-retained-*.wav` directly under `Documents/retained-audio`; imported, nested, path-traversal, and unrelated paths are rejected before filesystem access.
- iOS Whisper init is now forced to CPU mode with `useGpu: false` and `useCoreMLIos: false` to avoid the default higher-memory path in `whisper.rn`.
- File transcription uses reduced decode settings (`maxThreads: 1`, `nProcessors: 1`, `maxContext: 0`, `beamSize: 1`, `bestOf: 1`) to lower peak memory pressure.
- Whisper non-speech markers such as `[SOUND]`, `[MUSIC PLAYING]`, and `[BLANK_AUDIO]` normalize to an empty transcript, so they stay as retained Inbox audio instead of entering synthesis.
- Successful voice transcription is persisted by the store directly into `Inbox` before the durable source note is queued for synthesis. Whisper RN does not return confidence scores, so the engine leaves `confidence` unset.
- WAV finalization updates only the 44-byte header and propagates write failures, avoiding whole-recording base64 copies and silent partial files.
- Earlier emulator loopback runs produced both usable and incorrect transcripts. The 2026-10-20 signed-release rerun stopped and retained generated speech recordings, but Whisper returned `[Music]`/no usable transcript. A final 6 GiB AVD retry enabled both `-allow-host-audio` and runtime host-mic passthrough, yet generated speech still returned an empty transcript (“wind blowing”). This verifies stop and Inbox recovery, not repeatable speech recognition. Human speech and physical headset routing remain unverified.

## Agent Notes

- Do not present background or lock-screen wake-word as implemented.
- Any audio error path must leave the store with `isRecording: false`.
- Lazy permission request belongs in the store action before recording starts.
- The store now distinguishes `starting`, `recording`, `stopping`, `transcribing`, and `error` capture phases.
