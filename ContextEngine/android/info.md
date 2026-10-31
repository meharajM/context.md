# `android` Architecture

Android is an active React Native publication target.

## Current Role

- Provides capture, import, local persistence, Whisper transcription, assistant App Actions, and LiteRT-LM synthesis bridges.
- Produces a minified and resource-shrunk Play AAB with `npm run android:release`.
- Requires externally supplied Play upload-key properties; release never falls back to the debug key.
- Targets Android 16 / API 36 for the 31 August 2026 Play submission deadline.
- Declares Android 7 / API 24 as the minimum OS, targets API 36, and packages `arm64-v8a` only. The selected on-device model is about 557 MB and recommends 4 GiB total RAM with about 1 GiB available; notes remain available when synthesis is resource-blocked.
- Compatibility QA: earlier release APK runtime checks passed install/launch and user-started microphone foreground recording with background Stop and Inbox retention on API 31, 33, 34, and 35; API 36 / 16 KB widget-recording QA and API 30 Detox also pass. The latest rebuilt signed APK installed/launched on API 32 and passed typed Inbox save plus the same background recording/Stop/Inbox-retention flow. Typed Inbox saves also passed on API 31 and 33. The only Android source change since the earlier APK runtime checks was an API-level annotation on the Android 12+ audio-route helper.
- Android 17/API 37 runtime remains unverified: both a 37.2 Google Play 16 KB image and a 37.0 Google APIs image failed to boot under the local emulator (offline/hung QEMU, then exit 139); their temporary images were removed. Static review found note playback is user-triggered from the visible UI, no background audio focus/volume APIs are used, and the widget uses resource-backed `RemoteViews` with `PendingIntent`s rather than bitmap payloads. Android 17's all-app memory limiter still applies to background synthesis; real-model inference under its 4 GiB device budget has not been tested.
- Uses Kotlin `2.3.0` because LiteRT-LM `0.14.0` publishes Kotlin 2.3 metadata; the settings plugin pins R8 `8.13.19`, Google's documented Kotlin 2.3 compatibility floor, while React Native supplies AGP 8.12.
- `npm run android:check-16k` validates both APK ZIP alignment and all packaged arm64 native libraries for Google Play's mandatory 16 KB page-size support.
- Keeps app-private notes, recordings, preferences, and models out of Android cloud/device-transfer backups.
- Headset button triggers and lock-screen recording remain gated off in the v1 release pending reliable physical-device verification.
- Resolves the Detox instrumentation AAR from the installed npm package's local Maven repository; this dependency is test-only and does not enter release artifacts.

## Agent Notes

- Avoid editing Gradle caches, `.cxx`, build outputs, or generated files.
- If changing Android app code, focus on `android/app` source and Gradle config files.
