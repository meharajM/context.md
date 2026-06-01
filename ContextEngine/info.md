# ContextEngine Architecture

ContextEngine is an iOS-first React Native application for capturing typed and spoken thoughts into a local `context.md` knowledge file. The app is designed to be offline-first and failure-safe: every non-empty thought should be persisted even when audio transcription, LiteRT-LM synthesis, or model downloads are unavailable.

## Current MVP State

- The active app entrypoint is `App.tsx`, which bootstraps `src/app/AppShell.tsx`.
- Runtime state lives in `src/core/store.ts` using Zustand.
- Captured thoughts flow through `src/modules/SynthesisEngine/ProcessingQueueManager.ts`.
- Persistence is handled by `src/modules/ContextManager/index.ts`.
- Synthesis is LiteRT-only when available, with raw `Inbox` fallback when unavailable.
- Audio capture is Whisper-backed through `src/modules/AudioEngine/AudioEngineImpl.ts`.
- Wake-word support is foreground-only by policy and currently reports unavailable until a real keyword spotter is bundled.
- Android LiteRT/NPU work is deferred.

## Important Agent Rules

- Follow `AGENTS.md` before and after every coding change.
- Read `implementation/status.json` before changing implementation scope.
- Small-context agents should read `implementation/SMALL_AGENT_HANDOFF.md` after `status.json`.
- Read only the current phase in `implementation/phases.json` unless broader context is required.
- Do not claim background wake-word, lock-screen capture, Android NPU, or cloud/agent sync as implemented.
- Preserve the raw persistence fallback. A model failure must not drop a thought.
- Avoid editing generated native build outputs, Gradle caches, Xcode user data, or vendored LiteRT-LM internals unless the task explicitly requires it.

## Main Runtime Flow

1. `App.tsx` mounts `SafeAreaProvider`, `AppBackground`, and `AppShell`.
2. `useAppBootstrap()` configures `ContextManager` with `RNFS.DocumentDirectoryPath/context.md`.
3. The store initializes audio readiness, model catalog state, queue subscription, and LiteRT readiness.
4. The composer submits typed or transcribed text into `ProcessingQueueManager`.
5. The queue calls `SynthesisService.synthesize()`.
6. Successful LiteRT output is normalized and appended to its topic.
7. Missing or failing synthesis appends raw text under `Inbox`.
8. Inbox fallback entries can be requeued after a model becomes available; successful re-synthesis removes the original Inbox entry after writing the categorized thread entry.
9. Queue completion triggers a context reload into Zustand sections.
10. Thread details use the native share sheet for sharing context or an AI-oriented prompt to any compatible installed app.

## Validation

Use the tracker phase validation first. For the current release phase, the important commands are:

```sh
npm run typecheck -- --pretty false
npm run lint
npm test -- --runInBand
```

For physical-device launch checks, use `npm run ios:device`.
For repeatable real-device behavior QA with evidence capture, use `npm run qa:real-device` after confirming WDA is reachable.

## Behavior Spec

- `app-behaviour.md` is the canonical QA behavior matrix for capture, synthesis, fallback, inbox re-synthesis, sharing, and regression checks.
- `app-behaviour.md` is a target roadmap spec using `Implemented` vs `Planned` status labels; do not treat planned items as already shipped behavior.
- Project-local skill playbooks live under `skills/`; use `skills/real-device-qa/SKILL.md` for physical iOS QA runs.
