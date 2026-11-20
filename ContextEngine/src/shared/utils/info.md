# `src/shared/utils` Architecture

Utility functions that are not feature-specific.

## Files

- `permissions.ts`: microphone and active-recording notification permission request helpers.
- `share.ts`: formats thread and selected meeting content and opens the native share sheet for general sharing, AI prompts capped at 250 words with fixed headings, and user-mediated research handoffs with dated clickable sources.
- `meetingContent.ts`: formats a meeting title, duration, summary source label, suggested-action states, and timestamped transcript as separate or combined plain-text payloads for sharing and full-content saving to notes.
- `voiceFilePicker.ts`: native document picker wrapper for voice imports and user-selected JSON backup import/export; backup files are capped at 10 MB.
- `voiceImport.ts`: supported voice import extensions, path normalization, and source description helpers.
- `text.ts`: shared text normalization helpers for assistant capture payloads.
- `simpleStatus.ts`: short user-facing status copy, including explicit Inbox fallback and categorized outcomes.

## Policy

Audio permission is requested lazily when the user starts an audio action, not during initial app launch.
On Android 13+, active recording requests notification permission once so the foreground service's Stop action stays visible. A declined choice is remembered; users can still record and use the in-app Stop controls on every route.
