# `e2e` Architecture

Cross-platform Detox end-to-end test configuration for the maintained iOS simulator and Android emulator debug workflows.

## Files

- `jest.config.js`: Jest config for Detox tests.
- `starter.test.js`: shared iOS/Android journeys for launch and first-run device readiness guidance, durable manual capture, pasted-text import, and raw Inbox fallback across relaunch; optional checksum-verified real-model filing.

## Current State

The same `starter.test.js` suite runs against both platforms. It uses `device.getPlatform()` and Detox's allocated `device.id` to read the active app container, so there is no fixed simulator UUID or assumption that every test target supports `xcrun`.

Persistence assertions inspect the topic markdown files inside the allocated test app:

- iOS reads the active simulator container selected by Detox.
- Android reads the debuggable app sandbox through `adb run-as` on the allocated emulator.

Each journey resets app data before launch. iOS remains text-only; Android exposes on-demand headset/record controls and keeps audio import, wake word, and assistant capture disabled. Set `CONTEXTENGINE_MODEL_PATH` to the downloaded recommended Gemma3 model to enable genuine native synthesis assertions; raw fallback does not satisfy that journey. The fallback journey disables LiteRT, persists a raw Inbox note, captures its durable note id, relaunches the process, and confirms that the same note remains persisted even if startup synthesis later moves it to a topic.

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

Create the AVD named `ContextEngine_Test_Device`, then start Metro and build the app plus its Detox instrumentation APK. Set `CONTEXTENGINE_ANDROID_AVD` to select another installed AVD for targeted Android API validation:

```sh
npm start
npm run test:e2e:build:android
npm run test:e2e:android -- --cleanup
```

For a USB- or Wi-Fi-connected phone, pair it with ADB first, then set `CONTEXTENGINE_ANDROID_SERIAL` to the exact serial shown by `adb devices -l`. This keeps Detox from choosing a different attached emulator or phone:

```sh
CONTEXTENGINE_ANDROID_SERIAL=<adb-serial> npx detox test --configuration android.att.debug e2e/starter.test.js --cleanup
```

The Android harness lives under `android/app/src/androidTest`; it is excluded from the shipped APK/AAB. Gradle resolves the version-matched Detox AAR from `node_modules/detox/Detox-android`, and Detox reverses port `8081` for the debug app.

## Maintenance Rules

- Keep shared journeys platform-neutral; platform commands belong only in the persistence adapter.
- Use `device.id`, never a checked-in simulator UDID or guessed ADB serial.
- Prefer UI-visible state plus persisted note ids over timing-only assertions.
- Keep selectors stable and scroll-aware so native failures remain intentional.
- The AppShell regression test covers keyboard show/hide event ordering; the iOS Detox draft journey also exercises Done dismissal before switching routes.

## Store Screenshot Capture

- `store-screenshots.test.js` is skipped during normal E2E and enabled only by `npm run store:screenshots:ios`, `npm run store:screenshots:ios:ipad`, or `npm run store:screenshots:android`. Android's four-image journey shows typed capture, text import review, local AI settings, and the Inbox fallback. `npm run store:screenshots:android:synthesized` runs the real Gemma E2E and exports the fifth synthesized-context image; it requires `CONTEXTENGINE_MODEL_PATH` to point to the verified model. Both journeys write current Play listing screenshots to `android/store-assets/screenshots/`.
- iOS uses iPhone 16 Pro Max so the raw PNGs have an accepted 6.9-inch App Store size.
- Android crops system chrome from the 1080x2340 test-device output to 1080x2076 while preserving the app header/tab bar, so the long edge does not exceed twice the short edge. The text-import store image contains a non-sensitive example note without opening the keyboard.
- All paths normalize the status bar, reset app data, use non-sensitive demonstration text, and write maximum-quality, alpha-free JPEGs with `iphone-`, `ipad-`, or `phone-` prefixes under the platform `store-assets/screenshots` directory.
- Capture requires Metro on port 8081 and prebuilt Detox debug apps.
