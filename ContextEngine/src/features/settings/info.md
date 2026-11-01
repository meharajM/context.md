# `src/features/settings` Architecture

Settings exposes runtime controls and local model management.

The screen uses a compact heading and tighter spacing between groups while preserving the model, capture, diagnostics, backup, and privacy controls. The generic intro is omitted; backup instructions are concise, and the privacy assurance is a quiet inline note rather than another card.

## Files

- `SettingsScreen.tsx`: settings composition, including user-initiated JSON library backup actions.
- `AutomaticRemindersSection.tsx`: automatic reminder toggle, hidden without native support; loads and changes persisted state through the platform reminder service, with disabled controls during requests and one inline status/error. Off by default; only new notes qualify after enabling. Disabling cancels pending reminders.
- `CaptureModesSection.tsx`: manual recording, gated voice capture, and LiteRT toggles.
- Android Whisper setup downloads automatically on first launch; Settings shows progress and offers retry after failure.
- Android development builds expose a bundled-sample Whisper probe in Capture Modes; it is excluded from production builds and reports its result inline for speech-path QA.
- `AssistantShortcutsSection.tsx`: platform-specific Siri/Shortcuts or Google Assistant setup/binding guidance for assistant capture.
- `ShortcutsSetupButton.tsx`: one-tap native entry point into the app's Shortcuts setup surface, with a JS fallback when native UI is unavailable.
- `ModelManagementSection.tsx`: model selection/download/delete actions.
- `DiagnosticsSection.tsx`: readiness, path, and diagnostic status display.
- `PrivacyCard.tsx`: offline/local privacy messaging.
- `settingsSelectors.ts`: derives settings summary state.
- `settingsTypes.ts`: settings view types.

## Current Policy

- Capture settings are runtime-only in Zustand and are not persisted across app restarts. Automatic reminders are persisted separately by the Android scheduler or iOS notification module.
- Wake-word toggle must remain disabled/unavailable until audio readiness reports support.
- Headset button and lock-screen recording controls remain hidden while the release capability is disabled.
- Model management uses the local catalog in `SynthesisEngine/models.ts`.
- Model management compares catalog RAM recommendations with device readiness, marks the best or closest fit, and warns that below-minimum inference may be slow or fail; the user can still install and try the model.
- A ready installed writing assistant is reported as healthy. Low-memory guidance avoids repeating model name and download size already shown on its card; storage preflight errors retain required/available space while technical download errors stay generic.
- Settings keeps local writing-model selection, download, and delete controls. Whisper transcription-model setup runs separately and starts automatically on first Android launch when the file is missing.
- Library backups are plain JSON files the user saves through the OS document picker. Restore validates the archive and merges notes without replacing current content; audio files are not included.
- Android release settings expose on-demand recording only; headset button behavior is deferred until physical-device validation. Assistant setup guidance remains gated from the current release.

## Release Scope

Both platforms show opt-in on-demand voice recording and automatic reminders. Microphone permission is requested when recording is used. Android 13+ also requests notification access once for the foreground-service Stop action; if denied, in-app Stop remains available on every route. iOS can continue a user-started recording while backgrounded and is stopped after returning to the app. Its iOS 17+ home-screen widget opens the app for Write or Record; iOS has no ongoing Stop notification. Headset button triggers remain deferred. Audio import, wake word, and assistant voice are gated by `RELEASE_CAPABILITIES`. Synthesis status explains whether it is disabled, waiting for device resources, or waiting for a model; installed model assets do not imply native runtime availability.
