# Thought Notes

Text-first, local-first notes for iOS and Android. Capture a typed thought, organize it with optional on-device AI, and keep context in local per-topic Markdown files.

## Current publication scope

- Typed notes persist in Inbox before asynchronous processing.
- LiteRT-LM refines notes and files them into an appropriate topic using existing context.
- Ambiguous routing asks for a topic choice; missing or failing AI keeps the original text in Inbox.
- Pasted-text import supports explicit topic selection and approval before suggested topic merges.
- Browse threads, edit notes, retry Inbox synthesis, and share context through the native share sheet.
- Search saved note text, source transcripts, and topic names on device.
- Export the library as a plain JSON backup or restore it additively; existing notes are kept and audio recordings are not included.
- Models run locally; download starts only after a user chooses it from the first-run notice, Home, or Settings. No cloud AI runtime or account is required.

Android v1 also supports optional, on-demand voice capture from the in-app Record control or the home-screen Write/Record widget. A connected wired/Bluetooth microphone may be used during an active recording, which can continue when the app backgrounds under a microphone foreground service. Android 13+ asks for notification access so the service can show a Stop action; if declined, recording remains available and the app tells the user to reopen it to stop. Headset media-button and lock-screen-triggered capture remain disabled. Audio transcription runs locally. Audio-file import, wake words, assistant voice intents, and spoken summaries remain future deliverables. iOS v1 remains text-only.

## Setup

Node.js 22.11+ and platform development tools are required.

```sh
npm install
cd ios
bundle exec pod install
cd ..
npm start
```

Run `npm run ios:device` for a connected, unlocked iPhone with Developer Mode enabled, or `npm run android` for Android. `npm run ios` targets the iPhone 16 simulator for UI/fallback checks; native iOS LiteRT inference is disabled in Simulator and must be tested on hardware.

## Local AI

Recommended model: Gemma3-1B-IT, approximately 585 MB, CPU backend, 4 GB device-memory target. Installation is optional from the first-run notice, Home, or Settings. Model assets are not committed. Captures remain usable in Inbox without the model.

On first launch, Thought Notes checks device RAM, available memory, free storage, thermal state and OS version where available. The recommended model targets at least 4 GB total RAM and 1 GB available RAM. Its optional download requires enough free storage for the model plus 512 MiB setup headroom. Typed notes remain in Inbox if the model is missing, the device is below the model baseline, or resources are temporarily constrained. Waiting synthesis resumes when the app is active and resources recover; Android also requests constrained WorkManager retries for eligible idle periods, while iOS retries after launch or foregrounding.

Canonical storage: `Documents/topics/*.md`; legacy `Documents/context.md` migrates at startup. Optional backups are plain JSON files saved to a location the user chooses. No claim of encrypted app storage or automatic cross-device synchronization is made.

## Validation

```sh
npm run validate:regression
npm run lint
npm run test:e2e:build:android
npm run test:e2e:android -- e2e/starter.test.js
```

With the checksum-verified recommended model already downloaded on the host, set `CONTEXTENGINE_MODEL_PATH=/absolute/path/gemma3-1b-it-int4.litertlm` when running the shared Detox suite to enable the real-inference journey. It must file a persisted note outside Inbox; fallback does not count as a pass.

Physical iPhone QA: follow `../skills/real-device-qa/SKILL.md`; evidence belongs under `artifacts/real-device-qa/` or the current release QA directory.

## Publication

`npm run release:preflight` checks combined store prerequisites; use `npm run release:preflight:android` for the Play-specific gate without iOS signing checks. `npm run ios:release` prepares an archive; `npm run android:release` requires externally supplied Play signing credentials. Keep signing inputs in git-ignored `.env.release.local` / `.release-secrets` as described in `docs/release-credentials.md`.

Publication still requires current native QA, approved screenshots, owner distribution/upload signing, public privacy/support metadata and store-console completion. Follow `implementation/status.json`, `implementation/index.md`, `docs/store-submission-package.md` and `app-behaviour.md` for evidence and remaining gates. Historical simulator success is not evidence of current model inference.
