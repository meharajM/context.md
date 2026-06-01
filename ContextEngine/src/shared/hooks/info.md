# `src/shared/hooks` Architecture

Shared hooks for cross-cutting app behavior.

## Files

- `useAppLifecycleSync.ts`: bridges React Native `AppState` changes into the Zustand store.
- `useAssistantIntentCapture.ts`: listens for iOS assistant shortcut payloads and forwards normalized text into the store, defensively loading the native event emitter module so simulator and Jest export shapes both work.
- `useHeadsetTripleTapCapture.ts`: listens for the iOS headset triple-tap native event and routes start/stop through the existing store capture actions; on readiness failure, posts status guidance and triggers native spoken guidance.

## Current Behavior

The lifecycle hook lets the store stop wake-word detection when backgrounded and restart foreground wake-word only when settings and readiness allow it.
