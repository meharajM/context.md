# `ios/ContextEngine` Architecture

iOS app target source.

## Important Files

- `AppDelegate.swift`: React Native app delegate setup.
- `LiteRtModule.swift`: Swift implementation of the LiteRT-LM bridge.
- `LiteRtModule.m`: Objective-C React Native bridge export.
- `EventEmitter.swift` / `EventEmitter.m`: native event emitter scaffolding.
- `ShortcutsSetupButton.swift` / `ShortcutsSetupButton.m`: native one-tap bridge to the app's App Shortcuts surface.
- `Info.plist`: iOS app metadata and permissions.
- `PrivacyInfo.xcprivacy`: privacy manifest.
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

## LiteRT Safety Rules

- `Engine`, `Conversation`, `Conversation.sendMessage`, model load, and release operations run through a single serial native execution queue.
- `synthesize(...)` has a native timeout and rejects with `LITERT_SYNTHESIS_TIMEOUT` if inference exceeds the release budget.
- Native errors clear the loaded engine/conversation so a possibly corrupted LiteRT-LM state is not reused.
- Rejections include model path, backend, max token count, and LiteRT state to support simulator crash triage.
- GPU LiteRT-LM is rejected on iOS Simulator for the current release gate; CPU remains the supported simulator backend.
- `EventEmitter` forwards assistant shortcut payloads to JS through the `AssistantCaptureRequested` event.
- `EventEmitter` also detects rapid headset remote toggle commands and emits `HeadsetTripleTapRequested` to JS with debounce protection.
- `EventEmitter` exposes `announceGuidance(text)` for brief spoken readiness feedback from JS trigger flows.
- `ShortcutsSetupButton` exposes the platform-supported one-tap Shortcuts setup entry point to React Native.
