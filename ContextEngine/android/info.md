# `android` Architecture

Android is present as a React Native native target but is not the MVP priority for LiteRT/NPU work.

## Current Role

- Provides the standard React Native Android app shell.
- Bundles Whisper and GGML Hexagon-related assets under `android/app/src/main/assets`.
- Does not currently own the validated LiteRT-LM synthesis path.

## Agent Notes

- Android LiteRT/NPU work is explicitly deferred by `plan.md` and `implementation/status.json`.
- Avoid editing Gradle caches, `.cxx`, build outputs, or generated files.
- If changing Android app code, focus on `android/app` source and Gradle config files.
