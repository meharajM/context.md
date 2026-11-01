# `src/features/reflections` Architecture

The reflections feature is the home surface for persisted context sections.

## Files

- `ReflectionsScreen.tsx`: home screen layout.
- `RecentThreadList.tsx`: list wrapper for recent sections.
- `ThreadCard.tsx`: topic/thread preview.
- `reflectionsSelectors.ts`: maps `ContextSection[]` into recent thread cards.
- `reflectionsSelectors.ts` also searches note text, source transcripts, and topic names without leaving the device.
- `reflectionTypes.ts`: view types.

## Capture Readiness

- Android home shows recording, stopping/transcribing, queue, ready, error, and microphone-required states for on-demand capture. iOS remains text-only.
- Home status distinguishes a note organized into a topic from one left in Inbox, and shows the successful destination.
- A status action opens Waiting for queued work, the existing Inbox for a saved fallback, or the exact named topic after organization; it is absent when the destination is missing. The first-run readiness notice suppresses the separate download prompt while visible.
- For Android pending notes, home status says when WorkManager accepted a background retry or when the retry could not be scheduled. It reports no ETA and never labels a merely queued note as processing.
- When Android voice capture is unavailable, typed capture remains available and the status card links to Capture Settings for permission/model diagnostics.
- Model prompts use plain-language readiness and download-size guidance. Inference may be slow or fail on constrained devices; captures remain safe in Inbox until categorized.
- The Home introduction uses a concise topic-organizing message and keeps on-device processing visible when model work is still getting ready.
- The first-use Home hides search until notes exist and stays focused on the composer and topics. A fresh install sees the separate `FirstRunTutorial` carousel once: Android widget capture, on-device topic organization, and bringing assistant replies back. The guide leads visually; compact model progress sits beneath it. Swipe, dots, and Back/Next remain available; Skip and Start remain available while Whisper downloads, with retry if setup fails. Text capture stays available; voice capture stays disabled until Whisper is ready. AppShell persists completion through DeviceReadiness setup state.
- Topic rows show a title, one-line note preview, and note count/update time without decorative icon tiles or a container around the whole list.
- Capture confirmations retain their destination action in a compact, quiet status surface.

## Domain Mapping

Each markdown `## Topic` section is treated as a thread-like reflection. The current app does not have a separate database-backed thread model.
Search results retain the stable note id alongside the topic id so the existing timeline can reveal the exact match.

## Release Scope

Android may show microphone and voice-capture setup guidance. iOS keeps typed-capture readiness without microphone/voice setup. Queue and model download status still take priority.

Topic IDs encode the exact persisted header and never include section position, mtime, or a lossy slug. Recent-topic and search selectors share this identity. Persisted/generated legacy note IDs remain unchanged. Counts, timestamps, previews, and search read ContextManager-decoded notes so multiline storage encoding stays out of UI text.

- Topic previews use the newest three notes by update/capture time (reverse stored order breaks ties), preferring persisted AI summaries while retaining full originals for search, editing, sharing, and export.
