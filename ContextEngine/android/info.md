# `android` Architecture

Android is an active React Native publication target.

## Current Role

- Provides capture, import, local persistence, Whisper transcription, assistant App Actions, and LiteRT-LM synthesis bridges.
- Produces a minified and resource-shrunk Play AAB with `npm run android:release`.
- Requires externally supplied Play upload-key properties; release never falls back to the debug key.
- Targets Android 16 / API 36 for the 31 August 2026 Play submission deadline.
- Uses Kotlin `2.3.0` because LiteRT-LM `0.14.0` publishes Kotlin 2.3 metadata; the settings plugin pins R8 `8.13.19`, Google's documented Kotlin 2.3 compatibility floor, while React Native supplies AGP 8.12.
- `npm run android:check-16k` validates both APK ZIP alignment and all packaged arm64 native libraries for Google Play's mandatory 16 KB page-size support.
- Keeps app-private notes, recordings, preferences, and models out of Android cloud/device-transfer backups.
- Resolves the Detox instrumentation AAR from the installed npm package's local Maven repository; this dependency is test-only and does not enter release artifacts.

## Agent Notes

- Avoid editing Gradle caches, `.cxx`, build outputs, or generated files.
- If changing Android app code, focus on `android/app` source and Gradle config files.
