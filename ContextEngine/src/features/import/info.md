# `src/features/import` Architecture

The import feature owns the dedicated text and voice import surface.

## Files

- `ImportScreen.tsx`: import workflow UI, voice-file selection, topic search, preview, and merge permission prompts.

## Behavior

- Text import can target a topic explicitly or let synthesis choose a new topic.
- Voice import accepts local audio files and the bundled sample clip used by simulator QA.
- Existing topics are searchable and optional.
- Related-topic merge candidates require explicit user approval before queueing.
- Imported audio metadata is preserved when a local file path is available.
