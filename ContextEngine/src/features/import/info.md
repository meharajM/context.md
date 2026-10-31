# `src/features/import` Architecture

The import feature owns the dedicated text and voice import surface.

## Files

- `ImportScreen.tsx`: import workflow UI, voice-file selection, topic search, preview, and merge permission prompts.

## Behavior

- Text import accepts pasted or shared text, can target a topic explicitly, or lets synthesis choose a new topic.
- Voice import accepts local audio files and the bundled sample clip used by simulator QA.
- Existing topics are searchable and optional.
- The bottom route is labeled `Paste` to distinguish long-form paste/share import from the Home quick-capture composer. Manual topic choice is explicitly marked optional; blank lets synthesis choose.
- The screen introduces the action as `Paste or share` and explains that on-device AI can connect the content to related notes without a decorative icon tile. When the writing helper is unavailable, one concise status explains that notes stay in Inbox until it is installed.
- Related-topic merge candidates require explicit user approval before queueing.
- Imported audio metadata is preserved when a local file path is available.

## Text Release Scope

The current text release exposes pasted and externally shared text. Voice picker/sample controls remain retained behind `RELEASE_CAPABILITIES.voiceImport`; store actions reject voice import before transcription or queue mutation.

Draft/source/topic/preview state remains mounted across ordinary route changes. The active-route prop hides topic modals off-route. Every source/text/topic edit invalidates the preview revision; delayed analysis cannot restore obsolete merge approval or save text. A synchronous busy guard prevents duplicate analysis/import submissions, and save completion preserves a newer draft. No process-restart draft persistence is provided.

Shared text stays in the platform outbox until the note is saved. The share id is the note id, so retrying after a failed acknowledgement cannot create a second note or replace the saved draft; an existing Inbox or filed note is acknowledged without re-queueing.

Raw-fallback review marks the note as saved as written; supporting copy only explains that automatic sorting failed.

The source and topic forms use standalone outlined fields on the page surface; the preview keeps a single card container so forms do not acquire nested borders. Before a preview exists, its action sits directly on the page without an empty review-card frame. The compact multiline field keeps the Preview note action visible on the API 36 phone at the default scroll position.

- Model-backed previews can display a labeled AI summary beside the full original import. Accepted previews persist that summary as source metadata through Inbox and queued processing; raw fallback never invents one. Automatic shared-response filing preserves the same separate-summary contract.
