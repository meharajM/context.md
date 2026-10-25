# `src/features/settings` Architecture

Settings exposes runtime controls and local model management.

## Files

- `SettingsScreen.tsx`: settings composition, including user-initiated JSON library backup actions.
- `CaptureModesSection.tsx`: manual recording, gated voice capture, and LiteRT toggles.
- Android development builds expose a bundled-sample Whisper probe in Capture Modes; it is excluded from production builds and reports its result inline for speech-path QA.
- `AssistantShortcutsSection.tsx`: platform-specific Siri/Shortcuts or Google Assistant setup/binding guidance for assistant capture.
- `ShortcutsSetupButton.tsx`: one-tap native entry point into the app's Shortcuts setup surface, with a JS fallback when native UI is unavailable.
- `ModelManagementSection.tsx`: model selection/download/delete actions.
- `DiagnosticsSection.tsx`: readiness, path, and diagnostic status display.
- `PrivacyCard.tsx`: offline/local privacy messaging.
- `settingsSelectors.ts`: derives settings summary state.
- `settingsTypes.ts`: settings view types.

## Current Policy

- Settings are runtime-only in Zustand and are not persisted across app restarts.
- Wake-word toggle must remain disabled/unavailable until audio readiness reports support.
- Headset button and lock-screen recording controls remain hidden while the release capability is disabled.
- Model management uses the local catalog in `SynthesisEngine/models.ts`.
- Model management compares catalog RAM recommendations with device readiness, marks the best or closest fit, and warns that below-minimum inference may be slow or fail; the user can still install and try the model.
- A ready installed writing assistant is reported as healthy. Low-memory guidance avoids repeating model name and download size already shown on its card; storage preflight errors retain required/available space while technical download errors stay generic.
- Settings keeps manual model selection, download, and delete controls; downloads begin only after an explicit user action in the first-run notice, Home, or Settings.
- Library backups are plain JSON files the user saves through the OS document picker. Restore validates the archive and merges notes without replacing current content; audio files are not included.
- Android release settings expose on-demand recording only; headset button behavior is deferred until physical-device validation. Assistant setup guidance remains gated from the current release.

## Release Scope

Android shows opt-in on-demand voice recording. Microphone permission is requested when recording is used; Android 13+ also requests notification access once for the foreground-service Stop action. A user-started recording can continue in the background under a separate microphone foreground service. Denied notification permission does not block capture; in-app Stop remains available on every route and access can be changed later in Android Settings. Headset button triggers remain deferred. iOS remains text-only. Audio import, wake word, and assistant voice are gated by `RELEASE_CAPABILITIES`. Synthesis status explains whether it is disabled, waiting for device resources, or waiting for a model; installed model assets do not imply native runtime availability.
