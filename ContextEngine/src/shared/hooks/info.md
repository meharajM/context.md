# `src/shared/hooks` Architecture

Shared hooks for cross-cutting app behavior.

## Files

- `useAppLifecycleSync.ts`: bridges React Native `AppState` changes into the Zustand store, schedules active Android model downloads when the app backgrounds, and refreshes device resource and Android Whisper readiness when it returns to the foreground.
- `useBackgroundSynthesisTask.ts`: receives iOS BGProcessingTask launches and drains the durable synthesis queue through the shared task runner.
- `useAssistantIntentCapture.ts`: listens for iOS or Android assistant shortcut payloads and forwards normalized text into the store, defensively loading the native event emitter module so simulator and Jest export shapes both work.
- `useHeadsetTripleTapCapture.ts`: listens for the iOS or Android native headset-trigger event and routes start/stop through existing store capture actions; transitional states are ignored, readiness failures post status guidance and trigger native spoken guidance, and successful transitions now speak start/stop feedback too.
- `useQuickCaptureRequest.ts`: handles Android widget launch and Stop events plus iOS WidgetKit URL routes; iOS URL listeners do not depend on the optional native event bridge, and the App Group request reader remains a legacy fallback when that bridge is available. Android Stop waits through the store's `starting` phase and calls `stopCapture()` so WAV finalization and Inbox retention remain in the existing capture flow; iOS Write/Record requests route to the AppShell quick-capture sheet, and Meeting requests open the shared Meeting screen.

## Current Behavior

The lifecycle hook lets the store stop wake-word detection when backgrounded and restart foreground wake-word only when settings and readiness allow it. It refreshes memory/thermal readiness on app launch and return to foreground, allowing a resource-blocked queue to resume after reopening the app. On Android background transitions, it schedules an active Whisper or writing-model download through WorkManager; Android and iOS rehydrate durable Inbox work before requesting background synthesis. iOS background model downloads use RNFS URLSession handling through AppDelegate. Both platforms may defer or stop synthesis, so status reports accepted work without an ETA. User-started recording has its own microphone foreground service and notification Stop path on Android; the service never starts recording itself. Android headset button triggers remain disabled in v1.

## Release Scope

Android receives app/widget capture requests and the active-recording notification Stop action. iOS reads widget deep links through React Native Linking and retains the one-shot App Group reader for old pending requests. Both route capture through the existing JS store; iOS WidgetKit opens the app into a quick-note sheet or active recording controls. Headset-trigger capture remains gated, assistant-intent intake remains gated, and wake-word lifecycle actions remain disabled.
