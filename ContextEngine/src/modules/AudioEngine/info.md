# `src/modules/AudioEngine` Architecture

This module abstracts speech capture and wake-word readiness.

## Files

- `index.ts`: abstract interface and readiness/result types.
- `AudioEngineImpl.ts`: shared recording implementation with Android Whisper and iOS Gemma 3n or Whisper transcription.
- Android `EventEmitter`/`AudioInputRouter`: selects a connected wired or Bluetooth headset microphone before recording and restores the prior audio route afterward.
- `BackgroundService.ts`: feature-gated no-op path for MVP background behavior.
- `__tests__`: store/audio behavior tests.

## Current Behavior

- iOS selects Gemma 3n E2B for both transcription and note organization when physical RAM is at least 8 GB and free storage covers the model plus setup headroom. Otherwise the default path uses the smaller Gemma writing model and the same pinned Whisper model used on Android.
- Android downloads the pinned Whisper tiny.en Q5_1 model on first launch into private `files/models/` storage. Downloads use 16 MiB ranges, resume at the last complete range, and verify exact size and SHA-256 before moving the model into place.
- Android continues a live Whisper download through WorkManager when the app backgrounds; returning to the foreground reinitializes Whisper readiness from the installed model.
- iOS automatically downloads its selected voice path: Gemma 3n on devices that meet the RAM/storage threshold, or Whisper tiny.en for the lightweight split. Android downloads the same pinned Whisper model automatically. Both platforms transcribe on device.
- Wake-word readiness is always `false` until a real keyword-spotter model and runtime are bundled.
- `startRecording()` uses `AudioPcmStreamAdapter` plus `WavFileWriter` to stream microphone PCM into a temporary WAV file on both platforms.
- Meeting capture uses that same stream and retained full WAV, plus temporary disk-backed 20-second WAV segments for local transcription while recording continues. iOS sends chunks to the selected engine (Gemma 3n or Whisper); Android uses Whisper's four-thread mobile setting to reduce backlog. Android Whisper segment offsets use 10 ms ticks and are converted to milliseconds for the meeting timeline. A failed segment is marked as incomplete and the full retained WAV remains available for retry.
- Android waits for the dedicated `ActiveRecordingService` to enter foreground before opening the PCM stream. Its notification Stop action is queued through `MainActivity` and the native event bridge until JS can call the store's normal stop/finalize flow; the service ends after WAV finalization, and its bridge acknowledgement waits for `onDestroy` to remove the foreground notification before Whisper transcription. iOS uses the microphone usage disclosure and audio background mode so a user-started recording can continue when the app backgrounds; return to the app to stop it. Start, stop, and timeout failures also attempt cleanup.
- Android 13+ asks once for notification permission when the user starts recording so the ongoing Stop action is visible. A denied choice is remembered and can be changed in Android Settings; denial does not block the microphone, and in-app Stop remains visible on every route.
- On Android, recording prefers an attached wired or Bluetooth microphone; Bluetooth SCO is awaited on API 24–30 and the communication device is selected on API 31+. If no headset route is available or Bluetooth access is denied, status identifies the phone microphone fallback.
- Android PCM stop calls `AudioRecord.stop()` before joining the native reader thread so a blocking `AudioRecord.read()` can exit; the persistent post-install patch lives in `scripts/patch-rn-audio-pcm-stream.js`.
- `stopRecording()` serializes and drains pending PCM writes, finalizes the WAV file, and awaits the store's retention callback before returning the completed transcript. iOS transcription can already be processing bounded chunks while capture continues.
- If Whisper has discarded its native context while its JS handle remains, file transcription reinitializes it and retries once; retained audio remains the recovery path if that retry fails.
- The store writes a recovery note to Inbox before transcription. If transcription outlasts the UI timeout, the note stays visible while it continues; a later transcript updates that same note and queues it once. Failed transcription or Inbox persistence keeps the audio and writes a recoverable Inbox entry.
- Recording descriptors may carry a validated meeting id so process-death recovery returns the WAV to the Meeting session; ordinary voice captures keep the existing two-argument recovery callback and Inbox behavior.
- Retained-audio filenames combine timestamp, random suffix, and collision checks. If a native move fails, the engine copies first and removes the temporary source only after that copy succeeds; if durable storage fails entirely, it keeps and returns the original temporary source rather than deleting the only recording.
- User-requested retained-audio deletion validates that the target is a generated `contextengine-retained-*.wav` directly under `Documents/retained-audio`; imported, nested, path-traversal, and unrelated paths are rejected before filesystem access.
- Android ordinary voice/file transcription uses reduced Whisper decode settings (`maxThreads: 1`, `nProcessors: 1`, `maxContext: 0`, `beamSize: 1`, `bestOf: 1`) to lower peak memory pressure. Android meeting segments use `maxThreads: 4` on the same single processor.
- Known non-speech markers such as `[SOUND]`, `[SOUND EFFECTS]`, `[explosion]`, `(birds chirping)`, `[MUSIC PLAYING]`, and `[BLANK_AUDIO]` normalize to an empty transcript, so they stay out of meeting text and synthesis.
- Successful voice transcription is persisted by the store directly into `Inbox` before the durable source note is queued for synthesis. Neither Gemma audio transcription nor Whisper RN currently returns confidence scores, so the engine leaves `confidence` unset.
- WAV finalization updates only the 44-byte header and propagates write failures, avoiding whole-recording base64 copies and silent partial files.
- Earlier emulator loopback runs produced both usable and incorrect transcripts. The 2026-10-20 signed-release rerun stopped and retained generated speech recordings, but Whisper returned `[Music]`/no usable transcript. A final 6 GiB AVD retry enabled both `-allow-host-audio` and runtime host-mic passthrough, yet generated speech still returned an empty transcript (“wind blowing”). This verifies stop and Inbox recovery, not repeatable speech recognition. Human speech and physical headset routing remain unverified.

## Agent Notes

- Do not present background or lock-screen wake-word as implemented.
- Any audio error path must leave the store with `isRecording: false`.
- Lazy permission request belongs in the store action before recording starts.
- The store now distinguishes `starting`, `recording`, `stopping`, `transcribing`, and `error` capture phases.

- Production transcription diagnostics report counts/status only; full transcripts are never logged.
- Both Gemma and Whisper prompts request verbatim English across regional accents, explicitly including Indian English. Physical iPhone accuracy and latency across English varieties remain unverified.
