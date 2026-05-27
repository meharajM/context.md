# Context Engine

Context Engine is an iOS-first React Native MVP for capturing typed and spoken thoughts into a local `context.md` file. It is designed to degrade safely: every non-empty thought is persisted even when LiteRT synthesis is unavailable.

## Verified MVP behavior

- Manual save writes non-empty thoughts into the processing queue.
- Queue retries are capped and repeated synthesis failures fall back to `Inbox`.
- Push-to-record is gated by local Whisper readiness.
- Wake word is foreground-only and currently disabled until a keyword-spotter model is bundled.
- LiteRT is the only synthesis runtime. There is no OpenAI, Ollama, or llama.rn fallback in the active path.
- The app includes separate first-time, home, and settings screens.
- The app can download the recommended LiteRT-LM model onto the device from the settings flow.

## Current architecture

- `App.tsx`: app shell and first-time, home, and settings screens.
- `src/core/store.ts`: capture state, queue state, runtime settings, app lifecycle coordination.
- `src/modules/ContextManager`: local markdown parsing and persistence.
- `src/modules/AudioEngine`: Whisper-backed recording and readiness checks.
- `src/modules/SynthesisEngine`: LiteRT-LM runtime wrapper, queue manager, and model download helpers.

## iOS setup

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

3. Run the app:

```sh
npm run ios
```

## LiteRT-LM model setup

- Recommended model: `Gemma3-1B-IT`
- Expected device path after download:
  `/Documents/models/gemma3-1b-it-int4.litertlm`
- The app settings screen can download and select the model.

Live LiteRT synthesis is now verified on the iPhone 16 simulator with the recommended model installed. Release validation is complete and reflected in `implementation/index.md`.

## Known limits

- iOS is the active priority. Android LiteRT/NPU work is deferred.
- Wake word is not available in the background or on the lock screen.
- Background listener code is intentionally feature-gated out of the MVP runtime path.
- Settings are runtime-only and are not persisted across app restarts.

## Validation

Primary validation commands:

```sh
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

Simulator QA uses `xcrun simctl` against the running iPhone 16 iOS 18.6 simulator. Release validation is complete and reflected in `implementation/index.md`.

## Tracker workflow

When making changes, use the implementation tracker in this order:

1. Read `implementation/status.json`.
2. Read the matching phase object in `implementation/phases.json`.
3. Read `implementation/README.md` for operating instructions.
4. Read `implementation/index.md` for the human summary.
5. Update the tracker files whenever the implementation state changes.
