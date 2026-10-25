# `src/features/capture` Architecture

The capture feature owns the shared thought composer.

## Files

- `CaptureComposerContainer.tsx`: connects the composer to Zustand actions.
- `CaptureComposerView.tsx`: presentation for typed capture and record controls.
- `captureSelectors.ts`: derives composer affordances from runtime state.
- `captureTypes.ts`: view model and callback types.

## Behavior

- Manual typed capture trims text before enqueue; save control and keyboard Done submit through the same action.
- Push-to-record is gated by the store's audio readiness and setting.
- Empty capture should not enqueue.
- Recording state comes from the store, not local UI-only state.
- The record button now exposes explicit starting/recording/stopping/transcribing affordances through store-driven state.
- While recording is active, the composer shows a translucent glass status pill with live recording bars so the user can see capture state at a glance.
- If Android 13+ notification access is denied, the recording pill says Stop is available in the app; capture itself remains available.
- While recording, Stop stays beside Save if typed text is present.

## Release Scope

Android shows recording controls only when its voice capability, Push to Record setting, and audio readiness permit it. iOS remains text-only. Typed entry/save remains available everywhere; tests opt into capabilities only when exercising deferred or platform-specific behavior.

Typed draft state stays mounted in AppShell across navigation. A successful save clears only the submitted draft revision; edits made while persistence is pending survive even if the user returns to identical text. Failed saves retain the draft.
