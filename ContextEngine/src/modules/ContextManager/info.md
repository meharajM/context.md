# `src/modules/ContextManager` Architecture

`ContextManager` owns the local markdown memory file.

## File Contract

The persisted file is:

```md
# Context Master File

## Topic
- [ISO timestamp] thought text
```

## Behavior

- `setPath(path)` must be called before writes.
- `readContext()` returns an empty array when the path is unset or the file is missing.
- `appendThought(header, thought)` ignores empty thought text.
- Successful voice captures are currently persisted first under `Inbox` so recording/transcription durability does not depend on the synthesis queue.
- `getInboxThoughts(sections)` extracts persisted Inbox entries and source metadata for re-synthesis.
- `removeThought(sectionHeader, thoughtText)` removes one matching persisted entry plus its source metadata.
- Blank topic headers normalize to `Inbox`.
- Existing sections are matched case-insensitively.
- Writes prefer temp-file plus move when `react-native-fs.moveFile` is available.

## Invariants

- Synthesis/runtime failure must still be persistable through `Inbox`.
- Inbox cleanup must happen only after a categorized replacement has been written successfully.
- Parser should tolerate manually edited markdown.
- The public API should stay small: set path, read sections, append thought.
