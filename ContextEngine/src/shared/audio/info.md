# `src/shared/audio` Architecture

Shared diagnostic audio references and retained-recording path safety helpers.

## Files

- `sampleAudio.ts`: exports a sample audio asset reference used by the dev transcription probe.
- `retainedAudio.ts`: defines the app-owned `Documents/retained-audio` directory contract, normalizes local file URLs, and rejects filenames/paths outside generated retained WAVs.
- `recordingRecovery.ts`: persists WAV descriptors and recovers validated files after interruption. A validated optional meeting id routes recovered meeting audio back to its session; ordinary voice recovery remains routed through Inbox.

This directory is not the main app recording pipeline. Live recording is handled by `src/modules/AudioEngine`.
