# `ios/ContextEngine` Architecture

iOS app target source.

## Important Files

- `AppDelegate.swift`: React Native app delegate setup.
- `LiteRtModule.swift`: Swift implementation of the LiteRT-LM bridge.
- `LiteRtModule.m`: Objective-C React Native bridge export.
- `EventEmitter.swift` / `EventEmitter.m`: native event emitter scaffolding.
- `ShortcutsSetupButton.swift` / `ShortcutsSetupButton.m`: native one-tap bridge to the app's App Shortcuts surface.
- `VoiceFilePickerModule.swift` / `VoiceFilePickerModule.m`: native document picker bridge for local voice-file imports.
- `Info.plist`: iOS app metadata and permissions.
- `PrivacyInfo.xcprivacy`: privacy manifest declaring no tracking/collection and the required UserDefaults, file-timestamp, and system-boot-time reasons used by the app and React Native runtime.
- `LaunchScreen.storyboard`: launch screen.
- `Intents`: app intents.
- `Assets/models`: bundled native model assets when present.

## Bridge Contract

`LiteRtModule` must expose:

- `isAvailable()`
- `loadModel(config)`
- `synthesize(input)`
- `benchmark(fixtures)`
- `release()`

The TypeScript side expects this shape in `LiteRtSynthesisRuntime.ts`.

Synthesis responses preserve optional `needsClarification` and `clarification` question/options fields so ambiguous routing can remain in the JS queue for user resolution.

## LiteRT Safety Rules

- `Engine`, `Conversation`, `Conversation.sendMessage`, model load, and release operations run through a single serial native execution queue.
- `synthesize(...)` has a native timeout and rejects with `LITERT_SYNTHESIS_TIMEOUT` if inference exceeds the release budget.
- Native errors clear the loaded engine/conversation so a possibly corrupted LiteRT-LM state is not reused.
- Rejections include model path, backend, max token count, and LiteRT state to support simulator crash triage.
- GPU LiteRT-LM is rejected on iOS Simulator for the current release gate; CPU remains the supported simulator backend.
- `EventEmitter` forwards assistant shortcut payloads to JS through the `AssistantCaptureRequested` event.
- The compiled `EventEmitter` maps the system `previousTrackCommand` produced by a compatible triple press to `HeadsetTripleTapRequested` with debounce protection while the app is active.
- The app does not publish fake Now Playing metadata or start silent playback to gain remote-command eligibility. Background/lock-screen headset capture therefore remains unsupported pending a legitimate platform audio contract and physical-device validation.
- `EventEmitter` exposes `announceGuidance(text)` for brief spoken readiness feedback from JS trigger flows.
- The compiled app target uses `ios/EventEmitter.swift` and `ios/EventEmitter.m`; tracker and QA work should treat those as the authoritative bridge files for real-device behavior.
- The compiled app target also uses `ios/ContextEngine/VoiceFilePickerModule.swift` and `.m` for the import screen's local voice-file selection flow.
- The user-facing display and launch-screen name is `Context Engine`. The target does not declare background-audio capability because capture and headset handling are limited to the supported active app scope.
- The microphone purpose string states that recording begins only from user-started voice capture and is processed on device; export compliance is declared as non-exempt-encryption false.
- The Objective-C bridge must not export `supportedEvents` as an extern method. React Native reads the subclass override directly, and exporting the method caused the real-device startup redbox where only `AssistantCaptureRequested` was recognized.
- `ShortcutsSetupButton` exposes the platform-supported one-tap Shortcuts setup entry point to React Native.
