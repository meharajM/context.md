# `src/shared/audio` Architecture

Shared diagnostic audio references and retained-recording path safety helpers.

## Files

- `sampleAudio.ts`: exports a sample audio asset reference used by the dev transcription probe.
- `retainedAudio.ts`: defines the app-owned `Documents/retained-audio` directory contract, normalizes local file URLs, and rejects filenames/paths outside generated retained WAVs.

This directory is not the main app recording pipeline. Live recording is handled by `src/modules/AudioEngine`.
