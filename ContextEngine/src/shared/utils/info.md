# `src/shared/utils` Architecture

Utility functions that are not feature-specific.

## Files

- `permissions.ts`: microphone permission request helper.
- `share.ts`: formats thread context and opens the native share sheet for general context sharing or AI-oriented prompts.

## Policy

Audio permission is requested lazily when the user starts an audio action, not during initial app launch.
