# `src/shared/utils` Architecture

Utility functions that are not feature-specific.

## Files

- `permissions.ts`: microphone permission request helper.

## Policy

Audio permission is requested lazily when the user starts an audio action, not during initial app launch.
