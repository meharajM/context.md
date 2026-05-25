# Task Backlog: Context Engine

## Highest priority

- [ ] Link the `LiteRT-LM` Swift package into the iOS `ContextEngine` target.
- [ ] Run a real LiteRT-LM synthesis smoke test on the app after the package is linked.
- [ ] Bundle or provision the iOS Whisper model consistently for all build targets.
- [ ] Decide whether wake-word support will ship in MVP or remain deferred until a real keyword-spotter model is integrated.

## Next priority

- [ ] Add a verified keyword-spotter model and native foreground wake-word runtime for iOS.
- [ ] Add integration tests for the settings model download flow.
- [ ] Add app-level tests for screen navigation between first-time, home, and settings.
- [ ] Add explicit UI copy for missing-model remediation paths.

## Lower priority

- [ ] Persist runtime settings across restarts if that becomes a product requirement.
- [ ] Evaluate Android LiteRT runtime support after iOS inference is stable.
- [ ] Expand model catalog options after one recommended model is fully validated end-to-end.
