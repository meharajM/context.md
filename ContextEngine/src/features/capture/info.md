# `src/features/capture` Architecture

The capture feature owns the shared thought composer.

## Files

- `CaptureComposerContainer.tsx`: connects the composer to Zustand actions.
- `CaptureComposerView.tsx`: presentation for typed capture and record controls.
- `captureSelectors.ts`: derives composer affordances from runtime state.
- `captureTypes.ts`: view model and callback types.

## Behavior

- Manual typed capture trims text before enqueue; save control and keyboard Done submit through the same action.
- The in-app record button is gated by the store setting, not transcription readiness. If setup is pending or fails, recording remains available and its WAV stays recoverable in Inbox for later transcription.
- Empty capture should not enqueue.
- Recording state comes from the store, not local UI-only state.
- The record button now exposes explicit starting/recording/stopping/transcribing affordances through store-driven state.
- While recording is active, the composer shows a translucent glass status pill with live recording bars so the user can see capture state at a glance.
- If Android 13+ notification access is denied, the recording pill says Stop is available in the app; capture itself remains available.
- While recording, Stop stays beside Save if typed text is present.
- The idle composer is a low-elevation single-line field with a short writing prompt; the microphone remains a separate explicit action where voice capture is enabled.
- During Android's first-run voice-model download, the composer shows progress, approximate download size, and a mobile-data notice. Typed capture remains available while setup runs.
- During the first-run tutorial, voice-model progress appears once in the tutorial instead of repeating below the composer; typed and voice capture remain available.

## Release Scope

Android and iOS show composer recording controls when voice capture and Push to Record are enabled, even if transcription setup is pending. iOS Home and Lock Screen widget requests use an app handoff and reuse this composer in a quick-capture sheet. Android headset capture is opt-in; its lock-screen foreground service shows a persistent disable/Stop action. Typed entry/save remains available everywhere.

Typed draft state stays mounted in AppShell across navigation. A successful save clears only the submitted draft revision; edits made while persistence is pending survive even if the user returns to identical text. Failed saves retain the draft.
