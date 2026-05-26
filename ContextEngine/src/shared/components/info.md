# `src/shared/components` Architecture

Reusable visual primitives used by multiple feature screens.

## Components

- `AppBackground`: top-level visual background.
- `AppHeader`: brand, queue, and thread header variants.
- `BottomNav`: primary route switching.
- `Button`, `Card`, `Pill`, `SwitchRow`, `SectionHeader`, `Icon`: general UI primitives.

## Agent Notes

- Preserve the established design token imports from `src/shared/design`.
- Avoid feature-specific business logic here.
- If a component starts depending on a specific feature shape, move that wrapper into the feature directory.
