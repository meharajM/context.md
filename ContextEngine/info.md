# ContextEngine

Android and iOS support typed capture, optional user-started voice capture with local transcription, local AI topic organization, and opt-in local reminders. Read `project-architecture.md`, `AGENTS.md`, and the current implementation tracker before changes.

- Typed capture persists stable raw Inbox notes before synthesis.
- Local LiteRT categorizes/refines notes; ambiguity asks the user; failed AI keeps raw Inbox data.
- ContextManager serializes storage reads/mutations and deduplicates same-topic stable note ids.
- AppShell owns reflections, queue, text import, settings, thread details, and editor routes.
- Fresh installs get a prominent illustrated onboarding carousel with widget setup and compact model progress; Skip/Start unlock after Whisper is ready, while Home capture remains available.
- Android initializes Whisper when recording is requested and asks for microphone access at that point; capture starts from the app or home-screen widget. iOS includes Whisper in the app and asks for microphone access when recording starts.
- English transcription remains the default. Settings can download and select the optional Hindi / Hinglish multilingual model on either platform.
- An Android user-started recording can continue in the background under a microphone foreground service with a user-visible Stop action; the service never initiates capture.
- Android widget text and stopped recordings use a separate expedited foreground WorkManager handoff for prompt Inbox import/transcription; topic synthesis remains resource-gated and separately queued.
- iOS user-started recording can continue when the app backgrounds; return to the app to stop. Its iOS 17+ home-screen widget opens the app to start Write or Record. iOS does not have Android's ongoing recording Stop notification or independent widget recorder.
- Automatic reminders use on-device inference and local notifications on both platforms. Audio-file import, wake word, assistant voice, headset triggers, and spoken summaries remain deferred behind `src/core/releaseCapabilities.ts` and native release gates.
- Native inference evidence must come from an actual supported runtime. iOS simulator inference is disabled; Android bridge uses pinned LiteRT-LM 0.14.0.
- `implementation/status.json` records verified results and blockers. Do not mark publication complete without current native QA, owner-signed artifacts and store prerequisites.

Validation: `npm run validate:regression`, `npm run lint`, focused native tests/builds, text and Android widget Detox journeys, and compatible physical-device QA.
