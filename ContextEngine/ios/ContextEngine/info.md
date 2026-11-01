# `ios/ContextEngine` Architecture

iOS app target source.

## Important Files

- `AppDelegate.swift`: React Native app delegate setup.
- `LiteRtModule.swift`: Swift implementation of the LiteRT-LM bridge.
- `LiteRtModule.m`: Objective-C React Native bridge export.
- `EventEmitter.swift` / `EventEmitter.m`: native event emitter scaffolding.
- `ShortcutsSetupButton.swift` / `ShortcutsSetupButton.m`: native one-tap bridge to the app's App Shortcuts surface.
- `VoiceFilePickerModule.swift` / `VoiceFilePickerModule.m`: native document picker bridge for local voice-file imports and user-selected JSON backup import/export.
- `AutomaticReminderModule.swift` / `AutomaticReminderModule.m`: local notification scheduler bridge for inferred reminders and Done/Snooze actions.
- `QuickCaptureWidget/`: iOS 17+ WidgetKit Write/Record actions that store a one-shot capture request in the shared App Group and open the app.
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
- `getDeviceReadiness()` for physical RAM, process-available memory, thermal state, simulator detection, and OS version.

The TypeScript side expects this shape in `LiteRtSynthesisRuntime.ts`.

The native LiteRT system instruction stays below 96 UTF-8 bytes to match the shared bounded-prompt planner; per-call instructions are supplied by TypeScript.

Response parsing rejects missing/invalid topic, refinedText, or tags fields as raw fallback; native defaults must never fabricate a generated summary. Reversed JSON delimiters also return fallback without constructing an invalid Swift range.

Synthesis responses preserve optional `needsClarification` and `clarification` question/options fields so ambiguous routing can remain in the JS queue for user resolution.
Malformed clarification flags or clarification data without a flag return raw fallback instead of selecting a topic silently.

## LiteRT Safety Rules

- `Engine`, `Conversation`, `Conversation.sendMessage`, model load, and release operations run through a single serial native execution queue.
- `synthesize(...)` has a native timeout and rejects with `LITERT_SYNTHESIS_TIMEOUT` if inference exceeds the release budget.
- Native errors clear the loaded engine/conversation so a possibly corrupted LiteRT-LM state is not reused.
- Rejections include model path, backend, max token count, and LiteRT state to support simulator crash triage.
- GPU LiteRT-LM is rejected on iOS Simulator for the current release gate; CPU remains the supported simulator backend.
- `EventEmitter` forwards assistant shortcut payloads to JS through the `AssistantCaptureRequested` event.
- A prototype maps the system `previousTrackCommand` produced by a compatible triple press to `HeadsetTripleTapRequested`; the runtime headset trigger remains disabled by the release capability gate.
- The app does not publish fake Now Playing metadata or start silent playback. The microphone/background-audio permission supports only a user-started recording continuing when the app backgrounds.
- `EventEmitter` exposes `announceGuidance(text)` for brief spoken readiness feedback from JS trigger flows.
- The compiled app target uses `ios/EventEmitter.swift` and `ios/EventEmitter.m`; tracker and QA work should treat those as the authoritative bridge files for real-device behavior.
- The compiled app target also uses `ios/ContextEngine/VoiceFilePickerModule.swift` and `.m` for the import screen's local voice-file selection flow.
- The same picker bridge exports JSON backups and opens selected JSON backups; imports are read from the picker-provided copy and export succeeds without retaining the chosen destination URL.
- The user-facing display and launch-screen name is `Thought Notes`. The target declares background audio for an explicit recording started in the app.
- The microphone purpose string states that recording begins only from user-started voice capture and is processed on device; export compliance is declared as non-exempt-encryption false.
- The Objective-C bridge must not export `supportedEvents` as an extern method. React Native reads the subclass override directly, and exporting the method caused the real-device startup redbox where only `AssistantCaptureRequested` was recognized.
- `ShortcutsSetupButton` exposes the platform-supported one-tap Shortcuts setup entry point to React Native.

## iOS v1 scope

The app target supports explicit in-app voice capture using bundled Whisper with microphone disclosure and background audio; return to the app to stop. Its iOS 17+ widget opens the app for Write or Record. Automatic reminders use local notifications and require the user to enable them. `src/core/releaseCapabilities.ts` continues to disable assistant intake, wake word, and headset triggering on iOS. Existing retained recordings can be managed locally. The app target supports iOS 15.1+; the widget requires iOS 17+.
