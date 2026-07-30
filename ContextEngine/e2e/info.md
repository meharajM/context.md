# `e2e` Architecture

Cross-platform Detox end-to-end test configuration for the maintained iOS simulator and Android emulator debug workflows.

## Files

- `jest.config.js`: Jest config for Detox tests.
- `starter.test.js`: shared iOS/Android journeys for launch, durable manual capture, text/voice import, and raw Inbox fallback across relaunch.

## Current State

The same `starter.test.js` suite runs against both platforms. It uses `device.getPlatform()` and Detox's allocated `device.id` to read the active app container, so there is no fixed simulator UUID or assumption that every test target supports `xcrun`.

Persistence assertions inspect the topic markdown files inside the allocated test app:

- iOS reads the active simulator container selected by Detox.
- Android reads the debuggable app sandbox through `adb run-as` on the allocated emulator.

Each journey resets app data before launch. The fallback journey disables LiteRT, persists a raw Inbox note, captures its durable note id, relaunches the process, and confirms that the same note remains persisted even if startup synthesis later moves it to a topic.

## Run iOS

Start Metro in one terminal:

```sh
npm start
```

Build and test the iPhone 16 simulator in another terminal:

```sh
npm run test:e2e:build:ios
npm run test:e2e:ios -- --cleanup
```

`npm run test:e2e` remains an alias for the maintained iOS simulator run.

## Run Android

Create the AVD named `ContextEngine_Test_Device`, then start Metro and build the app plus its Detox instrumentation APK:

```sh
npm start
npm run test:e2e:build:android
npm run test:e2e:android -- --cleanup
```

The Android harness lives under `android/app/src/androidTest`; it is excluded from the shipped APK/AAB. Gradle resolves the version-matched Detox AAR from `node_modules/detox/Detox-android`, and Detox reverses port `8081` for the debug app.

## Maintenance Rules

- Keep shared journeys platform-neutral; platform commands belong only in the persistence adapter.
- Use `device.id`, never a checked-in simulator UDID or guessed ADB serial.
- Prefer UI-visible state plus persisted note ids over timing-only assertions.
- Keep selectors stable and scroll-aware so native failures remain intentional.

## Store Screenshot Capture

- `store-screenshots.test.js` is skipped during normal E2E and enabled only by `npm run store:screenshots:ios`, `npm run store:screenshots:ios:ipad`, or `npm run store:screenshots:android`.
- iOS uses iPhone 16 Pro Max so the raw PNGs have an accepted 6.9-inch App Store size.
- Android crops system chrome from the 1080x2340 test-device output to 1080x2160 while preserving the app header/tab bar, so the long edge does not exceed twice the short edge.
- All paths normalize the status bar, reset app data, use non-sensitive demonstration text, and write maximum-quality, alpha-free JPEGs with `iphone-`, `ipad-`, or `phone-` prefixes under the platform `store-assets/screenshots` directory.
- Capture requires Metro on port 8081 and prebuilt Detox debug apps.
