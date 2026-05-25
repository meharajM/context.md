# Progress Tracker: Context Engine

## Last verified update: 2026-05-26

## Verified phase state

| Phase | Status | Notes |
| :--- | :--- | :--- |
| Phase 00 baseline | Validated | Install, lint, typecheck, and Jest workflow are reproducible. |
| Phase 01 app shell and settings | Validated | Launchable app shell, runtime settings, manual save, context path initialization. |
| Phase 02 context store and queue | Validated | Inbox fallback, atomic save fallback, queue listeners, capped retries, persistence on failure. |
| Phase 03 LiteRT synthesis | Blocked | TypeScript, model manager, and iOS bridge are in place; native LiteRT-LM package linking and real inference validation are still pending. |
| Phase 04 audio and wake-word | In progress | Push-to-record readiness gating is implemented; wake word remains disabled until a keyword-spotter model is bundled. |
| Phase 05 docs and release | In progress | Docs and tests are being aligned to verified MVP behavior. |

## Recent verified work

- Added a first-time, home, and settings screen split in the app shell.
- Added a downloadable on-device LiteRT-LM model catalog with `Gemma3-1B-IT` as the recommended option.
- Verified the model download flow on the iPhone 16 iOS 18.6 simulator.
- Removed non-LiteRT synthesis paths from the active runtime.
- Added audio readiness state so recording is disabled when Whisper is unavailable.
- Stopped exposing background wake-word capture as an active MVP feature.
- Fixed the first-time screen composer duplication regression.
- Added tests for audio gating and the single shared composer flow.

## Active blockers

1. Real LiteRT-LM inference is not validated yet.
   - The iOS target still needs the `LiteRT-LM` Swift package linked.
   - A compatible `.litertlm` model must exist on-device.
   - A real synthesis smoke test must pass on a built app.

2. Wake-word runtime is intentionally incomplete.
   - The app is foreground-only by design.
   - No keyword-spotter model is currently bundled for iOS.

## Not verified and should not be claimed

- Background or locked-screen wake-word capture
- Hardware trigger integration
- Android LiteRT/NPU support
- Persisted user settings
