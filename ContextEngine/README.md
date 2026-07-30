# Context Engine

Context Engine is a React Native app for iOS and Android that captures typed and spoken thoughts into local topic markdown files. It is designed to degrade safely: every non-empty thought is persisted even when LiteRT synthesis is unavailable.

## Verified MVP behavior

- Manual save writes non-empty thoughts into the processing queue.
- Queue retries are capped and repeated synthesis failures fall back to `Inbox`.
- Push-to-record is gated by local Whisper readiness.
- Wake word is foreground-only and currently disabled until a keyword-spotter model is bundled.
- LiteRT is the only synthesis runtime. There is no OpenAI, Ollama, or llama.rn fallback in the active path.
- Topic routing compares candidate topics with persisted context; ambiguous captures stay in the queue with a clarification question and selectable topic options until resolved.
- The app includes separate first-time, home, and settings screens.
- The app can download the recommended LiteRT-LM model onto the device from the settings flow.
- The app includes a dedicated import screen for local text and voice files with searchable topic targeting and explicit merge approval.

## Current architecture

- `App.tsx`: app shell and first-time, home, and settings screens.
- `src/core/store.ts`: capture state, queue state, runtime settings, app lifecycle coordination.
- `src/modules/ContextManager`: local markdown parsing and persistence.
- `src/modules/AudioEngine`: Whisper-backed recording and readiness checks.
- `src/modules/SynthesisEngine`: LiteRT-LM runtime wrapper, queue manager, and model download helpers.

## Native setup

1. Install dependencies:

```sh
npm install
cd ios
bundle exec pod install
cd ..
```

2. Make sure the iOS target has:

- `NSMicrophoneUsageDescription` in `Info.plist`
- a bundled `whisper-tiny.en.bin` for push-to-record

3. Run the app in the simulator:

```sh
npm run ios
```

For a physically connected iPhone, run:

```sh
npm run ios:device
```

Run Android on a connected device or emulator with `npm run android`.

## Release builds

Create the signed iOS archive with:

```sh
npm run ios:release
```

The archive is written to `build/ContextEngine.xcarchive`. The repository can produce a development-signed archive; App Store submission still requires the owner's Apple Distribution certificate, App Store provisioning, and App Store Connect access.

Android release signing is intentionally external. Supply the Play upload key through Gradle properties or environment variables, then build the AAB:

```sh
CONTEXTENGINE_UPLOAD_STORE_FILE=/absolute/path/upload.jks \
CONTEXTENGINE_UPLOAD_STORE_PASSWORD='...' \
CONTEXTENGINE_UPLOAD_KEY_ALIAS='...' \
CONTEXTENGINE_UPLOAD_KEY_PASSWORD='...' \
npm run android:release
```

The bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`. Never commit the upload keystore or its passwords.

For local setup, place key files in the git-ignored `.release-secrets/` directory and fill the git-ignored `.env.release.local` file. See `docs/release-credentials.md`; release commands load that file automatically.

That same `.env.release.local` file is also the place for publisher/contact/store metadata. After filling it, run `npm run release:apply-metadata` to stamp the draft privacy policy and store-submission package.

## LiteRT-LM model setup

- Recommended model: `Gemma3-1B-IT`
- Expected device path after download:
  `/Documents/models/gemma3-1b-it-int4.litertlm`
- The app settings screen can download and select the model.

Live LiteRT synthesis is now verified on the iPhone 16 simulator with the recommended model installed. Remaining release-hardening work is reflected in `implementation/index.md`.

## Known limits

- Release builds currently package only `arm64-v8a` on Android, matching modern Play-distributed physical devices.
- Wake word is not available in the background or on the lock screen.
- Headset media-button handling is foreground-scoped and best-effort. Stock Android does not globally select a non-playing app's MediaSession, and iOS requires legitimate Now Playing eligibility; reliable accessory routing and background/lock-screen capture remain planned rather than using silent playback or fake media state.
- Background listener code is intentionally feature-gated out of the MVP runtime path.
- Settings are runtime-only and are not persisted across app restarts.
- Store submission still requires owner-managed signing credentials, a published placeholder-free privacy policy, store-console declarations, asset approval/upload, and final physical-device QA on both platforms.

## Target roadmap (approved)

- `app-behaviour.md` defines approved target behavior roadmap and the remaining items that still need implementation or release hardening.
- Implemented flows include foreground headset-command handlers, Siri/Google intents-shortcuts, note edit/re-synthesize, and import with topic-aware merge controls. Reliable OS delivery to the headset handlers remains planned under a legitimate audio/Now Playing contract and still needs physical-earphone QA.
- Any still-planned behavior is explicitly marked `Planned` in `app-behaviour.md`.

## Validation

Primary validation commands:

```sh
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

Cross-platform Detox debug journeys require Metro in a separate terminal. Build and run the maintained targets with:

```sh
npm run test:e2e:build:ios
npm run test:e2e:ios -- --cleanup

npm run test:e2e:build:android
npm run test:e2e:android -- --cleanup
```

The Android command targets the `ContextEngine_Test_Device` AVD. See `e2e/info.md` for the harness and persistence-assertion contract.

As of 2026-07-18, typecheck, lint, 25 Jest suites / 145 tests, and all four shared E2E journeys are green on both iPhone 16 and the Android 11 emulator. iOS Debug and Android Debug/AndroidTest native builds pass. The final R8-minified Android APK/AAB builds with Kotlin 2.3.0 and all 15 packaged arm64 libraries pass the 16 KB compatibility check. Four alpha-free screenshots each are generated for iPhone, iPad, and Play phone. Final publication remains gated by a legitimate headset-session design, physical-device QA, Xcode 26+, at least 20 GB free disk, published privacy/store declarations, asset approval, and owner-signed artifacts. Run `npm run release:preflight` for the current 12/17 checklist.

## Tracker workflow

When making changes, use the implementation tracker in this order:

1. Read `implementation/status.json`.
2. Read the matching phase object in `implementation/phases.json`.
3. Read `implementation/README.md` for operating instructions.
4. Read `implementation/index.md` for the human summary.
5. Update the tracker files whenever the implementation state changes.
