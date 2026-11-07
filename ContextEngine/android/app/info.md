# `android/app` Architecture

The Android app module for React Native.

## Important Files

- `build.gradle`: Android app module build configuration.
- `proguard-rules.pro`: release shrinking rules.
- `debug.keystore`: debug signing key.
- `src/main`: manifest, Kotlin host activity/application, assets, and resources.
- `src/androidTest`: test-only Detox instrumentation entrypoint; it is not packaged into release artifacts.

`WidgetVoiceCaptureInstrumentedTest` uses the production microphone service, backgrounds the capture Activity, and verifies WAV finalization, recovery state, and WorkManager enqueue. It removes its uniquely named test audio and cancels only its own queued request.

## Current State

The current Android release scope is typed/text capture plus optional microphone capture from the on-screen control or home-screen widget, followed by local Whisper transcription, local LiteRT-LM synthesis, and context filing. Widget Record starts a native microphone foreground service without opening the main app; the widget shows a live timer and Stop control, then saves a durable WAV for existing local recovery/transcription. Widget Write opens a compact capture sheet rather than the main app. Headset button triggers and lock-screen recording are deferred until physical-device behavior is reliable. Audio import, wake word, assistant voice, and spoken summaries remain future deliverables. Release builds are minified/resource-shrunk and require externally supplied upload-key credentials; they never use the debug key.

Android v1 requests microphone access only when the user starts recording in the app or home-screen widget. Widget recording remains visible on the launcher and can be stopped there or from its foreground notification; in-app recording keeps the existing app controls. Headset button and lock-screen-triggered capture remain disabled.

Release dependency versions are pinned in `build.gradle` (`litertlm-android` `0.14.0`, WorkManager `2.12.0`, Kotlin coroutines `1.11.0`, JSC `2026004.0.1`) so the same native artifacts resolve across release builds. Coroutines `1.11.0` supplies the callback ABI used by LiteRT-LM's async completion path.

Temporary resource-blocked synthesis is scheduled as unique WorkManager work requiring a healthy battery and storage that is not low; screen state does not block it. The worker rechecks memory and thermal readiness, starts React Native directly, and runs the registered Headless JS task inside the worker process. Explicit widget text/audio captures use a separate expedited foreground request, import text and attempt transcription ahead of synthesis retries, then enqueue ordinary topic organization. Each capture worker has its own JS completion ID and may finish alongside an already-running synthesis task; severe thermal pressure or the system low-memory signal still suppresses Whisper startup. Inbox remains durable if Android defers or stops work. Model and Whisper downloads use a separate network/storage-constrained WorkManager request with a visible `dataSync` foreground notification and the existing verified-range resume logic.

Automatic reminders have a separate opt-in, reminder-only WorkManager request after widget text or recovered voice capture. It scans durable notes with the existing local model and leaves normal topic synthesis and audio recovery on their existing path. Notification alarms are inexact and Android may defer them under battery or resource pressure.

`LiteRtModule` creates and checks the per-model cache directory before engine initialization so LiteRT can persist its XNNPack weight cache between runs.

The source manifest keeps Internet access and microphone/foreground-microphone permissions for Android headset capture. It explicitly removes legacy external-storage permissions contributed by `react-native-fs`, marks microphone hardware optional so text capture remains available, disables backup, and delegates Android 12+ cloud/device-transfer exclusions to `res/xml/data_extraction_rules.xml`.

The debug E2E build sets `AndroidJUnitRunner`, selects Detox's `full` test flavor, and builds `app-debug-androidTest.apk` alongside the app APK. The Detox Android artifact is scoped to `androidTestImplementation` only.

`./gradlew app:cleanReleaseArtifacts` removes only generated release-variant outputs/native intermediates after local archive checks, preserving debug and AndroidTest artifacts on disk-constrained development machines.


Google Play production is `1.0.5` / code `6`; Open testing has no active release. The current signed `1.0.6` / code `7` candidate is in `artifacts/release-candidate-1.0.6-code7-20261102-2/`; Android preflight passed 14/14 with source fingerprint `04f62474b51d8c1944363438ed4af91b1b7b7d2480cc4170c4ac7f62c2e1ea91`. Android downloads the pinned 32 MB Whisper tiny.en Q5_1 model on first launch into private storage, then transcribes offline. Each release variant uses AGP's generated-assets API to depend on `generateReleaseProvenance`; this reruns the deterministic source hasher before asset merge and packages `release-provenance.json`. Preflight checks the embedded asset in both APK and AAB against current source bytes, rather than timestamps. Keep source stable throughout final builds.

All maintained Android Detox configurations pass `-PisolatedE2E`, use application id `com.meharaj.contextengine.e2e`, and write under `build/isolated-e2e/`. Debug and release variants both support this suffix. The Java/Kotlin namespace remains `com.meharaj.contextengine`, so explicit activity intents use the fully qualified `com.meharaj.contextengine.MainActivity` inside the isolated package. Production release outputs remain under the normal `build/outputs/` paths.
