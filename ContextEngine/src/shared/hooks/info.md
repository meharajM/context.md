# `src/shared/hooks` Architecture

Shared hooks for cross-cutting app behavior.

## Files

- `useAppLifecycleSync.ts`: bridges React Native `AppState` changes into the Zustand store and refreshes device resource readiness on app launch and when it returns to the foreground.
- `useAssistantIntentCapture.ts`: listens for iOS or Android assistant shortcut payloads and forwards normalized text into the store, defensively loading the native event emitter module so simulator and Jest export shapes both work.
- `useHeadsetTripleTapCapture.ts`: listens for the iOS or Android native headset-trigger event and routes start/stop through existing store capture actions; transitional states are ignored, readiness failures post status guidance and trigger native spoken guidance, and successful transitions now speak start/stop feedback too.
- `useQuickCaptureRequest.ts`: handles Android widget launch and Stop events plus iOS App Group widget requests. Android Stop waits through the store's `starting` phase and calls `stopCapture()` so WAV finalization and Inbox retention remain in the existing capture flow; iOS Write/Record requests open the app and route to the shared capture UI.

## Current Behavior

The lifecycle hook lets the store stop wake-word detection when backgrounded and restart foreground wake-word only when settings and readiness allow it. It refreshes memory/thermal readiness on app launch and return to foreground, allowing a resource-blocked queue to resume after reopening the app. On Android background transitions, it also rehydrates durable Inbox work before requesting the existing WorkManager retry. Android may defer or stop that work; the status shown in the app reports acceptance without an ETA. User-started recording has its own microphone foreground service and notification Stop path; the service never starts recording itself. Android headset button triggers remain disabled in v1.

## Release Scope

Android receives app/widget capture requests and the active-recording notification Stop action. iOS reads the one-shot App Group request when launched or resumed. Both route capture through the existing JS store; iOS widget actions open the app. Headset-trigger capture remains gated, assistant-intent intake remains gated, and wake-word lifecycle actions remain disabled.
