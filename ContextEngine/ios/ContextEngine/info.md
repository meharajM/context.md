# `ios/ContextEngine` Architecture

iOS app target source.

## Important Files

- `AppDelegate.swift`: React Native setup, BGProcessingTask registration, and RNFS background URLSession completion forwarding.
- `LiteRtModule.swift`: Swift implementation of the LiteRT-LM bridge.
- `LiteRtModule.m`: Objective-C React Native bridge export.
- `EventEmitter.swift` / `EventEmitter.m`: native event emitter scaffolding.
- `ShortcutsSetupButton.swift` / `ShortcutsSetupButton.m`: native one-tap bridge to the app's App Shortcuts surface.
- `VoiceFilePickerModule.swift` / `VoiceFilePickerModule.m`: native document picker bridge for local voice-file imports and user-selected JSON backup import/export.
- `AutomaticReminderModule.swift` / `AutomaticReminderModule.m`: local notification scheduler bridge for inferred reminders and Done/Snooze actions.
- `QuickCaptureWidget/`: iOS 17+ WidgetKit Write/Record/Meeting links that open the app through its registered URL scheme; React Native Linking routes each URL into the shared JavaScript flow. Write opens a quick-note sheet; Record opens visible controls and starts capture. WidgetKit itself cannot host arbitrary text entry or microphone recording.
- `Info.plist`: iOS app metadata and permissions.
- `PrivacyInfo.xcprivacy`: privacy manifest declaring no tracking/collection and the required UserDefaults, file-timestamp, and system-boot-time reasons used by the app and React Native runtime.
- `LaunchScreen.storyboard`: launch screen.
- `Intents`: app intents.
- `Assets/models`: bundled native model assets when present.

The LiteRT audio bridge accepts audio only when the selected model is marked `supportsAudio`; Gemma 3n E2B configures LiteRT-LM's CPU audio backend and receives absolute WAV paths. Both mobile platforms use the unified Gemma path when device RAM/storage fit; lower-resource phones download Whisper tiny.en at runtime. Whisper weights are not bundled in the iOS target.

## Bridge Contract

`LiteRtModule` must expose:

- `isAvailable()`
- `loadModel(config)`
- `synthesize(input)`
- `transcribeAudio(input)` when the selected model accepts audio.
- `transcribeAudio(input)` for supported audio models.
- `benchmark(fixtures)`
- `release()`
- `getDeviceReadiness()` for physical RAM, process-available memory, thermal state, simulator detection, and OS version.
- `prepareResearchCall(config, task)` for a temporary CPU FunctionGemma engine that prepares one local handoff tool call; the tool only captures query fields and does not launch an app or fetch content.

The TypeScript side expects this shape in `LiteRtSynthesisRuntime.ts`.

The native LiteRT system instruction stays below 96 UTF-8 bytes to match the shared bounded-prompt planner; per-call instructions are supplied by TypeScript.

Response parsing rejects missing/invalid topic, refinedText, or tags fields as raw fallback; native defaults must never fabricate a generated summary. Reversed JSON delimiters also return fallback without constructing an invalid Swift range.

Synthesis responses preserve optional `needsClarification` and `clarification` question/options fields so ambiguous routing can remain in the JS queue for user resolution.
Malformed clarification flags or clarification data without a flag return raw fallback instead of selecting a topic silently.

## LiteRT Safety Rules

- `Engine`, `Conversation`, `Conversation.sendMessage`, model load, and release operations run through a single serial native execution queue.
- `synthesize(...)` marks a native timeout after 60 seconds. Since the LiteRT C API's `sendMessage` call blocks, timeout must not call `cancel_process` concurrently on the same conversation handle; the request settles after inference unwinds, while the JavaScript guard rejects at 65 seconds.
- The native runtime loads only the selected, installed catalog model. The LiteRT test fixture is not packaged in the app or used as a fallback model.
- Native errors clear the loaded engine/conversation so a possibly corrupted LiteRT-LM state is not reused.
- `loadModel` creates the configured cache directory recursively before constructing `EngineConfig`, allowing LiteRT-LM/XNNPack to persist its CPU weight cache.
- Rejections include model path, backend, max token count, and LiteRT state to support simulator crash triage.
- GPU LiteRT-LM is rejected on iOS Simulator for the current release gate; CPU remains the supported simulator backend.
- `EventEmitter` forwards assistant shortcut payloads to JS through the `AssistantCaptureRequested` event.
- A prototype maps the system `previousTrackCommand` produced by a compatible triple press to `HeadsetTripleTapRequested`; the runtime headset trigger remains disabled by the release capability gate.
- The app does not publish fake Now Playing metadata or start silent playback. The microphone/background-audio permission supports only a user-started recording continuing when the app backgrounds.
- `EventEmitter` exposes `announceGuidance(text)` for brief spoken readiness feedback from JS trigger flows.
- `BGProcessingTask` retries eligible Inbox synthesis when iOS grants idle runtime; the OS may defer or expire work, so Inbox and launch/foreground requeue remain the recovery path. Background model downloads use RNFS URLSession callbacks forwarded by AppDelegate.
- The compiled app target uses `ios/EventEmitter.swift` and `ios/EventEmitter.m`; tracker and QA work should treat those as the authoritative bridge files for real-device behavior.
- The compiled app target also uses `ios/ContextEngine/VoiceFilePickerModule.swift` and `.m` for the import screen's local voice-file selection flow.
- The same picker bridge exports JSON backups and opens selected JSON backups; imports are read from the picker-provided copy and export succeeds without retaining the chosen destination URL.
- The user-facing display and launch-screen name is `Thought Notes`. The target declares background audio for an explicit recording started in the app.
- The microphone purpose string states that recording begins only from user-started voice capture and is processed on device; export compliance is declared as non-exempt-encryption false.
- The Objective-C bridge must not export `supportedEvents` as an extern method. React Native reads the subclass override directly, and exporting the method caused the real-device startup redbox where only `AssistantCaptureRequested` was recognized.
- `ShortcutsSetupButton` exposes the platform-supported one-tap Shortcuts setup entry point to React Native.

## iOS v1 scope

The app target supports explicit in-app voice capture with automatic model selection: capable iPhones use Gemma 3n E2B for transcription and note organization, while lower-resource iPhones use Whisper tiny.en with the smaller Gemma writing model. A missing voice model does not block recording; retained audio stays available for retry. Microphone disclosure and background audio apply; return to the app to stop. Its iOS 17+ Home and Lock Screen widgets open the app for Write or Record through a registered URL scheme; Record starts capture in the app. Direct headset commands stay gated because iOS routes them through the current Now Playing app. Automatic reminders use local notifications and require the user to enable them. Assistant intake and wake word remain gated by `src/core/releaseCapabilities.ts`. Existing retained recordings can be managed locally. The app target supports iOS 15.1+; the widget requires iOS 17+.
