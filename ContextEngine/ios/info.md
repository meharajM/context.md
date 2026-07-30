# `ios` Architecture

iOS is the active MVP platform.

## Important Areas

- `ContextEngine`: app target source, native bridge, assets, plist, intents, and launch screen.
- `ContextEngine.xcodeproj` / `ContextEngine.xcworkspace`: Xcode project/workspace.
- `Podfile`: CocoaPods dependencies.
- `LiteRT-LM`: local Swift package/vendor checkout used for LiteRT-LM integration.

## Current Role

The validated synthesis direction is LiteRT-LM on iOS. The TypeScript runtime calls `NativeModules.LiteRtModule`, which is implemented in Swift/Obj-C bridge files in the app target.

The target also contains the `CaptureThoughtIntent` App Intent, a cold-launch-safe assistant event bridge, and complete iPhone/iPad/marketing app icon assets. `npm run ios:release` creates the signed archive at `build/ContextEngine.xcarchive`.

The app target privacy manifest declares no tracking or collected data and carries the required-reason categories used by the app/React Native runtime. Post-install dependency preparation removes the unused `react-native-fs` disk-capacity native export rather than declaring a reason for behavior the app does not use.

## Agent Notes

- Avoid editing Xcode user data and generated build artifacts.
- Do not commit large downloaded model artifacts.
- Keep native bridge behavior aligned with `src/modules/SynthesisEngine/runtimes/LiteRtSynthesisRuntime.ts`.
- Treat `ios/LiteRT-LM` as external dependency code. Prefer changing the app bridge or TypeScript runtime wrapper over modifying LiteRT-LM internals.
