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

## Text Release Scope

The current text release exposes pasted text only. Voice picker/sample controls remain retained behind `RELEASE_CAPABILITIES.voiceImport`; store actions reject voice import before transcription or queue mutation.

Draft/source/topic/preview state remains mounted across ordinary route changes. The active-route prop hides topic modals off-route. Every source/text/topic edit invalidates the preview revision; delayed analysis cannot restore obsolete merge approval or save text. A synchronous busy guard prevents duplicate analysis/import submissions, and save completion preserves a newer draft. No process-restart draft persistence is provided.

Raw-fallback review marks the note as saved as written; supporting copy only explains that automatic sorting failed.
