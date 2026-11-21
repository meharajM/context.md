# `src/modules/HeadsetTrigger` Architecture

This module contains the native bridge for opt-in Android headset and lock-screen capture. Direct iOS headset capture remains gated because iOS routes remote commands to its Now Playing app.

## Files

- `index.ts`: JS wrapper around the native `EventEmitter` bridge.

## Current Behavior

- `setLockScreenHeadsetCaptureEnabled(true)` requests the native platform contract needed for locked-device headset capture.
- Android starts or stops capture after the opted-in media-button gesture and microphone permission; lock-screen capture uses the visible foreground-service notification.
- iOS in-app and Lock Screen widget capture use app handoff. Never add fake playback to receive headset commands.
- The module is intentionally tiny; feature state still lives in the store.
