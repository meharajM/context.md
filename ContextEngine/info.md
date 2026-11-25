# ContextEngine

Android and iOS support typed capture, optional user-started voice capture with local transcription, local AI topic organization, and opt-in local reminders. Read `project-architecture.md`, `AGENTS.md`, and the current implementation tracker before changes.

- Typed capture persists stable raw Inbox notes before synthesis.
- Local LiteRT categorizes/refines notes; ambiguity asks the user; failed AI keeps raw Inbox data.
- ContextManager serializes storage reads/mutations and deduplicates same-topic stable note ids.
- AppShell owns reflections, queue, text import, settings, thread details, and editor routes.
- Fresh installs get an illustrated onboarding carousel with widget setup and model progress; Skip/Start remain available while downloads run.
- Current source offers English, Spanish, French, German, and Italian voice selection on both platforms. A fresh install infers voice language from the device's regional locale; saved user choices persist. The Play Store download country is not reliably accessible, so configured device locale is the region proxy. English can use Gemma 3n audio on eligible physical devices; the four European target languages use a small multilingual Whisper model. Physical-device writing-model selection uses total RAM and storage to select Gemma 3n E2B, Gemma 4 E2B/E4B, or compact Gemma3-1B. Automatic Whisper download requires the selected model to be missing and readiness/storage checks to pass. Capture asks for microphone access on first use and remains available while a transcription model is missing.
- An Android user-started recording can continue in the background under a microphone foreground service with a user-visible Stop action; the service never initiates capture.
- Android widget text and stopped recordings use a separate expedited foreground WorkManager handoff for prompt Inbox import/transcription; topic synthesis remains resource-gated and separately queued.
- Android production 1.0.8/code 9 is live on Google Play. Current source adds a flexible Play in-app update prompt; it is not included in 1.0.8 and requires a future Play release. API 34+ explicit user-started model downloads use UIDT; physical background transcription and high-spec model QA remain open in implementation/status.json.
- iOS user-started recording can continue when the app backgrounds; return to the app to stop. iOS 17+ Home and Lock Screen widgets hand off Write and Record to the app; capture does not run in WidgetKit.
- Android exposes opt-in headset and lock-screen capture with a visible foreground notification. iOS direct headset commands remain disabled; its Lock Screen Record widget opens the app. Wake word, assistant voice, audio-file import, and spoken summaries remain deferred.
- Shared AI text is saved durably and auto-filed when the app opens or returns to foreground; ambiguity prompts for a topic and failures remain recoverable in Inbox.
- Native inference evidence must come from an actual supported runtime. iOS simulator inference is disabled; Android bridge uses pinned LiteRT-LM 0.14.0.
- `implementation/status.json` records verified results and blockers. Do not mark publication complete without current native QA, owner-signed artifacts and store prerequisites.

Validation: `npm run validate:regression`, `npm run lint`, focused native tests/builds, text and Android widget Detox journeys, and compatible physical-device QA.
