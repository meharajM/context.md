# `src/modules` Architecture

Modules are service-layer code below the UI and store. They encapsulate platform IO, model runtime behavior, and persistence.

## Modules

- `AudioEngine`: Whisper recording and foreground wake-word readiness surface.
- `ContextManager`: local markdown persistence for one topic file per thread/topic.
- `HeadsetTrigger`: native bridge for deferred headset-triggered capture.
- `SynthesisEngine`: LiteRT-LM runtime wrapper, model catalog/download helpers, and failure-safe processing queue for capture and import flows.
- `DeviceReadiness`: native device memory/thermal checks, filesystem storage checks, and first-run setup-notice persistence.

## Dependency Direction

- `core/store.ts` coordinates modules.
- Feature UI should not call native modules directly.
- Queue and synthesis modules may call `ContextManager`; UI should not manage persistence ordering.
