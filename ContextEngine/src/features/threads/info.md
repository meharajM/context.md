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
