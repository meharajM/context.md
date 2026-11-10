# `src/modules/AudioEngine` Architecture

This module abstracts speech capture and wake-word readiness.

## Files

- `index.ts`: abstract interface and readiness/result types.
- `AudioEngineImpl.ts`: current implementation backed by `whisper.rn`.
- `whisperModelManager.ts`: pinned English and multilingual Hindi model metadata, ranged download/resume, and exact size/SHA-256 verification.
- Android `EventEmitter`/`AudioInputRouter`: selects a connected wired or Bluetooth headset microphone before recording and restores the prior audio route afterward.
- `BackgroundService.ts`: feature-gated no-op path for MVP background behavior.
- `__tests__`: store/audio behavior tests.

## Current Behavior

- English is the default. iOS loads `whisper-tiny.en.bin` from the app bundle; Android downloads the pinned Whisper tiny.en Q5_1 model on first launch into private `files/models/` storage.
- Settings can download and select the multilingual tiny Q5_1 model for Hindi / Hinglish on either platform. It starts with Whisper `language: 'auto'` and a mixed-language prompt; if detection returns English or the automatic text has no recognized Hindi/Hinglish evidence, it retries with `language: 'hi'` and accepts the non-aborted retry if it contains Devanagari or common Romanized Hindi words. Whisper's language label can disagree with the transcript, as seen on Redmi; Whisper RN exposes no confidence score, so uncommon transliterations remain a limitation.
- Downloads use 16 MiB ranges, resume at the last complete range, and verify exact size and SHA-256 before moving a model into place. The optional Hindi download runs in the foreground; keep the app open until it completes.
- Android continues the automatic English Whisper download through WorkManager when the app backgrounds. The optional Hindi / Hinglish download is foreground-only; returning to the foreground reinitializes Whisper readiness from the selected model.
- The selected model is loaded when the user changes language and after preferences hydrate on launch. A language change is blocked while recording; both platforms transcribe on device, and recording stays unavailable until the selected Whisper model initializes successfully.
- Wake-word readiness is always `false` until a real keyword-spotter model and runtime are bundled.
- `startRecording()` uses `AudioPcmStreamAdapter` plus `WavFileWriter` to stream microphone PCM into a temporary WAV file on both platforms.
- Android waits for the dedicated `ActiveRecordingService` to enter foreground before opening the PCM stream. Its notification Stop action is queued through `MainActivity` and the native event bridge until JS can call the store's normal stop/finalize flow; the service ends after WAV finalization, and its bridge acknowledgement waits for `onDestroy` to remove the foreground notification before Whisper transcription. iOS uses the microphone usage disclosure and audio background mode so a user-started recording can continue when the app backgrounds; return to the app to stop it. Start, stop, and timeout failures also attempt cleanup.
- Android 13+ asks once for notification permission when the user starts recording so the ongoing Stop action is visible. A denied choice is remembered and can be changed in Android Settings; denial does not block the microphone, and in-app Stop remains visible on every route.
- On Android, recording prefers an attached wired or Bluetooth microphone; Bluetooth SCO is awaited on API 24–30 and the communication device is selected on API 31+. If no headset route is available or Bluetooth access is denied, status identifies the phone microphone fallback.
- Android PCM stop calls `AudioRecord.stop()` before joining the native reader thread so a blocking `AudioRecord.read()` can exit; the persistent post-install patch lives in `scripts/patch-rn-audio-pcm-stream.js`.
- `stopRecording()` serializes and drains pending PCM writes, finalizes the WAV file, then awaits the store's retention callback before starting Whisper.
- Whisper context initialization, file transcription, and release share a serialized operation queue because the native context rejects overlapping file jobs.
- If Android has discarded Whisper's native context while its JS handle remains, file transcription reinitializes it and retries once; retained audio remains the recovery path if that retry fails.
- The store writes a recovery note to Inbox before transcription. If Whisper outlasts the UI timeout, the note stays visible while transcription continues; a later transcript updates that same note and queues it once. Failed transcription or Inbox persistence keeps the audio and writes a recoverable Inbox entry.
- Retained-audio filenames combine timestamp, random suffix, and collision checks. If a native move fails, the engine copies first and removes the temporary source only after that copy succeeds; if durable storage fails entirely, it keeps and returns the original temporary source rather than deleting the only recording.
- User-requested retained-audio deletion validates that the target is a generated `contextengine-retained-*.wav` directly under `Documents/retained-audio`; imported, nested, path-traversal, and unrelated paths are rejected before filesystem access.
- iOS Whisper init is now forced to CPU mode with `useGpu: false` and `useCoreMLIos: false` to avoid the default higher-memory path in `whisper.rn`.
- File transcription uses reduced decode settings (`maxThreads: 1`, `nProcessors: 1`, `maxContext: 0`, `beamSize: 1`, `bestOf: 1`) to lower peak memory pressure.
- Whisper non-speech markers such as `[SOUND]`, `[MUSIC PLAYING]`, and `[BLANK_AUDIO]` normalize to an empty transcript, so they stay as retained Inbox audio instead of entering synthesis.
- Successful voice transcription is persisted by the store directly into `Inbox` before the durable source note is queued for synthesis. Whisper RN does not return confidence scores, so the engine leaves `confidence` unset.
- WAV finalization updates only the 44-byte header and propagates write failures, avoiding whole-recording base64 copies and silent partial files.
- Earlier emulator loopback runs produced both usable and incorrect transcripts. The 2026-10-20 signed-release rerun stopped and retained generated speech recordings, but Whisper returned `[Music]`/no usable transcript. A final 6 GiB AVD retry enabled both `-allow-host-audio` and runtime host-mic passthrough, yet generated speech still returned an empty transcript (“wind blowing”). This verifies stop and Inbox recovery, not repeatable speech recognition. Human speech and physical headset routing remain unreliable or unverified.
- 2026-11-10 Redmi 3S/API 30 QA confirmed the Hindi model checksum and saved `transcriptionLanguage: "hi"`; recent captures returned English-only transcripts while Whisper labeled them `hi`, so the English-label-only fallback never retried. A previous English-labeled sample's Hindi retry returned Romanized Hinglish containing `dono`; the guard now accepts common Romanized markers. Auto transcript evidence now also triggers forced-Hindi retry when the label says `hi` but the text has no recognized Hindi markers. Physical confirmation of this latest guard remains pending; earlier slow transcription and overlapping-job SIGSEGV were separately addressed by serializing Whisper operations.

## Agent Notes

- Do not present background or lock-screen wake-word as implemented.
- Any audio error path must leave the store with `isRecording: false`.
- Lazy permission request belongs in the store action before recording starts.
- The store now distinguishes `starting`, `recording`, `stopping`, `transcribing`, and `error` capture phases.

- Production transcription diagnostics report counts/status only; full transcripts are never logged.
