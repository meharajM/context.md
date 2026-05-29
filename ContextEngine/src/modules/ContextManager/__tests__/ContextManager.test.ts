import fs from 'react-native-fs';

import { ContextManager } from '../index';

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  moveFile: jest.fn(),
  unlink: jest.fn(),
}));

describe('ContextManager', () => {
  const mockPath = '/mock/context.md';

  beforeEach(() => {
    jest.clearAllMocks();
    ContextManager.setPath(mockPath);
  });

  it('returns empty sections when the file is missing', async () => {
    (fs.exists as jest.Mock).mockResolvedValue(false);

    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
  });

  it('returns empty sections when the path has not been configured', async () => {
    ContextManager.setPath('');

    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
    expect(fs.exists).not.toHaveBeenCalled();
  });

  it('parses sections correctly', async () => {
    const markdown = `# Title\n\n## Ideas\n- Idea 1\n\n## Projects\n- Project 1\n`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(markdown);

    const result = await ContextManager.readContext();

    expect(result).toHaveLength(2);
    expect(result[0].header).toBe('Ideas');
    expect(result[1].header).toBe('Projects');
  });

  it('matches existing sections case-insensitively', async () => {
    const initialMarkdown = `# Title\n\n## ideas\n- Idea 1`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('  IDEAS  ', 'New Idea');

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[0]).toBe(`${mockPath}.tmp`);
    expect(writeCall[1]).toContain('## ideas');
    expect(writeCall[1]).toContain('Idea 1');
    expect(writeCall[1]).toContain('New Idea');
    expect(fs.moveFile).toHaveBeenCalledWith(`${mockPath}.tmp`, mockPath);
  });

  it('normalizes blank topics to Inbox', async () => {
    (fs.exists as jest.Mock).mockResolvedValue(false);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('   ', 'Fallback note');

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('## Inbox');
    expect(writeCall[1]).toContain('Fallback note');
  });

  it('preserves a supplied note id and source metadata during append', async () => {
    (fs.exists as jest.Mock).mockResolvedValue(false);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('Inbox', 'Tracked note', {
      noteId: 'note-123',
      sourceKind: 'voice',
      sourceTranscript: 'raw transcript',
      sourceMetadata: {
        noteId: 'source-456',
        sectionHeader: 'Source thread',
        text: 'Original source text',
        audioFilePath: '/tmp/voice.wav',
      },
    });

    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('Note id: note-123');
    expect(writeCall[1]).toContain('Source kind: VOICE');
    expect(writeCall[1]).toContain('Source transcript: raw transcript');
    expect(writeCall[1]).toContain('Source note id: source-456');
    expect(writeCall[1]).toContain('Source section: Source thread');
    expect(writeCall[1]).toContain('Source text: Original source text');
    expect(writeCall[1]).toContain('Source audio file: /tmp/voice.wav');
  });

  it('uses atomic write when moveFile is available', async () => {
    const initialMarkdown = `# Title\n\n## Ideas\n- Idea 1`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);

    await ContextManager.appendThought('Ideas', 'Atomic save');

    expect(fs.writeFile).toHaveBeenCalledWith(`${mockPath}.tmp`, expect.any(String), 'utf8');
    expect(fs.moveFile).toHaveBeenCalledWith(`${mockPath}.tmp`, mockPath);
  });

  it('extracts Inbox thoughts with source metadata', async () => {
    const sections = [
      {
        header: 'Inbox',
        content: `
- [2026-05-27T10:00:00.000Z] Raw voice note
  Source kind: VOICE
  Source transcript: original voice transcript
  Source audio file: /tmp/raw-voice.wav
- [2026-05-27T10:05:00.000Z] Raw typed note
        `.trim(),
      },
    ];

    const thoughts = ContextManager.getInboxThoughts(sections);

    expect(thoughts).toEqual([
      expect.objectContaining({
        sectionHeader: 'Inbox',
        text: 'Raw voice note',
        sourceKind: 'voice',
        sourceTranscript: 'original voice transcript',
        sourceMetadata: expect.objectContaining({
          audioFilePath: '/tmp/raw-voice.wav',
        }),
      }),
      expect.objectContaining({
        sectionHeader: 'Inbox',
        text: 'Raw typed note',
        sourceKind: undefined,
      }),
    ]);
  });

  it('removes a single matching thought and its source metadata', async () => {
    const initialMarkdown = `# Title

## Inbox
- [2026-05-27T10:00:00.000Z] Raw voice note
  Source kind: VOICE
  Source transcript: original voice transcript
- [2026-05-27T10:05:00.000Z] Keep this note
`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);

    const removed = await ContextManager.removeThought('Inbox', 'Raw voice note');

    expect(removed).toBe(true);
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).not.toContain('Raw voice note');
    expect(writeCall[1]).not.toContain('original voice transcript');
    expect(writeCall[1]).toContain('Keep this note');
  });

  it('can remove a duplicate Inbox thought by parsed entry id', async () => {
    const initialMarkdown = `# Title

## Inbox
- [2026-05-27T10:00:00.000Z] Duplicate note
- [2026-05-27T10:05:00.000Z] Duplicate note
`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);

    const removed = await ContextManager.removeThought('Inbox', 'Duplicate note', 'inbox-1');

    expect(removed).toBe(true);
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('[2026-05-27T10:00:00.000Z] Duplicate note');
    expect(writeCall[1]).not.toContain('[2026-05-27T10:05:00.000Z] Duplicate note');
  });

  it('updates a specific thought without losing its note identity or source metadata', async () => {
    const initialMarkdown = `# Title

## Inbox
- [2026-05-27T10:00:00.000Z] Raw note
  Note id: note-123
  Created at: 2026-05-27T10:00:00.000Z
  Source kind: VOICE
  Source transcript: original transcript
  Source note id: source-456
  Source section: Source thread
  Source text: Original source text
  Source audio file: /tmp/voice.wav
`;
    (fs.exists as jest.Mock).mockResolvedValue(true);
    (fs.readFile as jest.Mock).mockResolvedValue(initialMarkdown);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);

    const updated = await ContextManager.updateThought('Inbox', 'note-123', {
      text: 'Edited note',
      sourceMetadata: {
        transcript: 'updated transcript',
        audioFilePath: null,
      },
    });

    expect(updated).toBe(true);
    const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toContain('Edited note');
    expect(writeCall[1]).toContain('Note id: note-123');
    expect(writeCall[1]).toContain('Source transcript: updated transcript');
    expect(writeCall[1]).toContain('Source note id: source-456');
    expect(writeCall[1]).toContain('Source section: Source thread');
    expect(writeCall[1]).toContain('Source text: Original source text');
    expect(writeCall[1]).not.toContain('Source audio file: /tmp/voice.wav');
  });
});
