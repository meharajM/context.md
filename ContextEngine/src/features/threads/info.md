# `src/features/threads` Architecture

The threads feature displays details for a selected persisted context section.

## Files

- `ThreadDetailsScreen.tsx`: detail screen composition.
- `SummaryCard.tsx`: topic summary presentation.
- `SourceCaptureTimeline.tsx`: timeline of captured source entries.
- `threadSelectors.ts`: converts a `ContextSection` into detail/timeline view state.
- `threadTypes.ts`: detail view types.

## Current Model

Thread details are derived from markdown sections. There is no durable thread database, vector index, or remote sync layer in the MVP.

Inbox is a special fallback thread. Its detail screen exposes a re-synthesis action that asks the store to queue existing Inbox entries for another topic-classification pass.

Thread sharing is delegated to the app shell and native share sheet helpers, so installed AI apps can receive either the thread context or an analysis prompt.

Persisted capture edits open a shared editor surface that can show metadata without crowding the thread rows.
