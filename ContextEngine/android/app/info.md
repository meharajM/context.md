# `android/app` Architecture

The Android app module for React Native.

## Important Files

- `build.gradle`: Android app module build configuration.
- `proguard-rules.pro`: release shrinking rules.
- `debug.keystore`: debug signing key.
- `src/main`: manifest, Kotlin host activity/application, assets, and resources.
- `src/androidTest`: test-only Detox instrumentation entrypoint; it is not packaged into release artifacts.

## Current State

Android supports the full shared React Native flow plus native voice file picking, assistant App Actions, Whisper, and LiteRT-LM integration. Release builds are minified/resource-shrunk and require externally supplied upload-key credentials; they never use the debug key.

Release dependency versions are pinned in `build.gradle` (`litertlm-android` `0.14.0`, JSC `2026004.0.1`) so the same native artifacts resolve across release builds.

The source manifest keeps only Internet and microphone permissions active. It explicitly removes legacy external-storage permissions contributed by `react-native-fs`, marks microphone hardware optional for typed capture, disables backup, and delegates Android 12+ cloud/device-transfer exclusions to `res/xml/data_extraction_rules.xml`.

The debug E2E build sets `AndroidJUnitRunner`, selects Detox's `full` test flavor, and builds `app-debug-androidTest.apk` alongside the app APK. The Detox Android artifact is scoped to `androidTestImplementation` only.

`./gradlew app:cleanReleaseArtifacts` removes only generated release-variant outputs/native intermediates after local archive checks, preserving debug and AndroidTest artifacts on disk-constrained development machines.
