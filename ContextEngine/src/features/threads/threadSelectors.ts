import type { ContextSection } from '../../modules/ContextManager';
import type { SourceCaptureView, ThreadDetailsView } from './threadTypes';

export function selectThreadDetailsView(
  section: ContextSection | null | undefined,
  threadId: string
): ThreadDetailsView | null {
  if (!section) {
    return null;
  }

  const captures = parseCaptures(section.content, threadId);
  const summary = deriveSummary(section.content);

  return {
    id: threadId,
    title: section.header,
    summary,
    captures,
  };
}

function parseCaptures(content: string, threadId: string): SourceCaptureView[] {
  const lines = content.split('\n');
  const captures: SourceCaptureView[] = [];
  let index = 0;
  let currentCapture: SourceCaptureView | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (!trimmed.startsWith('-') && currentCapture) {
      const sourceKindMatch = trimmed.match(/^Source kind:\s*(.+)$/i);
      const sourceTranscriptMatch = trimmed.match(/^Source transcript:\s*(.+)$/i);

      if (sourceKindMatch) {
        const sourceKind = sourceKindMatch[1].trim().toLowerCase();
        if (sourceKind === 'voice') {
          currentCapture.typeLabel = 'VOICE NOTE';
          currentCapture.icon = 'mic';
        } else if (sourceKind === 'image') {
          currentCapture.typeLabel = 'IMAGE OCR';
          currentCapture.icon = 'image';
        } else if (sourceKind === 'text') {
          currentCapture.typeLabel = 'TEXT ENTRY';
          currentCapture.icon = 'document';
        }
      }

      if (sourceTranscriptMatch) {
        currentCapture.sourceTranscript = sourceTranscriptMatch[1].trim();
      }

      continue;
    }

    // Check if it's a bullet item
    let bulletText = trimmed;
    if (trimmed.startsWith('-')) {
      bulletText = trimmed.substring(1).trim();
    } else {
      // If it doesn't start with a bullet, skip or treat as text
      continue;
    }

    // Try to parse timestamp: [YYYY-MM-DDTHH:MM:SSZ] Text
    const timestampMatch = bulletText.match(/^\[([^\]]+)\]\s*(.*)$/);
    let timestampStr: string | null = null;
    let text = bulletText;

    if (timestampMatch) {
      timestampStr = timestampMatch[1];
      text = timestampMatch[2].trim();
    }

    if (!text) {
      continue;
    }

    // Heuristics for typeLabel and icon
    let typeLabel: 'VOICE NOTE' | 'TEXT ENTRY' | 'IMAGE OCR' = 'TEXT ENTRY';
    let icon: 'mic' | 'document' | 'image' = 'document';

    const textLower = text.toLowerCase();
    if (
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

    const timestampLabel = formatCaptureTime(timestampStr);

    currentCapture = {
      id: `${threadId}-capture-${index}`,
      typeLabel,
      timestampLabel,
      preview: text,
      icon,
    };

    captures.push(currentCapture);

    index++;
  }

  // Show newest captures first in the timeline (or reverse if desired, timeline usually chronologically descending/ascending)
  // The plan mock usually shows them in chronological sequence or reverse. Let's keep them in the parsed order.
  return captures;
}

function deriveSummary(content: string): string {
  const notes = content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^Source (kind|transcript):/i.test(trimmed)) return '';
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
