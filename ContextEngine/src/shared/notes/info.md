# `src/shared/notes` Architecture

Shared note contracts live here so queue, persistence, and editor flows can agree on identity and source metadata.

## Files

- `noteTypes.ts`: stable note identity and source metadata helpers.

## Invariants

- `noteId` is the durable identifier for a note across queue and persisted context.
- Source metadata should preserve the original capture kind, transcript, and upstream note reference when notes are edited and re-synthesized.
