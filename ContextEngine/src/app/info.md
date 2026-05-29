# `src/app` Architecture

This directory owns app bootstrap and shell composition.

## Files

- `AppBootstrap.ts`: sets the `context.md` path, loads persisted sections, initializes audio and synthesis, and runs a dev transcription probe.
- `AppShell.tsx`: top-level route state, header selection, scroll layout, bottom navigation, composer placement, runtime lifecycle logging, and feature screen wiring.
- `navigation.ts`: route type definitions.

## Responsibilities

- Keep native/bootstrap concerns out of feature screens.
- Keep navigation lightweight and local to the app shell until a dedicated navigator is introduced.
- Pass feature screens already-shaped props from selectors or store state.

## Notes For Agents

- `AppShell` currently uses local route state rather than React Navigation.
- The composer is intentionally shown only on the reflections route.
- Settings model refresh is triggered when the route enters `settings`.
- Thread details wire share actions through `src/shared/utils/share.ts`.
- The Inbox thread can enqueue existing fallback entries for another synthesis pass.
