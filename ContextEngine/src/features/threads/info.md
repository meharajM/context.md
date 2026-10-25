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

Inbox source rows also expose dedicated unsynthesized-note deletion. The app shell requires destructive confirmation, then calls store actions that protect active queue work and app-owned retained audio. Categorized topic rows do not expose this delete affordance.

When retained voice audio already has a transcript, its timeline status says the transcript is shown below rather than claiming transcription failed.

Thread sharing is delegated to the app shell and native share sheet helpers, so installed AI apps can receive either the thread context or an analysis prompt.

Persisted capture edits open a shared editor surface that can show metadata without crowding the thread rows.

Search opens a thread at the matching capture by stable note id. The row keeps its timeline position, reports its layout to the shell for scrolling, and shows a visible "Search result" marker and border for three seconds.

Thread summaries derive from decoded capture text, just like the timeline. Versioned multiline storage metadata and body prefixes never become preview/share text; literal user text that resembles metadata stays visible.
Text-note source transcripts are retained separately from display transcripts so editing/re-queueing can preserve metadata without exposing it as voice content.
