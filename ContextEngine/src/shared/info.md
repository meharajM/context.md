# `src/shared` Architecture

Shared code is reusable across features and should not depend on specific feature slices.

## Directories

- `components`: reusable UI primitives.
- `design`: design tokens for colors, spacing, shadows, radius, and typography.
- `hooks`: shared React hooks.
- `notes`: durable note identity and source metadata helpers.
- `utils`: platform and app utility functions, including voice import, permission, and share helpers.
- `audio`: bundled sample audio references plus app-owned retained-recording path guards.

## Rule

Shared code may be imported by features, app shell, and core store. Shared code should not import from feature directories.
