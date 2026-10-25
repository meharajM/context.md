# ContextEngine

Android v1 supports text plus optional, user-initiated in-app or home-screen-widget voice capture with local transcription; iOS remains text-only. Read `project-architecture.md`, `AGENTS.md`, and the current implementation tracker before changes.

- Typed capture persists stable raw Inbox notes before synthesis.
- Local LiteRT categorizes/refines notes; ambiguity asks the user; failed AI keeps raw Inbox data.
- ContextManager serializes storage reads/mutations and deduplicates same-topic stable note ids.
- AppShell owns reflections, queue, text import, settings, thread details, and editor routes.
- Android initializes Whisper when recording is requested and asks for microphone access at that point; voice capture starts from the app or home-screen widget.
- An Android user-started recording can continue in the background under a microphone foreground service with a user-visible Stop action; the service never initiates capture.
- Android headset media-button and lock-screen capture are disabled for v1; audio import, wake word, assistant voice, spoken summaries, and iOS voice capture remain deferred behind `src/core/releaseCapabilities.ts` and native release gates.
- Native inference evidence must come from an actual supported runtime. iOS simulator inference is disabled; Android bridge uses pinned LiteRT-LM 0.14.0.
- `implementation/status.json` records verified results and blockers. Do not mark publication complete without current native QA, owner-signed artifacts and store prerequisites.

Validation: `npm run validate:regression`, `npm run lint`, focused native tests/builds, text and Android widget Detox journeys, and compatible physical-device QA.
