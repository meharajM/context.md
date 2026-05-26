# Android Assets Architecture

Bundled Android runtime assets.

## Current Assets

- `whisper-tiny.en.bin`: local Whisper model for speech transcription.
- `ggml-hexagon/*.so`: native accelerator-related libraries currently present as assets.

## Agent Notes

- Do not add large model files casually.
- Document source, license, expected size, and checksum before introducing new model artifacts.
- Android NPU/LiteRT work is deferred.
