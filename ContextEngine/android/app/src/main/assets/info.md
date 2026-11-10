# Android Assets Architecture

Bundled Android runtime assets.

## Current Assets

- `ggml-hexagon/*.so`: native accelerator-related libraries currently present as assets.

## Downloaded Runtime Models

- Android downloads `whisper-tiny.en-q5_1.bin` after first launch into private app storage at `files/models/`. Transcription stays on-device after installation.
- Source: `ggerganov/whisper.cpp` [`ggml-tiny.en-q5_1.bin`](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.en-q5_1.bin)
- License: MIT (Whisper and whisper.cpp)
- Size: 32,166,155 bytes
- SHA-256: `c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b`

- Settings can download the optional multilingual Hindi / Hinglish model `ggml-tiny-q5_1.bin`; it transcribes Hindi-English speech with language auto-detection.
- Source: [`ggml-tiny-q5_1.bin`](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny-q5_1.bin)
- License: MIT (Whisper and whisper.cpp)
- Size: 32,152,673 bytes (31 MiB)
- SHA-256: `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7`

## Agent Notes

- Do not add large model files casually.
- Document source, license, expected size, and checksum before introducing new model artifacts.
- Keep accelerator assets aligned with the active Android LiteRT/Whisper bridges and verify them on target hardware before changing ABI or packaging rules.
