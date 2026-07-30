# `src/modules/ContextManager` Architecture

`ContextManager` owns the local per-topic markdown store.

## File Contract

Each persisted topic file is:

```md
# Topic
- [ISO timestamp] thought text
```

## Behavior

- `setPath(path, { legacyPath })` must be called before writes. App bootstrap supplies the former single-file `Documents/context.md` path so an existing install migrates it before loading.
- `readContext()` returns an empty array when the storage path is unset or no topic files exist.
- `appendThought(header, thought)` ignores empty thought text.
- Manual, Assistant, and successful voice captures are persisted first under `Inbox` so capture durability does not depend on the in-memory synthesis queue.
- `getInboxThoughts(sections)` extracts persisted Inbox entries and source metadata for re-synthesis.
- `removeThought(sectionHeader, thoughtText)` removes one matching persisted entry plus its source metadata.
- Source metadata can carry audio-file provenance for imported voice files and edited captures. Failed live recordings reference the app-owned durable `Documents/retained-audio` copy when that move/copy succeeds.
- Blank topic headers normalize to `Inbox`.
- Existing sections are matched case-insensitively.
- Topic filenames are slugged from the topic header and each topic persists to its own `.md` file under the configured storage directory.
- The canonical store is `Documents/topics/*.md`; a legacy consolidated `Documents/context.md` is migration input, not a second source of truth, and is removed only after every parsed section is accounted for. On coexistence, content already present is skipped and divergent same-name sections are written as `Legacy <topic>` rather than risk a lossy merge.
- Writes prefer temp-file plus move when `react-native-fs.moveFile` is available.

## Invariants

- Synthesis/runtime failure must still be persistable through `Inbox`.
- Inbox cleanup must happen only after a categorized replacement has been written successfully.
- Parser should tolerate manually edited markdown.
- The public API should stay small: set path, read sections, append thought.
