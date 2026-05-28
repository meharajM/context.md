# `src/features/noteEditor` Architecture

The note editor feature provides the shared edit surface for queued notes and persisted captures.

## Files

- `NoteEditorScreen.tsx`: edit form, metadata modal, and topic selector modal.

## Runtime Meaning

- Queue edits can retarget a queued note to an existing context topic before synthesis.
- Persisted capture edits preserve source metadata and can show it without adding row clutter.
- Topic selection is backed by the current context section list and remains optional.
