# Android Host Code Architecture

This package contains the React Native Android host classes.

## Files

- `MainActivity.kt`: Android activity entrypoint for the React Native app.
- `MainApplication.kt`: React Native application setup and package registration.
- `EventEmitter.kt`: React Native event/guidance bridge and lifecycle owner for the headset MediaSession.
- `HeadsetMediaButtonController.kt`: foreground-scoped platform MediaSession that maps skip-back or three raw headset taps to `HeadsetTripleTapRequested` with debounce protection.
- `HeadsetTriplePressGate.kt`: pure timing gate for the 1.2-second raw-tap window and 1.5-second duplicate-command debounce.
- `VoiceFilePickerModule.kt`: native document picker bridge for local voice-file imports.
- `ContextEnginePackage.kt`: package registration for the app's native modules.

## Role

These files host the JavaScript bundle. Business logic, queueing, context persistence, and synthesis selection live in TypeScript under `src`.

The LiteRT bridge preserves optional clarification question and topic-option fields from model JSON; the TypeScript queue owns the hold/resume decision and persistence ordering.

The headset MediaSession is active, flagged for media-button/transport handling, and honestly paused only while the React host is resumed. It can normalize commands dispatched directly to it, but stock Android's global media-key stack selects a session from UIDs with actual audio playback (`AudioPlayerStateMonitor`), so a non-playing Context Engine session is not globally eligible. Emulator probes confirmed that flags and even a temporary no-audio `STATE_PLAYING` declaration leave the global media-button session null. There is intentionally no silent playback, background media-button receiver, or microphone foreground service.
