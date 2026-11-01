# `android/app` Architecture

The Android app module for React Native.

## Important Files

- `build.gradle`: Android app module build configuration.
- `proguard-rules.pro`: release shrinking rules.
- `debug.keystore`: debug signing key.
- `src/main`: manifest, Kotlin host activity/application, assets, and resources.
- `src/androidTest`: test-only Detox instrumentation entrypoint; it is not packaged into release artifacts.

## Current State

The current Android release scope is typed/text capture plus optional microphone capture from the on-screen control or home-screen widget, followed by local Whisper transcription, local LiteRT-LM synthesis, and context filing. Widget Record starts a native microphone foreground service without opening the main app; the widget shows a live timer and Stop control, then saves a durable WAV for existing local recovery/transcription. Widget Write opens a compact capture sheet rather than the main app. Headset button triggers and lock-screen recording are deferred until physical-device behavior is reliable. Audio import, wake word, assistant voice, and spoken summaries remain future deliverables. Release builds are minified/resource-shrunk and require externally supplied upload-key credentials; they never use the debug key.

Android v1 requests microphone access only when the user starts recording in the app or home-screen widget. Widget recording remains visible on the launcher and can be stopped there or from its foreground notification; in-app recording keeps the existing app controls. Headset button and lock-screen-triggered capture remain disabled.

Release dependency versions are pinned in `build.gradle` (`litertlm-android` `0.14.0`, WorkManager `2.12.0`, Kotlin coroutines `1.11.0`, JSC `2026004.0.1`) so the same native artifacts resolve across release builds. Coroutines `1.11.0` supplies the callback ABI used by LiteRT-LM's async completion path.

Temporary resource-blocked synthesis is scheduled as unique WorkManager work requiring device idle, a healthy battery, and storage that is not low. The worker rechecks memory and thermal readiness, starts React Native directly, and runs the registered Headless JS task inside the worker process. The task explicitly reports its durable result; the RN task-finished callback gets a short cleanup grace period. It does not start a background service, which Android may reject for an app that is already in the background. Inbox remains the durable source if Android defers or stops work.

Automatic reminders have a separate opt-in, reminder-only WorkManager request after widget text or recovered voice capture. It scans durable notes with the existing local model and leaves normal topic synthesis and audio recovery on their existing path. Notification alarms are inexact and Android may defer them under battery or resource pressure.

`LiteRtModule` creates and checks the per-model cache directory before engine initialization so LiteRT can persist its XNNPack weight cache between runs.

The source manifest keeps Internet access and microphone/foreground-microphone permissions for Android headset capture. It explicitly removes legacy external-storage permissions contributed by `react-native-fs`, marks microphone hardware optional so text capture remains available, disables backup, and delegates Android 12+ cloud/device-transfer exclusions to `res/xml/data_extraction_rules.xml`.

The debug E2E build sets `AndroidJUnitRunner`, selects Detox's `full` test flavor, and builds `app-debug-androidTest.apk` alongside the app APK. The Detox Android artifact is scoped to `androidTestImplementation` only.

`./gradlew app:cleanReleaseArtifacts` removes only generated release-variant outputs/native intermediates after local archive checks, preserving debug and AndroidTest artifacts on disk-constrained development machines.


Production remains `1.0.4` / code `5`; release candidate is `1.0.5` / code `6`. Android downloads the pinned 32 MB Whisper tiny.en Q5_1 model on first launch into private storage, then transcribes offline. Each release variant uses AGP's generated-assets API to depend on `generateReleaseProvenance`; this reruns the deterministic source hasher before asset merge and packages `release-provenance.json`. Preflight checks the embedded asset in both APK and AAB against current source bytes, rather than timestamps. Keep source stable throughout final builds.

All maintained Android Detox configurations pass `-PisolatedE2E`, use application id `com.meharaj.contextengine.e2e`, and write under `build/isolated-e2e/`. Debug and release variants both support this suffix. The Java/Kotlin namespace remains `com.meharaj.contextengine`, so explicit activity intents use the fully qualified `com.meharaj.contextengine.MainActivity` inside the isolated package. Production release outputs remain under the normal `build/outputs/` paths.
