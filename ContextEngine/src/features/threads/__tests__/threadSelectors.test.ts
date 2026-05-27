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
    expect(result!.captures[0]).toEqual({
      id: 'project-alpha-0-capture-0',
      typeLabel: 'VOICE NOTE',
      timestampLabel: expect.stringContaining(timeStr0),
      preview: "Spoke with team about timeline constraints. Let's record voice files.",
      sourceTranscript: 'Raw dictated note about the team timeline constraints.',
      icon: 'mic',
    });

    // Heuristics: scan/OCR -> IMAGE OCR / image
    expect(result!.captures[1]).toEqual({
      id: 'project-alpha-0-capture-1',
      typeLabel: 'IMAGE OCR',
      timestampLabel: expect.stringContaining(timeStr1),
      preview: 'Captured an image scan of the whiteboard diagram showing OCR text.',
      icon: 'image',
    });

    // Heuristics: default -> TEXT ENTRY / document
    expect(result!.captures[2]).toEqual({
      id: 'project-alpha-0-capture-2',
      typeLabel: 'TEXT ENTRY',
      timestampLabel: expect.stringContaining(timeStr2),
      preview: 'General project notes captured manually.',
      icon: 'document',
    });
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
});
