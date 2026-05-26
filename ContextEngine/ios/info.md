# `ios` Architecture

iOS is the active MVP platform.

## Important Areas

- `ContextEngine`: app target source, native bridge, assets, plist, intents, and launch screen.
- `ContextEngine.xcodeproj` / `ContextEngine.xcworkspace`: Xcode project/workspace.
- `Podfile`: CocoaPods dependencies.
- `LiteRT-LM`: local Swift package/vendor checkout used for LiteRT-LM integration.

## Current Role

The validated synthesis direction is LiteRT-LM on iOS. The TypeScript runtime calls `NativeModules.LiteRtModule`, which is implemented in Swift/Obj-C bridge files in the app target.

## Agent Notes

- Avoid editing Xcode user data and generated build artifacts.
- Do not commit large downloaded model artifacts.
- Keep native bridge behavior aligned with `src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts`.
- Treat `ios/LiteRT-LM` as external dependency code. Prefer changing the app bridge or TypeScript runtime wrapper over modifying LiteRT-LM internals.
