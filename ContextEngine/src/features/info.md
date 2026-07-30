# `src/features` Architecture

Feature directories own user-facing slices. Each feature should keep presentation components, view types, and selectors close together.

## Feature Slices

- `capture`: composer state and capture controls.
- `import`: dedicated text and voice import workflow with preview and merge permission prompts.
- `queue`: queued thought progress and job cards.
- `reflections`: home/reflection thread list.
- `settings`: capture mode, model management, diagnostics, and privacy UI.
- `threads`: thread detail and source timeline UI, including confirmation-based unsynthesized Inbox deletion.

## Pattern

- Selectors convert raw store/domain state into view models.
- Components receive shaped props and callbacks.
- Feature components should not directly call `ContextManager`, native modules, or `SynthesisService`.
