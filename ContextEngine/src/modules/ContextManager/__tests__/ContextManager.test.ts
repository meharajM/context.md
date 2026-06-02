import fs from 'react-native-fs';

import { ContextManager } from '../index';

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  mkdir: jest.fn(),
  readDir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  moveFile: jest.fn(),
  unlink: jest.fn(),
}));

describe('ContextManager', () => {
  const mockPath = '/mock/topics';

  beforeEach(() => {
    jest.clearAllMocks();
    ContextManager.setPath(mockPath);
    (fs.exists as jest.Mock).mockImplementation(async (path: string) => path === mockPath);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readDir as jest.Mock).mockResolvedValue([]);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns empty sections when the storage directory has no topic files', async () => {
    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
  });

  it('returns empty sections when the path has not been configured', async () => {
    ContextManager.setPath('');

    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
    expect(fs.exists).not.toHaveBeenCalled();
  });

  it('parses topic files into sections', async () => {
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/projects.md', name: 'projects.md', mtime: new Date('2026-06-02T10:00:00.000Z'), isFile: () => true },
      { path: '/mock/topics/ideas.md', name: 'ideas.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path.endsWith('projects.md')) {
        return '# Projects\n\n- Project 1\n';
      }
      return '# Ideas\n\n- Idea 1\n';
    });

    const result = await ContextManager.readContext();

    expect(result).toEqual([
      { header: 'Projects', content: '- Project 1' },
      { header: 'Ideas', content: '- Idea 1' },
    ]);
  });

  it('matches existing sections case-insensitively', async () => {
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/ideas.md', name: 'ideas.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue('# ideas\n\n- Idea 1\n');

    await ContextManager.appendThought('  IDEAS  ', 'New Idea');

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/topics/ideas.md.tmp',
      expect.stringContaining('# ideas'),
      'utf8',
    );
    const writeBody = (fs.writeFile as jest.Mock).mock.calls[0][1];
    expect(writeBody).toContain('# ideas');
    expect(writeBody).toContain('Idea 1');
    expect(writeBody).toContain('New Idea');
    expect(fs.moveFile).toHaveBeenCalledWith('/mock/topics/ideas.md.tmp', '/mock/topics/ideas.md');
  });

  it('normalizes blank topics to Inbox', async () => {
    (fs.exists as jest.Mock).mockImplementation(async (path: string) => path === mockPath);

    await ContextManager.appendThought('   ', 'Fallback note');

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/topics/inbox.md.tmp',
      expect.stringContaining('# Inbox'),
      'utf8',
    );
    expect((fs.writeFile as jest.Mock).mock.calls[0][1]).toContain('Fallback note');
  });

  it('preserves a supplied note id and source metadata during append', async () => {
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

    const writeBody = (fs.writeFile as jest.Mock).mock.calls[0][1];
    expect(writeBody).toContain('Note id: note-123');
    expect(writeBody).toContain('Source kind: VOICE');
    expect(writeBody).toContain('Source transcript: raw transcript');
    expect(writeBody).toContain('Source note id: source-456');
    expect(writeBody).toContain('Source section: Source thread');
    expect(writeBody).toContain('Source text: Original source text');
    expect(writeBody).toContain('Source audio file: /tmp/voice.wav');
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
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/inbox.md', name: 'inbox.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue(`# Inbox

- [2026-05-27T10:00:00.000Z] Raw voice note
  Source kind: VOICE
  Source transcript: original voice transcript
- [2026-05-27T10:05:00.000Z] Keep this note
`);

    const removed = await ContextManager.removeThought('Inbox', 'Raw voice note');

    expect(removed).toBe(true);
    const writeBody = (fs.writeFile as jest.Mock).mock.calls[0][1];
    expect(writeBody).not.toContain('Raw voice note');
    expect(writeBody).not.toContain('original voice transcript');
    expect(writeBody).toContain('Keep this note');
  });

  it('can remove a duplicate Inbox thought by parsed entry id', async () => {
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/inbox.md', name: 'inbox.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue(`# Inbox

- [2026-05-27T10:00:00.000Z] Duplicate note
- [2026-05-27T10:05:00.000Z] Duplicate note
`);

    const removed = await ContextManager.removeThought('Inbox', 'Duplicate note', 'inbox-1');

    expect(removed).toBe(true);
    const writeBody = (fs.writeFile as jest.Mock).mock.calls[0][1];
    expect(writeBody).toContain('[2026-05-27T10:00:00.000Z] Duplicate note');
    expect(writeBody).not.toContain('[2026-05-27T10:05:00.000Z] Duplicate note');
  });

  it('updates a specific thought without losing its note identity or source metadata', async () => {
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/inbox.md', name: 'inbox.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue(`# Inbox

- [2026-05-27T10:00:00.000Z] Raw note
  Note id: note-123
  Created at: 2026-05-27T10:00:00.000Z
  Source kind: VOICE
  Source transcript: original transcript
  Source note id: source-456
  Source section: Source thread
  Source text: Original source text
  Source audio file: /tmp/voice.wav
`);

    const updated = await ContextManager.updateThought('Inbox', 'note-123', {
      text: 'Edited note',
      sourceMetadata: {
        transcript: 'updated transcript',
        audioFilePath: null,
      },
    });

    expect(updated).toBe(true);
    const writeBody = (fs.writeFile as jest.Mock).mock.calls[0][1];
    expect(writeBody).toContain('Edited note');
    expect(writeBody).toContain('Note id: note-123');
    expect(writeBody).toContain('Source transcript: updated transcript');
    expect(writeBody).toContain('Source note id: source-456');
    expect(writeBody).toContain('Source section: Source thread');
    expect(writeBody).toContain('Source text: Original source text');
    expect(writeBody).not.toContain('Source audio file: /tmp/voice.wav');
  });
});
