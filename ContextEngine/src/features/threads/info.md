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

Thread sharing is delegated to the app shell and native share sheet helpers, so installed AI apps can receive either the thread context or an analysis prompt. Assistant prompts request a plain-text response capped at 250 words, with fixed headings for key findings, decisions, risks, next steps, and open questions; they ask the assistant to omit empty headings and add insights without repeating notes.

“Research with ChatGPT” uses FunctionGemma to prepare a query locally, then shares the task and thread context through the OS share sheet. Its 250-word response format retains clickable sources and dates, separates verified facts from inference, and states important gaps. The user selects ChatGPT, submits the request, and shares ChatGPT's response back into the app's existing import flow. This does not launch, inspect, or control ChatGPT automatically; the round trip and platform-specific import have not been device-validated.

Persisted capture edits open a shared editor surface that can show metadata without crowding the thread rows. Thread actions follow the source timeline with one compact spacing step.

Search opens a thread at the matching capture by stable note id. The row keeps its timeline position, reports its layout to the shell for scrolling, and shows a visible "Search result" marker and border for three seconds.

Recent thread previews derive from the newest decoded captures and their optional generated summaries. Versioned multiline storage metadata and body prefixes never become preview/share text; literal user text that resembles metadata stays visible.
Text-note source transcripts are retained separately from display transcripts so editing/re-queueing can preserve metadata without exposing it as voice content.

- Each capture can show a separately labeled AI summary while keeping its full original note visible. The lightweight recent preview uses the newest three captures, preferring generated summaries when present; legacy raw excerpts are never labeled as AI summaries.
