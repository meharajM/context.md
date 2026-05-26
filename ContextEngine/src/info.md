# `src` Architecture

`src` contains the owned React Native application code. It is split by responsibility:

- `app`: bootstrap, navigation types, and top-level shell composition.
- `core`: Zustand store and runtime orchestration.
- `features`: screen-level feature slices and view-model selectors.
- `modules`: platform/runtime services such as context persistence, audio, synthesis, and queueing.
- `shared`: reusable UI, design tokens, hooks, utilities, and sample assets.
- `ui`: higher-level visual design constants used by the current interface.
- `components`: project-specific standalone components that do not belong to a feature slice.

The intended dependency direction is UI -> store/selectors -> modules. Modules should not import feature components.
