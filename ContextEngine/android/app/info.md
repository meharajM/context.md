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

Current source supports typed/text capture, optional microphone capture, local synthesis, and topic filing. Eligible Android devices automatically select Gemma 3n E2B for transcription and writing; lower-resource devices use Whisper plus Gemma3-1B. Widget Record starts a native microphone foreground service without opening the main app, with timer and Stop controls; Widget Write opens a compact capture sheet. Android also exposes opt-in headset media-button and lock-screen capture through a visible foreground notification; physical accessory delivery remains unverified. Audio import, wake word, assistant voice, and spoken summaries remain deferred. Published Android behavior may lag this source; check `implementation/status.json` before release claims. Release builds are minified/resource-shrunk and require externally supplied upload-key credentials; they never use the debug key.

Android requests microphone access only after the user starts recording in the app, widget, or opted-in headset/lock-screen flow. Widget recording remains visible on the launcher and can be stopped there or from its foreground notification; in-app recording keeps the existing app controls. Headset and lock-screen capture use the visible foreground notification with Stop/disable controls.

Release dependency versions are pinned in `build.gradle` (`litertlm-android` `0.14.0`, WorkManager `2.12.0`, Kotlin coroutines `1.11.0`, JSC `2026004.0.1`) so the same native artifacts resolve across release builds. Coroutines `1.11.0` supplies the callback ABI used by LiteRT-LM's async completion path.

Google Play in-app updates use pinned `app-update` and `app-update-ktx` `2.1.0`. `MainActivity` checks availability on foreground and starts a flexible update when Play permits it. Users can keep using the app during download, then choose when to restart; dismissing a version snoozes its prompt for seven days. The submitted Play build does not include current working-tree changes; increment the version code above 12 before a new upload.

Temporary resource-blocked synthesis is scheduled as unique WorkManager work requiring a healthy battery and storage that is not low; screen state does not block it. The worker rechecks memory and thermal readiness, starts React Native directly, and runs the registered Headless JS task inside the worker process. Explicit widget text/audio captures use a separate expedited foreground request, import text and attempt transcription ahead of synthesis retries, then enqueue ordinary topic organization. Each capture worker has its own JS completion ID and may finish alongside an already-running synthesis task; severe thermal pressure or the system low-memory signal still suppresses transcription-model startup. Inbox remains durable if Android defers or stops work. Explicit user-started model downloads on API 34+ use JobScheduler's user-initiated data-transfer job; automatic downloads and API 33-and-lower downloads use a network/storage-constrained WorkManager request with a visible `dataSync` foreground notification. Both paths use verified-range resume.

Automatic reminders have a separate opt-in, reminder-only WorkManager request after widget text or recovered voice capture. It scans durable notes with the existing local model and leaves normal topic synthesis and audio recovery on their existing path. Notification alarms are inexact and Android may defer them under battery or resource pressure.

`LiteRtModule` creates and checks the per-model cache directory before engine initialization so LiteRT can persist its XNNPack weight cache between runs.

The source manifest keeps Internet access and microphone/foreground-microphone permissions for Android headset capture. It explicitly removes legacy external-storage permissions contributed by `react-native-fs`, marks microphone hardware optional so text capture remains available, disables backup, and delegates Android 12+ cloud/device-transfer exclusions to `res/xml/data_extraction_rules.xml`.

The debug E2E build sets `AndroidJUnitRunner`, selects Detox's `full` test flavor, and builds `app-debug-androidTest.apk` alongside the app APK. The Detox Android artifact is scoped to `androidTestImplementation` only.

`./gradlew app:cleanReleaseArtifacts` removes only generated release-variant outputs/native intermediates after local archive checks, preserving debug and AndroidTest artifacts on disk-constrained development machines.


As of the last verified Play check (2026-11-19), production was `1.0.10` / code `11` and `1.0.11` / code `12` was in review. This working tree has changes beyond that submitted candidate; increment the version code before a new upload. Any release must use the same application ID and upload key so Android updates retain users' app data, and repeat signing, provenance, and production preflight from final source. Android downloads the pinned 32 MB Whisper tiny.en Q5_1 model on first launch into private storage, then transcribes offline. Each release variant uses AGP's generated-assets API to depend on `generateReleaseProvenance`; this reruns the deterministic source hasher before asset merge and packages `release-provenance.json`. Preflight checks the embedded asset in both APK and AAB against current source bytes, rather than timestamps. Keep source stable throughout final builds.

All maintained Android Detox configurations pass `-PisolatedE2E`, use application id `com.meharaj.contextengine.e2e`, and write under `build/isolated-e2e/`. Debug and release variants both support this suffix. The Java/Kotlin namespace remains `com.meharaj.contextengine`, so explicit activity intents use the fully qualified `com.meharaj.contextengine.MainActivity` inside the isolated package. Production release outputs remain under the normal `build/outputs/` paths.
