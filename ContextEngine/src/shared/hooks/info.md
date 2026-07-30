# `src/shared/hooks` Architecture

Shared hooks for cross-cutting app behavior.

## Files

- `useAppLifecycleSync.ts`: bridges React Native `AppState` changes into the Zustand store.
- `useAssistantIntentCapture.ts`: listens for iOS or Android assistant shortcut payloads and forwards normalized text into the store, defensively loading the native event emitter module so simulator and Jest export shapes both work.
- `useHeadsetTripleTapCapture.ts`: listens for the iOS or Android native headset-trigger event and routes start/stop through existing store capture actions; transitional states are ignored, while readiness failures post status guidance and trigger native spoken guidance.

## Current Behavior

The lifecycle hook lets the store stop wake-word detection when backgrounded and restart foreground wake-word only when settings and readiness allow it.
