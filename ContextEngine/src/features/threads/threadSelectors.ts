import type { ContextSection } from '../../modules/ContextManager';
import { ContextManager } from '../../modules/ContextManager';
import type { SourceCaptureView, ThreadDetailsView } from './threadTypes';
import { isAppOwnedCaptureAudioPath } from '../../shared/audio/retainedAudio';

function getDisplaySourceTranscript(thought: ReturnType<typeof ContextManager.getThoughtsFromSection>[number]) {
  const transcript = thought.sourceTranscript?.trim();
  if (!transcript) {
    return undefined;
  }

  const sourceKind = thought.sourceKind ?? thought.sourceMetadata?.kind;
  if (sourceKind === 'text' || sourceKind === 'image') {
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
  const summary = deriveSummary(captures);

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
    let typeLabel: 'VOICE NOTE' | 'TEXT NOTE' | 'PHOTO NOTE' = 'TEXT NOTE';
    let icon: 'mic' | 'document' | 'image' = 'document';

    const sourceKind = thought.sourceKind ?? thought.sourceMetadata?.kind;
    if (sourceKind === 'voice') {
      typeLabel = 'VOICE NOTE';
      icon = 'mic';
    } else if (sourceKind === 'image') {
      typeLabel = 'PHOTO NOTE';
      icon = 'image';
    } else if (sourceKind === 'text') {
      typeLabel = 'TEXT NOTE';
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
      typeLabel = 'PHOTO NOTE';
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
      originalSourceTranscript: thought.sourceTranscript,
      createdAt: thought.createdAt,
      updatedAt: thought.updatedAt,
      icon,
      canDeleteRetainedAudio: isAppOwnedCaptureAudioPath(thought.sourceMetadata?.audioFilePath),
      ...(thought.sourceMetadata
        ? {
            sourceMetadata: {
              audioFilePath: thought.sourceMetadata.audioFilePath ?? null,
              transcriptionError: thought.sourceMetadata.transcriptionError ?? null,
            },
          }
        : {}),
    };
  });
}

function deriveSummary(captures: SourceCaptureView[]): string {
  if (captures.length === 0) return 'No notes yet.';

  const combined = captures.slice(0, 3).map(capture => capture.preview).join(' ');
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
