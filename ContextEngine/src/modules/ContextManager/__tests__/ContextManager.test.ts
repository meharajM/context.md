import { createHash } from 'crypto';

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
  hash: jest.fn(),
}));

describe('ContextManager', () => {
  const mockPath = '/mock/topics';
  let memoryFiles = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    ContextManager.setPath(mockPath);
    (fs.exists as jest.Mock).mockImplementation(async (path: string) => path === mockPath || memoryFiles.has(path));
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readDir as jest.Mock).mockResolvedValue([]);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.moveFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    useMemoryFiles();
  });

  const useMemoryFiles = (files = new Map<string, string>()) => {
    memoryFiles = files;
    (fs.exists as jest.Mock).mockImplementation(async (path: string) => path === mockPath || files.has(path));
    (fs.readDir as jest.Mock).mockImplementation(async () => [...files.keys()]
      .map(path => ({ path, name: path.split('/').pop(), isFile: () => true })));
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => files.get(path) ?? '');
    (fs.writeFile as jest.Mock).mockImplementation(async (path: string, content: string) => { files.set(path, content); });
    (fs.unlink as jest.Mock).mockImplementation(async (path: string) => { files.delete(path); });
    (fs.hash as jest.Mock).mockImplementation(async (path: string) => {
      if (!files.has(path)) throw new Error('File missing');
      return createHash('sha256').update(files.get(path)!).digest('hex');
    });
    (fs.moveFile as jest.Mock).mockImplementation(async (source: string, target: string) => {
      if (!files.has(source)) throw new Error('Source file missing');
      if (files.has(target)) throw new Error('Destination exists');
      files.set(target, files.get(source)!);
      files.delete(source);
    });
    return files;
  };

  it('preserves every capture when multiple notes save at once', async () => {
    useMemoryFiles();
    await Promise.all(Array.from({ length: 12 }, (_, index) =>
      ContextManager.appendThought('Inbox', `Capture ${index}`, { noteId: `capture-${index}` })));
    const notes = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(notes.map(note => note.noteId).sort()).toEqual(
      Array.from({ length: 12 }, (_, index) => `capture-${index}`).sort(),
    );
  });

  it('keeps a new capture when source cleanup runs at the same time', async () => {
    useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Old capture', { noteId: 'old' });
    await Promise.all([
      ContextManager.removeThought('Inbox', 'Old capture', 'old'),
      ContextManager.appendThought('Inbox', 'New capture', { noteId: 'new' }),
    ]);
    const notes = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(notes.map(note => note.noteId)).toEqual(['new']);
  });

  it('does not duplicate an already categorized note when source cleanup is retried', async () => {
    useMemoryFiles();
    await ContextManager.appendThought('Work', 'Send invoice', { noteId: 'stable-id' });
    await ContextManager.appendThought('Work', 'Send invoice', { noteId: 'stable-id' });
    const sections = await ContextManager.readContext();
    expect(ContextManager.getThoughtsFromSection(sections[0])).toHaveLength(1);
  });

  it('exports a versioned backup without device-specific audio paths', async () => {
    useMemoryFiles();
    await ContextManager.appendThought('Voice notes', 'Call the clinic', {
      noteId: 'clinic-call',
      createdAt: '2026-06-01T10:00:00.000Z',
      sourceMetadata: {
        kind: 'voice',
        transcript: 'Call the clinic tomorrow',
        audioFilePath: '/private/retained-audio/recording.wav',
        transcriptionError: 'decoder stopped early',
      },
    });

    const backup = JSON.parse(await ContextManager.createBackup());
    expect(backup).toMatchObject({
      format: 'thought-notes-backup',
      version: 1,
      topics: [{
        header: 'Voice notes',
        notes: [{
          noteId: 'clinic-call',
          text: 'Call the clinic',
          createdAt: '2026-06-01T10:00:00.000Z',
          sourceMetadata: { kind: 'voice', transcript: 'Call the clinic tomorrow', transcriptionError: 'decoder stopped early' },
        }],
      }],
    });
    expect(JSON.stringify(backup)).not.toContain('recording.wav');
  });

  it('restores additively and safely skips duplicate backup notes on retry', async () => {
    useMemoryFiles();
    await ContextManager.appendThought('Work', 'Keep the local version', { noteId: 'shared-id' });
    const backup = JSON.stringify({
      format: 'thought-notes-backup',
      version: 1,
      exportedAt: '2026-06-01T12:00:00.000Z',
      topics: [{
        header: 'Work',
        notes: [{ noteId: 'shared-id', text: 'Keep the archived version', createdAt: '2026-05-01T12:00:00.000Z' }],
      }],
    });

    expect(await ContextManager.mergeBackup(backup)).toEqual({ added: 1, skipped: 0 });
    expect(await ContextManager.mergeBackup(backup)).toEqual({ added: 0, skipped: 1 });
    const notes = ContextManager.getThoughtsFromSection((await ContextManager.readContext())[0]);
    expect(notes.map(note => note.text)).toEqual(['Keep the local version', 'Keep the archived version']);
  });

  it('rejects unsupported or malformed backups before writing notes', async () => {
    const files = useMemoryFiles();
    expect(() => ContextManager.mergeBackup(JSON.stringify({
      format: 'thought-notes-backup',
      version: 2,
      topics: [],
    }))).toThrow('not a supported Thought Notes backup');
    expect(files.size).toBe(0);
  });

  it('fails backup export when the local topic store cannot be read', async () => {
    (fs.readDir as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(ContextManager.createBackup()).rejects.toThrow('storage unavailable');
  });

  it('does not commit stale synthesis over a newer persisted Inbox edit', async () => {
    useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Edit B', { noteId: 'revision-note' });
    await ContextManager.updateThought('Inbox', 'revision-note', { text: 'Edit C' });

    const committed = await ContextManager.commitSynthesisResult(
      { sectionHeader: 'Inbox', thoughtText: 'Edit B', noteId: 'revision-note' },
      'Work',
      'Refined Edit B',
      { noteId: 'revision-note', sourceTranscript: 'Edit B' },
    );

    expect(committed).toBe(false);
    const sections = await ContextManager.readContext();
    expect(ContextManager.getInboxThoughts(sections).map(note => note.text)).toEqual(['Edit C']);
    expect(sections.some(section => section.header === 'Work')).toBe(false);
  });

  it('updates a note in its new section when an editor save queues behind a cross-topic synthesis commit', async () => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Edit B', { noteId: 'editor-race-note' });

    let releaseTargetWrite!: () => void;
    let targetWriteStarted!: () => void;
    const targetWriteGate = new Promise<void>(resolve => { releaseTargetWrite = resolve; });
    const targetWriteStartedGate = new Promise<void>(resolve => { targetWriteStarted = resolve; });
    (fs.writeFile as jest.Mock).mockImplementation(async (path: string, content: string) => {
      if (path.endsWith('/work.md.tmp')) {
        targetWriteStarted();
        await targetWriteGate;
      }
      files.set(path, content);
    });

    const synthesisCommit = ContextManager.commitSynthesisResult(
      { sectionHeader: 'Inbox', thoughtText: 'Edit B', noteId: 'editor-race-note' },
      'Work',
      'Synthesized edit B',
      { noteId: 'editor-race-note', sourceTranscript: 'Edit B' },
    );
    await targetWriteStartedGate;

    const editorSave = ContextManager.updateThoughtAndResolveSection('Inbox', 'editor-race-note', {
      text: 'Edited while synthesis was moving the note',
    });
    releaseTargetWrite();

    await expect(synthesisCommit).resolves.toBe(true);
    await expect(editorSave).resolves.toBe('Work');

    const sections = await ContextManager.readContext();
    expect(ContextManager.getInboxThoughts(sections)).toHaveLength(0);
    const workSection = sections.find(section => section.header === 'Work');
    expect(ContextManager.getThoughtsFromSection(workSection!).map(note => [note.noteId, note.text])).toEqual([
      ['editor-race-note', 'Edited while synthesis was moving the note'],
    ]);
  });

  it('updates an existing note in place when edited text synthesizes back to its current topic', async () => {
    useMemoryFiles();
    await ContextManager.appendThought('Work', 'Edit B', { noteId: 'same-topic-note' });
    await ContextManager.updateThought('Work', 'same-topic-note', { text: 'Edit C' });

    const committed = await ContextManager.commitSynthesisResult(
      { sectionHeader: 'Work', thoughtText: 'Edit C', noteId: 'same-topic-note' },
      'Work',
      'Refined Edit C',
      { noteId: 'same-topic-note', sourceTranscript: 'Edit C' },
    );

    expect(committed).toBe(true);
    const sections = await ContextManager.readContext();
    const workSection = sections.find(section => section.header === 'Work');
    expect(workSection).toBeDefined();
    expect(ContextManager.getThoughtsFromSection(workSection!).map(note => [note.noteId, note.text])).toEqual([
      ['same-topic-note', 'Refined Edit C'],
    ]);
  });

  it('returns empty sections when the storage directory has no topic files', async () => {
    const result = await ContextManager.readContext();

    expect(result).toEqual([]);
  });

  it('migrates a legacy context.md into per-topic files before reading', async () => {
    const legacyPath = '/mock/context.md';
    ContextManager.setPath(mockPath, { legacyPath });
    (fs.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === mockPath || path === legacyPath || memoryFiles.has(path),
    );
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path === legacyPath) {
        return '# Context\n\n## Inbox\n- Legacy note\n\n## Ideas\n- Legacy idea\n';
      }
      return memoryFiles.get(path) ?? '';
    });

    await ContextManager.readContext();

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/topics/inbox.md.tmp',
      expect.stringContaining('# Inbox\n\n- Legacy note'),
      'utf8',
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/topics/ideas.md.tmp',
      expect.stringContaining('# Ideas\n\n- Legacy idea'),
      'utf8',
    );
    expect(fs.unlink).toHaveBeenCalledWith(legacyPath);
  });

  it('preserves a divergent legacy section separately when topic files already exist', async () => {
    const legacyPath = '/mock/context.md';
    ContextManager.setPath(mockPath, { legacyPath });
    (fs.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === mockPath || path === legacyPath || path === '/mock/topics/inbox.md' || memoryFiles.has(path),
    );
    (fs.readDir as jest.Mock).mockResolvedValue([
      {
        path: '/mock/topics/inbox.md',
        name: 'inbox.md',
        mtime: new Date('2026-06-02T10:00:00.000Z'),
        isFile: () => true,
      },
    ]);
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path === legacyPath) {
        return '# Context\n\n## Inbox\n- Legacy-only note\n';
      }
      if (path === '/mock/topics/inbox.md') {
        return '# Inbox\n\n- New-layout note\n';
      }
      return memoryFiles.get(path) ?? '';
    });

    await ContextManager.readContext();

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/mock/topics/legacy-inbox.md.tmp',
      expect.stringContaining('# Legacy Inbox\n\n- Legacy-only note'),
      'utf8',
    );
    expect(fs.unlink).toHaveBeenCalledWith(legacyPath);
  });

  it('does not duplicate legacy content that already exists in a topic file', async () => {
    const legacyPath = '/mock/context.md';
    ContextManager.setPath(mockPath, { legacyPath });
    (fs.exists as jest.Mock).mockImplementation(async (path: string) =>
      path === mockPath || path === legacyPath || path === '/mock/topics/inbox.md' || memoryFiles.has(path),
    );
    (fs.readDir as jest.Mock).mockResolvedValue([
      {
        path: '/mock/topics/inbox.md',
        name: 'inbox.md',
        mtime: new Date('2026-06-02T10:00:00.000Z'),
        isFile: () => true,
      },
    ]);
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path === legacyPath) {
        return '# Context\n\n## Inbox\n- Legacy note\n';
      }
      if (path === '/mock/topics/inbox.md') {
        return '# Inbox\n\n- Legacy note\n- New-layout note\n';
      }
      return memoryFiles.get(path) ?? '';
    });

    await ContextManager.readContext();

    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledWith(legacyPath);
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
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => memoryFiles.get(path) ?? '# ideas\n\n- Idea 1\n');

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
    (fs.exists as jest.Mock).mockImplementation(async (path: string) => path === mockPath || memoryFiles.has(path));

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
    expect(writeBody).toContain('"noteId":"note-123"');
    expect(writeBody).toContain('"kind":"voice"');
    expect(writeBody).toContain('"transcript":"raw transcript"');
    expect(writeBody).toContain('"noteId":"source-456"');
    expect(writeBody).toContain('"sectionHeader":"Source thread"');
    expect(writeBody).toContain('"text":"Original source text"');
    expect(writeBody).toContain('"audioFilePath":"/tmp/voice.wav"');
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

  it('preserves metadata-looking lines inside a legacy note body', async () => {
    const thoughts = ContextManager.getInboxThoughts([{
      header: 'Inbox',
      content: '- [2026-05-27T10:00:00.000Z] Legacy note\n' +
        '  Source transcript: literal body line\n' +
        'continued body\n' +
        '\tNote id: legacy-note-id\n' +
        ' Source kind: VOICE\n',
    }]);

    expect(thoughts).toEqual([expect.objectContaining({
      noteId: 'legacy-note-id',
      text: 'Legacy note\n  Source transcript: literal body line\ncontinued body',
      sourceKind: 'voice',
      sourceTranscript: undefined,
    })]);
  });

  it('removes a single matching thought and its source metadata', async () => {
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/inbox.md', name: 'inbox.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => memoryFiles.get(path) ?? `# Inbox

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
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => memoryFiles.get(path) ?? `# Inbox

- [2026-05-27T10:00:00.000Z] Duplicate note
- [2026-05-27T10:05:00.000Z] Duplicate note
`);

    const removed = await ContextManager.removeThought('Inbox', 'Duplicate note', 'inbox-1');

    expect(removed).toBe(true);
    const writeBody = (fs.writeFile as jest.Mock).mock.calls[0][1];
    expect(writeBody).toContain('[2026-05-27T10:00:00.000Z]');
    expect(writeBody).toContain('  | Duplicate note');
    expect(writeBody).not.toContain('[2026-05-27T10:05:00.000Z]');
  });

  it('updates a specific thought without losing its note identity or source metadata', async () => {
    (fs.readDir as jest.Mock).mockResolvedValue([
      { path: '/mock/topics/inbox.md', name: 'inbox.md', mtime: new Date('2026-06-01T10:00:00.000Z'), isFile: () => true },
    ]);
    (fs.readFile as jest.Mock).mockImplementation(async (path: string) => memoryFiles.get(path) ?? `# Inbox

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
    expect(writeBody).toContain('"noteId":"note-123"');
    expect(writeBody).toContain('"transcript":"updated transcript"');
    expect(writeBody).toContain('"noteId":"source-456"');
    expect(writeBody).toContain('"sectionHeader":"Source thread"');
    expect(writeBody).toContain('"text":"Original source text"');
    expect(writeBody).toContain('"audioFilePath":null');
  });
  it('round-trips all body lines and source text through edit, synthesis, export and restore', async () => {
    const files = useMemoryFiles();
    const text = '\n  Leading spaces\n\n- embedded bullet\n  Note id: body-id\nSource transcript: body text\n# body heading\n  <!-- /thought-note -->\nlast line  \n\n';
    const transcript = 'first transcript line\n\n- transcript bullet\n  Note id: not-metadata\n';
    const sourceText = 'original\n\nSource kind: IMAGE\n';
    await ContextManager.appendThought('Inbox', text, {
      noteId: 'multiline', createdAt: '2026-10-24T10:00:00.000Z',
      sourceMetadata: { kind: 'voice', transcript, text: sourceText, noteId: 'original-id' },
    });
    let notes = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ noteId: 'multiline', text,
      sourceMetadata: { transcript, text: sourceText, noteId: 'original-id' } });

    const edited = `${text}edited\n\n- final bullet\n`;
    await ContextManager.updateThought('Inbox', 'multiline', { text: edited });
    notes = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(notes[0].text).toBe(edited);
    expect(await ContextManager.commitSynthesisResult(
      { sectionHeader: 'Inbox', thoughtText: edited, noteId: 'multiline' }, 'Work', edited,
      { noteId: 'multiline', sourceMetadata: notes[0].sourceMetadata },
    )).toBe(true);
    const backup = await ContextManager.createBackup();
    const exported = JSON.parse(backup).topics[0].notes[0];
    expect(exported).toMatchObject({ noteId: 'multiline', text: edited,
      sourceMetadata: { transcript, text: sourceText } });
    files.clear();
    expect(await ContextManager.mergeBackup(backup)).toEqual({ added: 1, skipped: 0 });
    expect(await ContextManager.mergeBackup(backup)).toEqual({ added: 0, skipped: 1 });
    const restored = ContextManager.getThoughtsFromSection((await ContextManager.readContext())[0]);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ noteId: 'multiline', text: edited,
      sourceMetadata: { transcript, text: sourceText } });
  });

  it('keeps legacy continuation lines, metadata and remaining note identity when removing a sibling', async () => {
    const files = useMemoryFiles();
    files.set(`${mockPath}/inbox.md`, '# Inbox\n\n- First\n  Note id: first-id\n- Second\ncontinuation\n\nNote id: ordinary body line\n  Source transcript: legacy transcript\n');
    const before = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(before[1]).toMatchObject({ noteId: 'inbox-1', text: 'Second\ncontinuation\n\nNote id: ordinary body line',
      sourceTranscript: 'legacy transcript' });
    await ContextManager.removeThought('Inbox', 'First', 'first-id');
    const after = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ noteId: 'inbox-1', text: before[1].text,
      sourceTranscript: 'legacy transcript' });
    expect(await ContextManager.updateThought('Inbox', 'inbox-0', { text: 'wrong identity' })).toBe(false);
  });

  it.each(['header', 'noteId', 'createdAt', 'sourceNoteId', 'sourceTopic'])('rejects multiline backup %s before any write', field => {
    const files = useMemoryFiles();
    const topic = { header: 'Work', notes: [{ noteId: 'id', text: 'valid\nbody', createdAt: 'time',
      sourceMetadata: { noteId: 'source', sectionHeader: 'Inbox' } }] };
    if (field === 'header') topic.header = 'Work\n# injected';
    if (field === 'noteId') topic.notes[0].noteId = 'id\ninjected';
    if (field === 'createdAt') topic.notes[0].createdAt = 'time\ninjected';
    if (field === 'sourceNoteId') topic.notes[0].sourceMetadata.noteId = 'source\ninjected';
    if (field === 'sourceTopic') topic.notes[0].sourceMetadata.sectionHeader = 'Inbox\ninjected';
    expect(() => ContextManager.mergeBackup(JSON.stringify({ format: 'thought-notes-backup', version: 1, topics: [topic] })))
      .toThrow('invalid');
    expect(files.size).toBe(0);
  });

  const saveCuts = [
    ['writeFile', '/inbox.md.tmp', false], ['writeFile', '/inbox.md.tmp', true],
    ['writeFile', '/inbox.md.ready', false], ['writeFile', '/inbox.md.ready', true],
    ['moveFile', '/inbox.md', false], ['moveFile', '/inbox.md', true],
    ['moveFile', '/inbox.md.tmp', false], ['moveFile', '/inbox.md.tmp', true],
    ['unlink', '/inbox.md.ready', false], ['unlink', '/inbox.md.ready', true],
    ['unlink', '/inbox.md.bak', false], ['unlink', '/inbox.md.bak', true],
  ] as const;
  it.each(saveCuts)('recovers save cut at %s %s (after=%s) without losing the previous note', async (operation, suffix, after) => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Original good capture', { noteId: 'original' });
    const mock = fs[operation] as jest.Mock;
    const implementation = mock.getMockImplementation()!;
    let cut = false;
    mock.mockImplementation(async (...args: unknown[]) => {
      if (!cut && typeof args[0] === 'string' && args[0].endsWith(suffix)) {
        cut = true;
        if (after) await implementation(...args);
        throw new Error('simulated process interruption');
      }
      return implementation(...args);
    });
    let failed = false;
    try {
      await ContextManager.appendThought('Inbox', 'New capture', { noteId: 'new' });
    } catch {
      failed = true;
    }
    expect(cut).toBe(true);
    // Even before recovery, the previous known-good note has a complete disk copy.
    expect([...files.entries()].filter(([path]) => /\.md(?:\.bak)?$/.test(path))
      .some(([, value]) => value.includes('Original good capture'))).toBe(true);
    if (operation !== 'unlink' || suffix.endsWith('.ready')) expect(failed).toBe(true);

    useMemoryFiles(files);
    ContextManager.setPath(mockPath);
    const recovered = ContextManager.getInboxThoughts(await ContextManager.readContext());
    expect(recovered.some(note => note.noteId === 'original' && note.text === 'Original good capture')).toBe(true);
    const completedStage = operation === 'moveFile' || operation === 'unlink' || (suffix.endsWith('.ready') && after);
    expect(recovered.some(note => note.noteId === 'new')).toBe(completedStage);
    // Retrying the same stable capture completes exactly once at every cut.
    await ContextManager.appendThought('Inbox', 'New capture', { noteId: 'new' });
    expect(ContextManager.getInboxThoughts(await ContextManager.readContext()).map(note => note.noteId)).toEqual(['original', 'new']);
  });

  it.each(['partial-temp', 'partial-marker', 'mismatched-temp'])('never promotes %s on relaunch', async state => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Known good', { noteId: 'good' });
    const original = files.get(`${mockPath}/inbox.md`)!;
    const candidate = original.replace('Known good', 'Unverified replacement');
    files.set(`${mockPath}/inbox.md.tmp`, candidate.slice(0, -12));
    if (state === 'partial-marker') files.set(`${mockPath}/inbox.md.ready`, '{"version":1,');
    if (state === 'mismatched-temp') {
      files.set(`${mockPath}/inbox.md.ready`, JSON.stringify({ version: 1, sha256: createHash('sha256').update(candidate).digest('hex') }));
      files.set(`${mockPath}/inbox.md.bak`, original);
      files.delete(`${mockPath}/inbox.md`);
    }
    ContextManager.setPath(mockPath);
    expect(ContextManager.getInboxThoughts(await ContextManager.readContext()).map(note => note.text)).toEqual(['Known good']);
    expect([...files.keys()]).toEqual([`${mockPath}/inbox.md`]);
  });

  it('recovers a partially copied final from the completed stage while retaining the previous backup', async () => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Known good', { noteId: 'good' });
    const move = (fs.moveFile as jest.Mock).getMockImplementation()!;
    (fs.moveFile as jest.Mock).mockImplementation(async (source: string, target: string) => {
      if (source.endsWith('.tmp')) {
        files.set(target, files.get(source)!.slice(0, 20));
        throw new Error('partial native copy');
      }
      return move(source, target);
    });
    await expect(ContextManager.appendThought('Inbox', 'New good', { noteId: 'new' })).rejects.toThrow('partial native copy');
    expect(files.get(`${mockPath}/inbox.md.bak`)).toContain('Known good');
    useMemoryFiles(files);
    expect(ContextManager.getInboxThoughts(await ContextManager.readContext()).map(note => note.text)).toEqual(['Known good', 'New good']);
  });

  it('shows the previous topic after a recovery rename fails and keeps the staged save for retry', async () => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Previous good note', { noteId: 'previous-good' });
    const finalPath = `${mockPath}/inbox.md`;
    const backupPath = `${finalPath}.bak`;
    const stagePath = `${finalPath}.tmp`;
    const readyPath = `${finalPath}.ready`;
    const previous = files.get(finalPath)!;
    const completedStage = '# Inbox\n\n- [2026-10-25T00:00:00.000Z] <!-- thought-note:v2 {"noteId":"new","createdAt":"2026-10-25T00:00:00.000Z"} -->\n  | New note\n  <!-- /thought-note -->\n';
    files.delete(finalPath);
    files.set(backupPath, previous);
    files.set(stagePath, completedStage);
    files.set(readyPath, JSON.stringify({
      version: 1,
      sha256: createHash('sha256').update(completedStage).digest('hex'),
    }));
    (fs.moveFile as jest.Mock).mockRejectedValueOnce(new Error('rename unavailable'));

    const notes = ContextManager.getInboxThoughts(await ContextManager.readContext());

    expect(notes.map(note => [note.noteId, note.text])).toEqual([['previous-good', 'Previous good note']]);
    expect(files.get(stagePath)).toBe(completedStage);
    expect(files.has(readyPath)).toBe(true);
    expect(files.get(backupPath)).toBe(previous);
    (fs.moveFile as jest.Mock).mockRejectedValue(new Error('rename unavailable'));
    await expect(ContextManager.createBackup()).rejects.toThrow('rename unavailable');
  });

  it('rejects a partial staged write and keeps the original without direct overwrite fallback', async () => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Inbox', 'Known good', { noteId: 'good' });
    const original = files.get(`${mockPath}/inbox.md`);
    (fs.writeFile as jest.Mock).mockImplementation(async (path: string, content: string) => {
      files.set(path, content.slice(0, 10));
    });
    await expect(ContextManager.appendThought('Inbox', 'New capture', { noteId: 'new' })).rejects.toThrow('staged topic');
    expect(files.get(`${mockPath}/inbox.md`)).toBe(original);
    expect(files.has(`${mockPath}/inbox.md.ready`)).toBe(false);
    useMemoryFiles(files);
    expect(ContextManager.getInboxThoughts(await ContextManager.readContext()).map(note => note.noteId)).toEqual(['good']);
  });

  it('retries backup restore after an interrupted replacement without duplicates or lost local content', async () => {
    const files = useMemoryFiles();
    await ContextManager.appendThought('Work', 'Existing local note', { noteId: 'local' });
    const backup = JSON.stringify({ format: 'thought-notes-backup', version: 1, topics: [
      { header: 'Work', notes: [{ noteId: 'restored-work', text: 'Restored\n\n- work' }] },
      { header: 'Ideas', notes: [{ noteId: 'restored-idea', text: 'Restored idea' }] },
    ] });
    const move = (fs.moveFile as jest.Mock).getMockImplementation()!;
    (fs.moveFile as jest.Mock).mockImplementation(async (source: string, target: string) => {
      if (source.endsWith('/work.md.tmp')) throw new Error('interrupted restore');
      return move(source, target);
    });
    await expect(ContextManager.mergeBackup(backup)).rejects.toThrow('Retry the same backup');
    expect(files.get(`${mockPath}/work.md.bak`)).toContain('Existing local note');
    useMemoryFiles(files);
    ContextManager.setPath(mockPath);
    expect(await ContextManager.mergeBackup(backup)).toEqual({ added: 1, skipped: 1 });
    expect(await ContextManager.mergeBackup(backup)).toEqual({ added: 0, skipped: 2 });
    const sections = await ContextManager.readContext();
    const notes = sections.flatMap(section => ContextManager.getThoughtsFromSection(section));
    expect(notes.map(note => note.noteId).sort()).toEqual(['local', 'restored-idea', 'restored-work']);
    expect(notes.find(note => note.noteId === 'restored-work')!.text).toBe('Restored\n\n- work');
  });

});
