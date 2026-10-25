# Assistant Intents

## Current release scope — 2026-10-17

The Android publication candidate supports typed notes, pasted-text import, optional on-demand headset/on-screen voice capture with local transcription, on-device synthesis, topic filing, ambiguous-topic clarification, Inbox fallback/retry, editing, and sharing. iOS remains text-only.

Audio-file import, wake words, headset button triggers, assistant voice intents, and spoken summaries are **future deliverables**. Android v1 requests microphone permission only for user-initiated recording in the app or home-screen widget, while the app is in use. Audio is transcribed locally and successful working recordings are deleted; failed/aborted audio is kept in app-private storage with its Inbox note. No assistant shortcut discovery is enabled in this release.

The current gate is actual typed-note -> model-backed synthesis -> topic persistence on both platforms, plus durable fallback/relaunch. Unit tests or an Inbox fallback do not prove model synthesis. Physical-device QA, production signing, approved screenshots, and complete publisher/privacy/store metadata remain required before publication.

This scope supersedes older voice-MVP and headset release gates below; historical validation remains historical evidence.


This describes a planned OS-level Siri/Shortcuts text capture path. Assistant capture is not enabled in the current release.

## Planned invocation patterns

- "Add this to my context in Context Engine"
- "Capture thought with Context Engine"
- Any equivalent Siri or Shortcuts action that passes a text payload into the app action

## Planned behavior

- The intent accepts text content only.
- Payload text is normalized before it enters the app store.
- Assistant captures use the same persistence-safe queue flow as manual text capture.
- Empty or whitespace-only payloads are ignored.

## Platform limits

- No custom wake word is required or implemented for this path.
- Assistant capture is not free-form parsing of arbitrary assistant output.
- The user still has to bind the action in Shortcuts or the platform settings flow where required.
- Android headset capture is a separate, enabled path; assistant intents remain gated.
