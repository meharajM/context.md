import { selectThreadDetailsView } from '../threadSelectors';
import type { ContextSection } from '../../../modules/ContextManager';

describe('selectThreadDetailsView', () => {
  it('returns null if section is not provided', () => {
    expect(selectThreadDetailsView(null, 'test-id')).toBeNull();
    expect(selectThreadDetailsView(undefined, 'test-id')).toBeNull();
  });

  it('maps section title and generates summary and captures correctly', () => {
    const mockSection: ContextSection = {
      header: 'Project Alpha',
      content: `
- [2026-05-26T10:30:00.000Z] Spoke with team about timeline constraints. Let's record voice files.
  Source kind: VOICE
  Source transcript: Raw dictated note about the team timeline constraints.
  Source audio file: /tmp/project-alpha.wav
- [2026-05-26T14:45:00.000Z] Captured an image scan of the whiteboard diagram showing OCR text.
- [2026-05-26T16:00:00.000Z] General project notes captured manually.
      `.trim(),
    };

    const result = selectThreadDetailsView(mockSection, 'project-alpha-0');

    const timeStr0 = new Date('2026-05-26T10:30:00.000Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeStr1 = new Date('2026-05-26T14:45:00.000Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeStr2 = new Date('2026-05-26T16:00:00.000Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    expect(result).not.toBeNull();
    expect(result!.id).toBe('project-alpha-0');
    expect(result!.title).toBe('Project Alpha');
    expect(result!.summary).toContain('Spoke with team about timeline constraints');
    expect(result!.summary).not.toContain('Source transcript');
    
    expect(result!.captures).toHaveLength(3);

    // Heuristics: Spoke/record voice -> VOICE NOTE / mic
    expect(result!.captures[0]).toEqual(expect.objectContaining({
      id: 'project-alpha-0-capture-0',
      noteId: 'project-alpha-0',
      typeLabel: 'VOICE NOTE',
      timestampLabel: expect.stringContaining(timeStr0),
      preview: "Spoke with team about timeline constraints. Let's record voice files.",
      sourceSectionHeader: 'Project Alpha',
      sourceTranscript: 'Raw dictated note about the team timeline constraints.',
      sourceMetadata: expect.objectContaining({ audioFilePath: '/tmp/project-alpha.wav' }),
      canDeleteRetainedAudio: false,
      icon: 'mic',
    }));

    // Heuristics: scan/photo -> PHOTO NOTE / image
    expect(result!.captures[1]).toEqual(expect.objectContaining({
      id: 'project-alpha-0-capture-1',
      noteId: 'project-alpha-1',
      typeLabel: 'PHOTO NOTE',
      timestampLabel: expect.stringContaining(timeStr1),
      preview: 'Captured an image scan of the whiteboard diagram showing OCR text.',
      sourceSectionHeader: 'Project Alpha',
      icon: 'image',
    }));

    // Heuristics: default -> TEXT NOTE / document
    expect(result!.captures[2]).toEqual(expect.objectContaining({
      id: 'project-alpha-0-capture-2',
      noteId: 'project-alpha-2',
      typeLabel: 'TEXT NOTE',
      timestampLabel: expect.stringContaining(timeStr2),
      preview: 'General project notes captured manually.',
      sourceSectionHeader: 'Project Alpha',
      icon: 'document',
    }));
  });

  it('derives summaries and captures from decoded multiline notes', () => {
    const section = {
      header: 'Multiline',
      content: '- [2026-10-24T10:00:00.000Z] <!-- thought-note:v2 {"noteId":"multi-note","createdAt":"2026-10-24T10:00:00.000Z"} -->\n  | First line\n  | \n  | - [2020-01-01] literal bullet\n  | Note id: literal text\n  <!-- /thought-note -->',
    };
    const result = selectThreadDetailsView(section, 'topic:Multiline');
    expect(result?.captures).toHaveLength(1);
    expect(result?.captures[0].noteId).toBe('multi-note');
    expect(result?.captures[0].preview).toBe('First line\n\n- [2020-01-01] literal bullet\nNote id: literal text');
    expect(result?.summary).toBe(result?.captures[0].preview);
    expect(result?.summary).not.toContain('thought-note:v2');
    expect(result?.summary).not.toContain('  | ');
  });

  it('handles missing timestamp and falls back gracefully', () => {
    const mockSection: ContextSection = {
      header: 'Inbox',
      content: `
- Untimestamped notes that do not have a bracketed date.
      `.trim(),
    };

    const result = selectThreadDetailsView(mockSection, 'inbox-1');

    expect(result!.captures).toHaveLength(1);
    expect(result!.captures[0].timestampLabel).toBe('Recent');
    expect(result!.captures[0].preview).toBe('Untimestamped notes that do not have a bracketed date.');
  });

  it('keeps persisted note identity and source section on the capture view', () => {
    const mockSection: ContextSection = {
      header: 'Project Beta',
      content: `
- [2026-05-27T12:00:00.000Z] Persisted capture text.
  Note id: persisted-note-456
  Source note id: source-note-abc
  Source section: Source Thread
  Source transcript: raw captured transcript
      `.trim(),
    };

    const result = selectThreadDetailsView(mockSection, 'thread-view-123');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('thread-view-123');
    expect(result!.captures).toHaveLength(1);
    expect(result!.captures[0]).toEqual(expect.objectContaining({
      id: 'thread-view-123-capture-0',
      noteId: 'persisted-note-456',
      sourceSectionHeader: 'Project Beta',
      sourceNoteId: 'source-note-abc',
      sourceTranscript: 'raw captured transcript',
    }));
  });

  it('does not label text note content as a recording transcript', () => {
    const section: ContextSection = {
      header: 'Inbox',
      content: '- [2026-05-27T12:00:00.000Z] <!-- thought-note:v2 {"noteId":"text-note","sourceMetadata":{"kind":"text","transcript":"The original typed note"}} -->\n  | The original typed note\n  <!-- /thought-note -->',
    };

    const result = selectThreadDetailsView(section, 'inbox-thread');
    expect(result?.captures[0]).toEqual(expect.objectContaining({
      preview: 'The original typed note',
      sourceTranscript: undefined,
      originalSourceTranscript: 'The original typed note',
      typeLabel: 'TEXT NOTE',
    }));
  });

  it('marks only generated retained-audio files as deletable', () => {
    const section: ContextSection = {
      header: 'Inbox',
      content: `
- [2026-05-27T12:00:00.000Z] Voice capture retained
  Note id: retained-note
  Source kind: VOICE
  Source audio file: /mock/path/retained-audio/contextengine-retained-owned.wav
- [2026-05-27T12:10:00.000Z] Imported voice note
  Note id: imported-note
  Source kind: VOICE
  Source audio file: /tmp/user-selected-import.m4a
      `.trim(),
    };

    const result = selectThreadDetailsView(section, 'inbox-thread');

    expect(result?.captures[0].canDeleteRetainedAudio).toBe(true);
    expect(result?.captures[1].canDeleteRetainedAudio).toBe(false);
  });
});
