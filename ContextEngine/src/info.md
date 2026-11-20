# `src` Architecture

`src` contains the owned React Native application code. It is split by responsibility:

- `app`: bootstrap, navigation types, and top-level shell composition.
- `core`: Zustand store and runtime orchestration; Meeting stop persists the full transcript and suggested actions, then records whether the summary came from on-device inference or clearly labeled transcript highlights.
- `features`: screen-level feature slices and view-model selectors, including reflections, queue, capture, settings, meetings, threads, note editor, and import.
- `modules`: platform/runtime services such as context persistence, audio, synthesis, and queueing.
- `shared`: reusable UI, design tokens, hooks, utilities, and sample assets.
- `ui`: higher-level visual design constants used by the current interface.
- `components`: project-specific standalone components that do not belong to a feature slice.

The intended dependency direction is UI -> store/selectors -> modules. Modules should not import feature components.
