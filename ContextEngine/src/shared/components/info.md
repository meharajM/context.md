# `src/shared/components` Architecture

Reusable visual primitives used by multiple feature screens.

## Components

- `AppBackground`: top-level visual background.
- `AppHeader`: brand, queue, and thread header variants.
- `BottomNav`: primary route switching.
- `Button`, `Card`, `Pill`, `SwitchRow`, `SectionHeader`, `Icon`: general UI primitives.
- The brand header keeps the product name primary and shows local storage as a small lock-and-text cue instead of a prominent status pill.

## Agent Notes

- Preserve the established design token imports from `src/shared/design`.
- Use theme-tinted monochrome symbols; draw microphone, note, account, lock, image, and trash icons from native views to avoid emoji color rendering.
- Avoid feature-specific business logic here.
- If a component starts depending on a specific feature shape, move that wrapper into the feature directory.
