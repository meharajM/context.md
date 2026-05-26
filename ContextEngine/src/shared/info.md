# `src/shared` Architecture

Shared code is reusable across features and should not depend on specific feature slices.

## Directories

- `components`: reusable UI primitives.
- `design`: design tokens for colors, spacing, shadows, radius, and typography.
- `hooks`: shared React hooks.
- `utils`: platform and app utility functions.
- `audio`: bundled sample audio references for diagnostics/tests.

## Rule

Shared code may be imported by features, app shell, and core store. Shared code should not import from feature directories.
