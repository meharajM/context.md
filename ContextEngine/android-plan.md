# Android Support Implementation Plan

This plan details the steps required to port all iOS-specific native modules and UI considerations of **Context Engine** to **Android**.

## User Review Required

> [!WARNING]
> This change introduces the `com.google.ai.edge.litertlm` dependency to the Android project. Make sure the build machine has internet access during the initial sync to download the LiteRT-LM Android library from Google Maven.

> [!IMPORTANT]
> The Android emulator must have sufficient RAM allocated (at least 4GB, preferably 6GB+) if running Gemma3-1B-IT on-device in the emulator. Alternatively, testing on a physical Android device is recommended.

## Proposed Changes

We will introduce and modify the following files:

### 1. Android Build Configuration
#### [MODIFY] [build.gradle](file:///Users/meharaj/context.md/ContextEngine/android/app/build.gradle)
Add LiteRT-LM and Kotlin coroutines dependencies:
```gradle
dependencies {
    // ... existing ...
    implementation("com.google.ai.edge.litertlm:litertlm-android:latest.release")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

### 2. Android Native Modules
#### [NEW] [LiteRtModule.kt](file:///Users/meharaj/context.md/ContextEngine/android/app/src/main/java/com/meharaj/contextengine/LiteRtModule.kt)
Implement the Android LiteRT-LM bridge:
* Exposes `isAvailable`, `loadModel`, `synthesize`, `benchmark`, `release`.
* Uses `com.google.ai.edge.litertlm.Engine`, `Conversation`, and `SamplerConfig`.
* Manages concurrency on a single background dispatcher thread to prevent race conditions.

#### [NEW] [EventEmitter.kt](file:///Users/meharaj/context.md/ContextEngine/android/app/src/main/java/com/meharaj/contextengine/EventEmitter.kt)
Implement event emission and TTS guidance:
* Implements `announceGuidance(text)` using `android.speech.tts.TextToSpeech`.
* Exposes `RCTDeviceEventEmitter` registration.

#### [NEW] [AudioPlayerModule.kt](file:///Users/meharaj/context.md/ContextEngine/android/app/src/main/java/com/meharaj/contextengine/AudioPlayerModule.kt)
Implement voice file playback:
* Implements `play(filePath)` and `stop()` using `android.media.MediaPlayer`.

#### [NEW] [ContextEnginePackage.kt](file:///Users/meharaj/context.md/ContextEngine/android/app/src/main/java/com/meharaj/contextengine/ContextEnginePackage.kt)
Register all native modules in a ReactPackage:
* Includes `LiteRtModule`, `EventEmitter`, and `AudioPlayerModule`.

#### [MODIFY] [MainApplication.kt](file:///Users/meharaj/context.md/ContextEngine/android/app/src/main/java/com/meharaj/contextengine/MainApplication.kt)
Register the new package:
```kotlin
        PackageList(this).packages.apply {
            add(ContextEnginePackage())
        }
```

### 3. Frontend / JS / TS Integration
#### [MODIFY] [LiteRtSynthesisRuntime.ts](file:///Users/meharaj/context.md/ContextEngine/src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts)
* Enable Android support by removing or updating the `Platform.OS !== 'ios'` check.
* Ensure fallback paths compile and run on Android.

#### [MODIFY] [SettingsScreen.tsx](file:///Users/meharaj/context.md/ContextEngine/src/features/settings/SettingsScreen.tsx)
* Render `AssistantShortcutsSection` conditionally on `Platform.OS === 'ios'` only.

#### [MODIFY] [useHeadsetTripleTapCapture.ts](file:///Users/meharaj/context.md/ContextEngine/src/shared/hooks/useHeadsetTripleTapCapture.ts)
* Update `Platform.OS === 'ios'` checks to include `Platform.OS === 'android'` so that `announceGuidance` can be called from the Android bridge too.

#### [MODIFY] [useAssistantIntentCapture.ts](file:///Users/meharaj/context.md/ContextEngine/src/shared/hooks/useAssistantIntentCapture.ts)
* Update platform support checks for Android.

---

## Verification Plan

### Automated Verification
* Run typechecking:
  ```bash
  npm run typecheck
  ```
* Run all unit tests:
  ```bash
  npm test
  ```

### Manual Verification
* Build and launch the app in Android:
  ```bash
  npm run android
  ```
* Verify in settings that the model catalog downloads the `.litertlm` files correctly.
* Record thoughts on Android and check local files persistence under `reflections`.
