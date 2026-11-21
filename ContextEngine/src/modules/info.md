# `src/modules` Architecture

Modules are service-layer code below the UI and store. They encapsulate platform IO, model runtime behavior, and persistence.

## Modules

- `AudioEngine`: shared recording with device-selected Gemma 3n or Whisper transcription on Android and iOS, plus the foreground wake-word readiness surface.
- `ContextManager`: local markdown persistence for one topic file per thread/topic.
- `HeadsetTrigger`: native bridge for opt-in Android headset and lock-screen capture; direct iOS headset handling stays gated.
- `SynthesisEngine`: LiteRT-LM runtime wrapper, model catalog/download helpers, unified Gemma audio transcription on eligible devices, and failure-safe processing queue for capture and import flows.
- `ResearchHandoff`: optional FunctionGemma tool-call planner that prepares a user-reviewed research request; it does not open external apps or fetch web content.
- `DeviceReadiness`: native device memory/thermal checks, filesystem storage checks, and first-run setup-notice persistence.

## Dependency Direction

- `core/store.ts` coordinates modules.
- Feature UI should not call native modules directly.
- Queue and synthesis modules may call `ContextManager`; UI should not manage persistence ordering.
