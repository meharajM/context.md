# `ios/ContextEngine` Architecture

iOS app target source.

## Important Files

- `AppDelegate.swift`: React Native app delegate setup.
- `LiteRtModule.swift`: Swift implementation of the LiteRT-LM bridge.
- `LiteRtModule.m`: Objective-C React Native bridge export.
- `EventEmitter.swift` / `EventEmitter.m`: native event emitter scaffolding.
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
