# `src/shared/hooks` Architecture

Shared hooks for cross-cutting app behavior.

## Files

- `useAppLifecycleSync.ts`: bridges React Native `AppState` changes into the Zustand store.

## Current Behavior

The lifecycle hook lets the store stop wake-word detection when backgrounded and restart foreground wake-word only when settings and readiness allow it.
