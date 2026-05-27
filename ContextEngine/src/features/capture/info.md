# `src/features/capture` Architecture

The capture feature owns the shared thought composer.

## Files

- `CaptureComposerContainer.tsx`: connects the composer to Zustand actions.
- `CaptureComposerView.tsx`: presentation for typed capture and record controls.
- `captureSelectors.ts`: derives composer affordances from runtime state.
- `captureTypes.ts`: view model and callback types.

## Behavior

- Manual typed capture trims text before enqueue.
- Push-to-record is gated by the store's audio readiness and setting.
- Empty capture should not enqueue.
- Recording state comes from the store, not local UI-only state.
- The record button now exposes explicit starting/recording/stopping/transcribing affordances through store-driven state.
- While recording is active, the composer shows a translucent glass status pill with live recording bars so the user can see capture state at a glance.
