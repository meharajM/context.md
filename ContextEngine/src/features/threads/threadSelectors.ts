import type { ContextSection } from '../../modules/ContextManager';
import { ContextManager } from '../../modules/ContextManager';
import type { SourceCaptureView, ThreadDetailsView } from './threadTypes';
import { isAppOwnedRetainedAudioPath } from '../../shared/audio/retainedAudio';

function getDisplaySourceTranscript(thought: ReturnType<typeof ContextManager.getThoughtsFromSection>[number]) {
  const transcript = thought.sourceTranscript?.trim();
  if (!transcript) {
    return undefined;
  }

  if (thought.sourceMetadata?.audioFilePath && transcript.toLowerCase() === 'voice capture retained') {
    return undefined;
  }

  return transcript;
}

export function selectThreadDetailsView(
  section: ContextSection | null | undefined,
  threadId: string
): ThreadDetailsView | null {
  if (!section) {
    return null;
  }

  const captures = parseCaptures(section.content, section.header, threadId);
  const summary = deriveSummary(section.content);

  return {
    id: threadId,
    title: section.header,
    summary,
    captures,
  };
}

function parseCaptures(content: string, sectionHeader: string, threadId: string): SourceCaptureView[] {
  return ContextManager.getThoughtsFromSection({
    header: sectionHeader,
    content,
  }).map((thought, index) => {
    const textLower = thought.text.toLowerCase();
    const displaySourceTranscript = getDisplaySourceTranscript(thought);
    let typeLabel: 'VOICE NOTE' | 'TEXT ENTRY' | 'IMAGE OCR' = 'TEXT ENTRY';
    let icon: 'mic' | 'document' | 'image' = 'document';

    const sourceKind = thought.sourceKind ?? thought.sourceMetadata?.kind;
    if (sourceKind === 'voice') {
      typeLabel = 'VOICE NOTE';
      icon = 'mic';
    } else if (sourceKind === 'image') {
      typeLabel = 'IMAGE OCR';
      icon = 'image';
    } else if (sourceKind === 'text') {
      typeLabel = 'TEXT ENTRY';
      icon = 'document';
    } else if (
      textLower.includes('voice') ||
      textLower.includes('audio') ||
      textLower.includes('record') ||
      textLower.includes('spoke') ||
      textLower.includes('listen')
    ) {
      typeLabel = 'VOICE NOTE';
      icon = 'mic';
    } else if (
      textLower.includes('ocr') ||
      textLower.includes('image') ||
      textLower.includes('photo') ||
      textLower.includes('screenshot') ||
      textLower.includes('scan') ||
      textLower.includes('picture')
    ) {
      typeLabel = 'IMAGE OCR';
      icon = 'image';
    }

    return {
      id: `${threadId}-capture-${index}`,
      noteId: thought.noteId,
      typeLabel,
      timestampLabel: formatCaptureTime(thought.createdAt ?? thought.updatedAt ?? null),
      preview: thought.text,
      sourceSectionHeader: thought.sectionHeader,
      sourceNoteId: thought.sourceMetadata?.noteId,
      sourceTranscript: displaySourceTranscript,
      createdAt: thought.createdAt,
      updatedAt: thought.updatedAt,
      icon,
      canDeleteRetainedAudio: isAppOwnedRetainedAudioPath(thought.sourceMetadata?.audioFilePath),
      ...(thought.sourceMetadata
        ? {
            sourceMetadata: {
              audioFilePath: thought.sourceMetadata.audioFilePath ?? null,
            },
          }
        : {}),
    };
  });
}

function deriveSummary(content: string): string {
  const notes = content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^(Note id|Created at|Updated at|Source (kind|transcript|note id|section|text|audio file)):/i.test(trimmed)) return '';
      let bulletText = trimmed;
      if (trimmed.startsWith('-')) {
        bulletText = trimmed.substring(1).trim();
      }
      const timestampMatch = bulletText.match(/^\[([^\]]+)\]\s*(.*)$/);
      return timestampMatch ? timestampMatch[2].trim() : bulletText;
    })
    .filter(Boolean);

  if (notes.length === 0) {
    return 'No executive summary available.';
  }

  // Combine first 2-3 notes into a summary paragraph
  const combined = notes.slice(0, 3).join(' ');
  return combined.length > 250 ? `${combined.slice(0, 250).trimEnd()}…` : combined;
}

function formatCaptureTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Recent';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (sameDay) {
    return `Today, ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  if (wasYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}
