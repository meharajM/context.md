import type { MeetingTranscriptSegment } from './meetingTypes';

export function extractMeetingHighlights(transcript: MeetingTranscriptSegment[]): string | undefined {
  const seen = new Set<string>();
  const sentences = transcript.flatMap(segment => segment.text.split(/(?<=[.!?])\s+/))
    .map(sentence => sentence.trim())
    .filter(sentence => {
      if (!sentence || /^(?:\[.*\]|\(.*\))$/.test(sentence)) return false;
      const words = sentence.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? [];
      const key = sentence.toLowerCase().replace(/\s+/g, ' ');
      if (words.length < 5 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!sentences.length) return undefined;
  const selected = sentences.length <= 3
    ? sentences
    : [sentences[0], sentences[Math.floor((sentences.length - 1) / 2)], sentences[sentences.length - 1]];
  const highlights = selected.join(' ');
  return highlights.length > 600 ? highlights.slice(0, 597).trimEnd() + '…' : highlights;
}
