# Thought Notes

Text-first, local-first notes for iOS and Android. Capture a typed thought, organize it with optional on-device AI, and keep context in local per-topic Markdown files.

## Current publication scope

At the latest Play check, production was 1.0.10/code 11 and 1.0.11/code 12 was in review: [Thought Notes on Google Play](https://play.google.com/store/apps/details?id=com.meharaj.contextengine). Android API 34+ explicit user-started model downloads use UIDT; automatic and older-Android downloads use WorkManager. Widget capture and synthesis are durable, but Android may defer background work under resource or system limits. Current physical-device gaps and the marketing plan are in docs/marketing-and-release-plan.md.

The current Android source checks for Google Play in-app updates when the app returns to the foreground. It offers a flexible update, downloads after Play consent, then asks before restarting; background auto-install remains controlled by the user's Google Play settings. As of the last verified Play check (2026-11-19), production was 1.0.10/code 11 and 1.0.11/code 12 was in review; check `implementation/status.json` before describing source changes as released. See [Google Play in-app updates](docs/google-play-in-app-updates.md).

Meeting mode is included in the published Android 1.0.8 app and in shared iOS source. Redmi 3S/API 30 E2E completed a 63:11 background and lock-screen recording: the foreground service, microphone indicator, and recording notification persisted; Stop finalized 189 timestamped transcript segments through 62:43. The transcript saved shortly after Stop, and the WAV was removed at the configured five-minute deadline. Separate Android Sharesheet previews passed for summary, transcript, action items, and all available content; a 63-minute transcript preview opened without choosing a destination. Saving and updating created one Inbox note without duplication. Shorter current-source physical QA runs generated suggested actions and an on-device summary automatically after Stop, with summary latency around 30 seconds to three minutes. When on-device summary inference is unavailable or fails, the app creates clearly labeled transcript highlights and warns users to check recognition against the transcript. A 63-minute transcript attempt timed out in LiteRT inference; hour-long summary completion remains unverified. Recognition was noisy in physical runs. High-quality human-meeting transcription, recipient delivery, physical iOS, and remaining release gates are open. A follow-up listing edit moves Meeting screenshots from positions 3–4 to 1–2 and leads the description with Meeting mode; Google Play review is pending.

- Current source selects voice models by device readiness on both platforms: eligible physical devices automatically download Gemma 3n E2B for transcription and writing; lower-resource devices use Gemma3-1B plus Whisper. Published Android retains its existing model path until a new app release. Model files stay in private app storage and can be retried from Settings.

- Typed notes persist in Inbox before asynchronous processing. When the selected writing model is missing or downloading, queued synthesis waits and the original remains in Inbox.
- LiteRT-LM organizes notes into topics using existing context and can generate a short per-capture summary while preserving the full original.
- Ambiguous routing asks for a topic choice; missing or failing AI keeps the original text in Inbox.
- Pasted-text import supports explicit topic selection and approval before suggested topic merges. Shared AI responses are saved durably, auto-filed when Thought Notes opens or returns to foreground, and kept recoverable in Inbox if routing is ambiguous or a model is unavailable.
- Browse threads, edit notes, retry Inbox synthesis, and share context through the native share sheet.
- Search saved note text, source transcripts, and topic names on device.
- Export the library as a plain JSON backup or restore it additively; existing notes are kept and audio recordings are not included.
- On Android and iOS, an optional Settings switch finds tasks in new notes and schedules local notifications with on-device AI; it asks for no task details and stays off until enabled.
- Writing and FunctionGemma models run locally. Compatible Android devices may automatically download the writing model when readiness and storage allow; explicit download controls also remain available. The optional source-only research handoff shares the task and selected topic context only after the user opens the OS share sheet and chooses a destination such as ChatGPT. This new handoff is not included in the published build or device-validated yet.

Android also supports optional voice capture from the in-app Record control or home-screen widget. Widget Record starts on the launcher, shows a live timer and Stop control, and does not open the main app. Widget Write opens a compact text capture sheet. A recording can continue while the app is closed under a microphone foreground service and can be stopped from the widget or service notification. Eligible Android/iOS devices select Gemma 3n E2B (about 3.66 GB) for both jobs; lower-resource devices use Gemma3-1B with Whisper. Both prompts request verbatim English across accents, including Indian English, but physical iPhone accuracy has not been validated. iOS 17+ Home and Lock Screen widgets hand off Write, Record, or Meeting to the app; direct headset commands remain disabled on iOS. Android headset capture is opt-in in current source, with physical accessory verification still open. Audio import, wake words, assistant voice intents, and spoken summaries remain deferred.

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

Recommended writing model: Gemma3-1B-IT, approximately 585 MB, CPU backend, 4 GB device-memory target. On lower-resource devices, it pairs with Whisper tiny.en for speech transcription. Eligible Android and iOS devices use Gemma 3n E2B for both speech and writing. Compatible Android devices may download the selected model automatically when readiness and storage allow; download controls are also available from Home or Settings. Model assets are not committed. Captures remain usable in Inbox without the model, and queued synthesis waits until the selected model is installed.

Automatic selection uses the same policy on iOS and Android. Physical devices with at least 8 GiB RAM and 3.66 GB plus 512 MiB setup headroom select Gemma 3n E2B for speech transcription and note organization. Lower-resource devices, including simulators, use the 32 MB Whisper tiny.en model for speech and Gemma3-1B-IT for writing. Other catalog models remain optional downloads.

On first launch, Thought Notes checks device RAM, available memory, free storage, thermal state and OS version where available. The recommended model targets at least 4 GB total RAM and 1 GB available RAM. Its optional download requires enough free storage for the model plus 512 MiB setup headroom. Typed notes remain in Inbox if the model is missing, the device is below the model baseline, or resources are temporarily constrained. Waiting synthesis can resume through OS-scheduled Android WorkManager or iOS BGProcessingTask when the system grants runtime, and through app launch/foreground recovery. Neither platform promises a completion time.

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

Android 1.0.8/code 9 is live on Google Play. A follow-up listing update—Meeting screenshots moved to positions 1–2 and a Meeting-first description opening—is in review. Any later app release requires a higher version code and fresh signing, provenance, and release preflight. iOS publication and device validation remain separate. Follow implementation/status.json, implementation/index.md, docs/store-submission-package.md, docs/marketing-and-release-plan.md and app-behaviour.md for current evidence. Historical simulator success is not evidence of current model inference.
