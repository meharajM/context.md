# `src/features/settings` Architecture

Settings exposes runtime controls and local model management.

## Files

- `SettingsScreen.tsx`: settings composition.
- `CaptureModesSection.tsx`: manual, push-to-record, wake-word, and LiteRT toggles.
- `ModelManagementSection.tsx`: model selection/download/delete actions.
- `DiagnosticsSection.tsx`: readiness, path, and diagnostic status display.
- `PrivacyCard.tsx`: offline/local privacy messaging.
- `settingsSelectors.ts`: derives settings summary state.
- `settingsTypes.ts`: settings view types.

## Current Policy

- Settings are runtime-only in Zustand and are not persisted across app restarts.
- Wake-word toggle must remain disabled/unavailable until audio readiness reports support.
- Model management uses the local catalog in `SynthesisEngine/models.ts`.
