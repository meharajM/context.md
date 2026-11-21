# `src/features/settings` Architecture

Settings exposes runtime controls and local model management.

The screen uses a compact heading and tighter spacing between groups while preserving the model, capture, diagnostics, backup, and privacy controls. The generic intro is omitted; backup instructions are concise, and the privacy assurance is a quiet inline note rather than another card.

## Files

- `SettingsScreen.tsx`: settings composition, including user-initiated JSON library backup actions.
- `SettingsScreen.tsx` also persists Meeting audio retention (`5m` default, `1h`, `1d`, or `keep`). Meeting sessions and audio are separately stored and excluded from library JSON backups.
- `AutomaticRemindersSection.tsx`: automatic reminder toggle, hidden without native support; loads and changes persisted state through the platform reminder service, with disabled controls during requests and one inline status/error. Off by default; only new notes qualify after enabling. Disabling cancels pending reminders.
- `CaptureModesSection.tsx`: manual recording, gated voice capture, and LiteRT toggles.
- Eligible Android and iOS devices automatically download Gemma 3n E2B for a unified voice and writing model when RAM and free storage meet its requirements. Lower-resource devices use Gemma3-1B with Whisper. Other writing models remain optional in model management.
- Settings shows progress and offers retry for the selected audio-capable Gemma or Whisper transcription setup after a download failure.
- Android development builds expose a bundled-sample Whisper probe in Capture Modes; it is excluded from production builds and reports its result inline for speech-path QA.
- `AssistantShortcutsSection.tsx`: platform-specific Siri/Shortcuts or Google Assistant setup/binding guidance for assistant capture.
- `ShortcutsSetupButton.tsx`: one-tap native entry point into the app's Shortcuts setup surface, with a JS fallback when native UI is unavailable.
- `ModelManagementSection.tsx`: model selection/download/delete actions.
- `FunctionGemmaSection.tsx`: optional FunctionGemma helper download/removal. It is excluded from writing-model recommendations and selection.
- `DiagnosticsSection.tsx`: readiness, path, and diagnostic status display.
- `PrivacyCard.tsx`: offline/local privacy messaging.
- `settingsSelectors.ts`: derives settings summary state.
- `settingsTypes.ts`: settings view types.

## Current Policy

- Capture settings are runtime-only in Zustand and are not persisted across app restarts. Automatic reminders are persisted separately by the Android scheduler or iOS notification module.
- Wake-word toggle must remain disabled/unavailable until audio readiness reports support.
- Android exposes headset media-button capture and optional lock-screen arming; the foreground service keeps a visible notification with a disable action. iOS headset commands stay gated because iOS routes them to the active Now Playing app.
- Model management uses the local catalog in `SynthesisEngine/models.ts`.
- Model management compares catalog RAM recommendations with device readiness, marks the best or closest fit, and warns that below-minimum inference may be slow or fail; the user can still install and try the model.
- A ready installed writing assistant is reported as healthy. Low-memory guidance avoids repeating model name and download size already shown on its card; storage preflight errors retain required/available space while technical download errors stay generic.
- Settings keeps local writing-model selection, download, and delete controls. The app preserves whether a model choice was manual or automatic so device-based iOS selection does not overwrite a user-selected model.
- The research helper is an auxiliary local tool planner. Its download does not alter the selected writing model or synthesis queue.
- Library backups are plain JSON files the user saves through the OS document picker. Restore validates the archive and merges notes without replacing current content; audio files are not included.
- Android settings expose on-demand recording plus optional headset and lock-screen capture. iOS uses an explicit Lock Screen widget handoff for recording and does not claim direct headset-button support. Assistant setup guidance remains gated.

## Release Scope

Both platforms show opt-in on-demand voice recording and automatic reminders. Microphone permission is requested when recording is used. Android 13+ also requests notification access once for the foreground-service Stop action; if denied, in-app Stop remains available on every route. Android offers opt-in headset media buttons and lock-screen arming. iOS can continue user-started recording while backgrounded; Home and Lock Screen Record widgets hand off to the app, where recording is stopped. Direct iOS headset commands remain gated. Audio import, wake word, and assistant voice remain gated by `RELEASE_CAPABILITIES`. Synthesis status explains whether it is disabled, waiting for device resources, or waiting for a model; installed model assets do not imply native runtime availability.
