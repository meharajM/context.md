# `android/app` Architecture

The Android app module for React Native.

## Important Files

- `build.gradle`: Android app module build configuration.
- `proguard-rules.pro`: release shrinking rules.
- `debug.keystore`: debug signing key.
- `src/main`: manifest, Kotlin host activity/application, assets, and resources.

## Current State

Android supports the basic React Native target. LiteRT/NPU validation is deferred until the iOS MVP is stable.
