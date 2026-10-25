# `android/app/src/main` Architecture

Android runtime source root.

## Contents

- `AndroidManifest.xml`: app permissions, optional microphone hardware declaration, Bluetooth headset routing access, backup boundary, activity, microphone foreground service for active user-started recording, and Write/Record home-screen widget registration. Legacy external-storage permissions from dependencies are removed during manifest merge.
- `LiteRtModule.getDeviceReadiness()` reports total/available RAM, Android low-memory and thermal state, API/OS version, and emulator detection for first-run guidance and synthesis queue gating.
- `java`: Kotlin `MainActivity`, `MainApplication`, the WorkManager synthesis worker/session, and native modules.
- `assets`: bundled model/native assets.
- `res`: Android resources.

## Agent Notes

Keep Android changes minimal unless the task explicitly targets Android. The Android source includes the LiteRT host and constrained WorkManager synthesis runner; real-model behavior still requires adequate device memory and model installation.

## Android v1 scope

Android v1 requests microphone access for recording initiated in the app or home-screen widget. `ActiveRecordingService` enters foreground before the PCM stream starts and presents a Stop action that routes through JS WAV finalization; it does not open or start microphone capture itself. Notification permission remains optional, so capture is not blocked when notification-drawer visibility is denied. Headset button triggers and lock-screen-triggered recording remain disabled. Recording uses a compatible wired/Bluetooth headset microphone when available, otherwise it falls back to the phone microphone. Audio import, wake word, and assistant voice remain gated. WorkManager runs the registered Headless JS task directly through ReactHost and does not register a HeadlessJsTaskService.

Write widgets can save text through a private notification inline reply; `POST_NOTIFICATIONS` is declared for this optional flow. Denied or blocked notifications preserve composer launch. The private receiver and AtomicFile outbox retain accepted replies until JS durably imports them into Inbox. This text workflow does not use microphone access or a foreground service.
