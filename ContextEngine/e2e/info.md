# `e2e` Architecture

Cross-platform Detox end-to-end test configuration for the maintained iOS simulator and Android emulator debug workflows.

## Files

- `jest.config.js`: Jest config for Detox tests.
- `starter.test.js`: shared iOS/Android journeys for launch and first-run device readiness guidance, durable manual capture, pasted-text import, and raw Inbox fallback across relaunch. iOS also verifies all onboarding descriptions and in-app voice recording/retained WAV integrity; Android verifies first-launch Whisper download, speech-sample transcription, and interrupted recording recovery.
- `android-ux-review.test.js`: Android-only screenshot journey through the illustrated first-run carousel, Home, Waiting, import review/topic selection, Settings, topic/Inbox details, note editing, and dark/light appearance.

## Current State

The same `starter.test.js` suite runs against both platforms. It uses `device.getPlatform()` and Detox's allocated `device.id` to read the active app container, so there is no fixed simulator UUID or assumption that every test target supports `xcrun`.

Latest QA (2026-11-02): On a fresh API 36 AVD, the fixture-free Detox starter suite passed 8/8 journeys and the Android UX review passed 1/1. Targeted typed import passed 1/1 after switching multiline test input to `replaceText`; targeted real-Gemma filing passed 1/1 on a 6 GB API 36 AVD with the verified 557 MiB model. A model-enabled full run on that AVD still timed out waiting for Whisper readiness and the recording-ready state; the automatic-reminder UI journey timed out waiting for Fabric to become idle at its Settings toggle. These remain test/device validation gaps. The iOS-only journeys were skipped in Android runs.

Latest QA (2026-11-01): Android API 36 Detox build succeeded. The starter journeys passed Home launch, Whisper download and speech-sample transcription, manual save, typed import, shared-text review/save, Inbox persistence across process relaunch, and interrupted recording recovery after process death. The draft route-switch journey first failed because its helper used a separate `uiautomator` dump to locate a button Detox already found; it now uses Detox tap and passed on targeted rerun. The Android visual review passed 1/1 and captured the onboarding, capture, import, settings, notes, and theme surfaces under `artifacts/android-ux-review/before/`. Real-model synthesis and the reminder E2E setup were not verified because the required verified 557 MiB Gemma fixture is absent; the reminder suite stops before launch. The worker instrumentation test is guarded and skipped for the same missing fixture.

The iOS simulator app build succeeded, but iOS Detox could not allocate an iPhone: the configured CoreSimulator device cache is not writable by CoreSimulatorService, and Detox cannot discover a simulator created in a temporary custom device set. iOS simulator journeys and current physical-device checks remain unverified.

Model-backed Detox runs need `CONTEXTENGINE_MODEL_PATH` to point to the verified 584,417,280-byte Gemma file, with its `manifest.json` alongside it. Persistence assertions inspect the topic markdown files inside the allocated test app:

- iOS reads the active simulator container selected by Detox.
- Android reads the debuggable app sandbox through `adb run-as` on the allocated emulator.

Each journey resets its selected test app before launch. Android always uses disposable `com.meharaj.contextengine.e2e`; `appTarget.js` rejects a production or other Android app id before resets or fixture writes, including when `CONTEXTENGINE_PRESERVE_APP_DATA=1` is requested. All Android fixture reads/writes, grants, stops, and reset commands share that selected target. iOS uses the allocated simulator container. Both platforms expose on-demand in-app voice capture and local reminders; Android adds a foreground-service Stop action and headset microphone routing, while iOS continues user-started recording in the background and stops it after returning to the app. The iOS 17+ Write/Record widget opens the app. Voice-file import, wake word, and assistant capture remain gated on both platforms. The first-run helpers dismiss the tour without waiting for Whisper; Android has a separate speech test for Whisper download/transcription. Set `CONTEXTENGINE_MODEL_PATH` to the downloaded recommended Gemma3 model to enable genuine native synthesis assertions; raw fallback does not satisfy that journey. The fallback journey disables LiteRT, persists a raw Inbox note, captures its durable note id, relaunches the process, and confirms that the same note remains persisted even if startup synthesis later moves it to a topic.

## Run iOS

Start Metro in one terminal:

```sh
npm start
```

Build and test the iPhone 16 Pro simulator in another terminal:

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

All maintained Android configurations build and select the isolated `.e2e` package automatically. To preserve an existing phone install and its data, use:

```sh
npx detox build --configuration android.att.debug
CONTEXTENGINE_ANDROID_SERIAL=<adb-serial> CONTEXTENGINE_PRESERVE_APP_DATA=1 npx detox test --configuration android.att.debug e2e/starter.test.js --cleanup
```

The Android harness lives under `android/app/src/androidTest`; it is excluded from the shipped APK/AAB. Gradle resolves the version-matched Detox AAR from `node_modules/detox/Detox-android`, and Detox reverses port `8081` for the debug app.

## Maintenance Rules

- Keep shared journeys platform-neutral; platform commands belong only in the persistence adapter.
- Use `device.id`, never a checked-in simulator UDID or guessed ADB serial.
- Prefer UI-visible state plus persisted note ids over timing-only assertions.
- Keep selectors stable and scroll-aware so native failures remain intentional.
- The Android visual review captures the three onboarding pages before dismissing the tour and has a 300-second timeout for emulator screenshot runs. Font-scale runs should use an emulator that remains responsive while Android System UI is reconfigured.
- The AppShell regression test covers keyboard show/hide event ordering; the iOS Detox draft journey also exercises Done dismissal before switching routes.

## Store Screenshot Capture

- `store-screenshots.test.js` is skipped during normal E2E and enabled by the screenshot commands. The Android listing flow resets only the isolated `.e2e` package, removes legacy and topic-file fixtures, then exports a ready topic home with synthetic notes and the verified local model installed. The real Gemma E2E seeds a related community-garden topic and verifies actual on-device inference files the new thought into it before capturing topic details. Both require `CONTEXTENGINE_MODEL_PATH` to point to the verified model and write to `android/store-assets/screenshots/`. iOS screenshot capture keeps its own platform-specific flow.
- iOS uses iPhone 16 Pro Max so the raw PNGs have an accepted 6.9-inch App Store size.
- Android crops system chrome from the 1080x2340 test-device output to 1080x2076 while preserving the app header/tab bar, so the long edge does not exceed twice the short edge. The text-import store image contains a non-sensitive example note without opening the keyboard.
- All paths normalize the status bar, reset app data, use non-sensitive demonstration text, and write maximum-quality, alpha-free JPEGs with `iphone-`, `ipad-`, or `phone-` prefixes under the platform `store-assets/screenshots` directory.
- Capture requires Metro on port 8081 and prebuilt Detox debug apps.


`appTarget.js` centralizes Android package selection and the fixed MainActivity namespace. The isolated build outputs live under `android/app/build/isolated-e2e/` for both debug and release, separate from production artifacts. `starter.test.js`, `android-ux-review.test.js`, and `store-screenshots.test.js` apply the same reset guard. Never run destructive QA against the production package; `CONTEXTENGINE_E2E_APP_ID=com.meharaj.contextengine` deliberately fails configuration instead of clearing user notes.
