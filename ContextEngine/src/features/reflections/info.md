# `src/features/reflections` Architecture

The reflections feature is the home surface for persisted context sections.

## Files

- `ReflectionsScreen.tsx`: home screen layout.
- `RecentThreadList.tsx`: list wrapper for recent sections.
- `ThreadCard.tsx`: topic/thread preview.
- `reflectionsSelectors.ts`: maps `ContextSection[]` into recent thread cards.
- `reflectionTypes.ts`: view types.

## Capture Readiness

- The home screen shows recording, stopping/transcribing, queue, ready, error, microphone-required, and voice-disabled states.
- When voice capture is unavailable, typed capture remains available and the status card links to Capture Settings for permission/model diagnostics.

## Domain Mapping

Each markdown `## Topic` section is treated as a thread-like reflection. The current app does not have a separate database-backed thread model.
