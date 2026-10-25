# `src/modules/HeadsetTrigger` Architecture

This module contains the native bridge for headset-triggered capture, which remains gated off in the v1 release.

## Files

- `index.ts`: JS wrapper around the native `EventEmitter` bridge.

## Current Behavior

- `setLockScreenHeadsetCaptureEnabled(true)` requests the native platform contract needed for locked-device headset capture.
- Android must not start a microphone foreground service while headset-triggered capture is gated off.
- iOS remains text-only in v1; the retained iOS remote-command implementation is gated off.
- The module is intentionally tiny; feature state still lives in the store.
