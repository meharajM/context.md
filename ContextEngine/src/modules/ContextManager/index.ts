import fs from 'react-native-fs';

import {
  createNoteId,
  normalizeNoteSourceKind,
  type NoteSourceKind,
  type NoteSourceMetadata,
} from '../../shared/notes/noteTypes';

/**
 * ContextManager Module
 * Responsible for all operations on the master context.md file.
 */

export interface ContextSection {
  header: string;
  content: string;
}

export interface ContextThought {
  noteId: string;
  id: string;
  sectionHeader: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
  sourceMetadata?: NoteSourceMetadata;
  sourceKind?: AppendThoughtOptions['sourceKind'];
  sourceTranscript?: string;
}

export interface AppendThoughtOptions {
  noteId?: string;
  createdAt?: string;
  updatedAt?: string;
  sourceMetadata?: NoteSourceMetadata;
  sourceKind?: NoteSourceKind;
  sourceTranscript?: string;
}

interface ThoughtEntry {
  rawLines: string[];
  noteId: string | null;
  text: string;
  createdAt?: string;
  updatedAt?: string;
  sourceMetadata?: NoteSourceMetadata;
}

const DEFAULT_TOPIC = 'Inbox';

export class ContextManager {
  private static masterFilePath = '';

  static setPath(path: string) {
    this.masterFilePath = path.trim();
  }

  /**
   * Reads the entire context file and parses it into sections.
   */
  static async readContext(): Promise<ContextSection[]> {
    try {
      if (!this.masterFilePath) return [];

      const exists = await fs.exists(this.masterFilePath);
      if (!exists) return [];

      const content = await fs.readFile(this.masterFilePath, 'utf8');
      return this.parseMarkdown(content);
    } catch (error) {
      console.error('Failed to read context file:', error);
      return [];
    }
  }

  /**
   * Appends a thought to a specific section or creates a new one.
   */
  static async appendThought(header: string, thought: string, options: AppendThoughtOptions = {}): Promise<void> {
    if (!thought.trim()) return;

    const normalizedHeader = this.normalizeHeader(header);
    console.log(`[ContextManager] Appending to ${normalizedHeader}: ${thought}`);

    const sections = await this.readContext();
    const sectionIndex = sections.findIndex(section => this.matchesHeader(section.header, normalizedHeader));

    const timestamp = new Date().toISOString();
    const noteId = options.noteId?.trim() || createNoteId();
    const createdAt = options.createdAt?.trim() || timestamp;
    const updatedAt = options.updatedAt?.trim() || timestamp;
    const sourceMetadata = this.normalizeSourceMetadata({
      ...options.sourceMetadata,
      kind: options.sourceKind ?? options.sourceMetadata?.kind,
      transcript: options.sourceTranscript ?? options.sourceMetadata?.transcript,
      noteId: options.sourceMetadata?.noteId,
    });

    const formattedThought = this.serializeThoughtEntry({
      noteId,
      text: thought.trim(),
      createdAt,
      updatedAt,
      sourceMetadata,
      rawLines: [],
      noteIdFallback: noteId,
    });

    if (sectionIndex !== -1) {
      sections[sectionIndex].content += formattedThought;
    } else {
      sections.push({
        header: normalizedHeader,
        content: formattedThought
      });
    }

    await this.saveContext(sections);
    console.log('[ContextManager] Save complete.');
  }

  static getThoughtsFromSection(section: ContextSection): ContextThought[] {
    const entries = this.parseThoughtEntries(section.content);
    return entries.map((entry, index) => ({
      noteId: entry.noteId ?? this.buildLegacyNoteId(section.header, index),
      id: entry.noteId ?? this.buildLegacyNoteId(section.header, index),
      sectionHeader: section.header,
      text: entry.text,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      sourceMetadata: entry.sourceMetadata,
      sourceKind: entry.sourceMetadata?.kind,
      sourceTranscript: entry.sourceMetadata?.transcript,
    }));
  }

  static getInboxThoughts(sections: ContextSection[]): ContextThought[] {
    const inbox = sections.find(section => this.matchesHeader(section.header, DEFAULT_TOPIC));
    return inbox ? this.getThoughtsFromSection(inbox) : [];
  }

  static async removeThought(sectionHeader: string, thoughtText: string, thoughtId?: string): Promise<boolean> {
    const trimmedThought = thoughtText.trim();
    if (!trimmedThought) return false;

    const sections = await this.readContext();
    const sectionIndex = sections.findIndex(section => this.matchesHeader(section.header, sectionHeader));
    if (sectionIndex === -1) return false;

    const removed = this.removeFirstThoughtEntry(
      sections[sectionIndex].content,
      sectionHeader,
      trimmedThought,
      thoughtId ?? null,
    );
    if (!removed.didRemove) return false;

    if (removed.content.trim()) {
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        content: removed.content.trim(),
      };
    } else {
      sections.splice(sectionIndex, 1);
    }

    await this.saveContext(sections);
    return true;
  }

  static async updateThought(
    sectionHeader: string,
    thoughtId: string,
    updates: {
      text?: string;
      sourceMetadata?: NoteSourceMetadata;
      updatedAt?: string;
    },
  ): Promise<boolean> {
    const sections = await this.readContext();
    const sectionIndex = sections.findIndex(section => this.matchesHeader(section.header, sectionHeader));
    if (sectionIndex === -1) return false;

    const parsedEntries = this.parseThoughtEntries(sections[sectionIndex].content);
    const targetIndex = parsedEntries.findIndex((entry, index) =>
      this.matchesNoteId(entry.noteId, thoughtId, sectionHeader, index) ||
      (entry.noteId === null && this.buildLegacyNoteId(sectionHeader, index) === thoughtId),
    );

    if (targetIndex === -1) {
      return false;
    }

    const targetEntry = parsedEntries[targetIndex];
    const nextEntries = parsedEntries.map((entry, index) =>
      index === targetIndex
        ? {
            ...entry,
            text: updates.text?.trim() || entry.text,
            updatedAt: updates.updatedAt?.trim() || new Date().toISOString(),
            sourceMetadata: this.normalizeSourceMetadata({
              ...entry.sourceMetadata,
              ...updates.sourceMetadata,
              kind: updates.sourceMetadata?.kind ?? entry.sourceMetadata?.kind,
              transcript: updates.sourceMetadata?.transcript ?? entry.sourceMetadata?.transcript,
              noteId: updates.sourceMetadata?.noteId ?? entry.sourceMetadata?.noteId ?? targetEntry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
            }),
            noteId: targetEntry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
          }
        : entry,
    );

    sections[sectionIndex] = {
      ...sections[sectionIndex],
      content: this.serializeEntries(sectionHeader, nextEntries).trim(),
    };

    await this.saveContext(sections);
    return true;
  }

  /**
   * Serializes sections back to markdown and saves to disk.
   */
  private static async saveContext(sections: ContextSection[]): Promise<void> {
    if (!this.masterFilePath) {
      throw new Error('ContextManager path has not been configured');
    }

    const markdown = sections
      .map(s => `## ${s.header}\n${s.content.trim()}\n`)
      .join('\n');
    
    // Header for the file
    const fileContent = `# Context Master File\n\n${markdown}`;
    const tempPath = `${this.masterFilePath}.tmp`;
    const canMoveFiles = typeof (fs as { moveFile?: unknown }).moveFile === 'function';

    if (canMoveFiles) {
      try {
        await fs.writeFile(tempPath, fileContent, 'utf8');
        await fs.moveFile(tempPath, this.masterFilePath);
        return;
      } catch (error) {
        console.warn('Atomic context save failed, falling back to direct write:', error);
      }
    }

    await fs.writeFile(this.masterFilePath, fileContent, 'utf8');
  }

  /**
   * Simple markdown parser for ## headers.
   */
  private static parseMarkdown(content: string): ContextSection[] {
    const sections: ContextSection[] = [];
    const lines = content.split('\n');
    let currentHeader: string = 'General';
    let currentContent = '';
    let hasHeader = false;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (hasHeader || currentContent.trim()) {
          sections.push({ header: currentHeader, content: currentContent.trim() });
        }
        currentHeader = line.replace('## ', '').trim();
        currentContent = '';
        hasHeader = true;
      } else if (!line.startsWith('# ')) {
        currentContent += line + '\n';
      }
    }

    if (hasHeader || currentContent.trim()) {
      sections.push({ header: currentHeader, content: currentContent.trim() });
    }

    return sections;
  }

  private static normalizeHeader(header: string): string {
    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_TOPIC;
  }

  private static matchesHeader(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  private static parseThoughtEntries(content: string): Array<{
    rawLines: string[];
    noteId: string | null;
    text: string;
    createdAt?: string;
    updatedAt?: string;
    sourceMetadata?: NoteSourceMetadata;
  }> {
    const entries: Array<{
      rawLines: string[];
      noteId: string | null;
      text: string;
      createdAt?: string;
      updatedAt?: string;
      sourceMetadata?: NoteSourceMetadata;
    }> = [];
    let current: {
      rawLines: string[];
      noteId: string | null;
      text: string;
      createdAt?: string;
      updatedAt?: string;
      sourceMetadata?: NoteSourceMetadata;
    } | null = null;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith('-')) {
        if (current) {
          entries.push(current);
        }

        let text = trimmed.substring(1).trim();
        let createdAt: string | undefined;
        const timestampMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (timestampMatch) {
          createdAt = timestampMatch[1].trim();
          text = timestampMatch[2].trim();
        }

        current = {
          rawLines: [line],
          noteId: null,
          text,
          createdAt,
        };
        continue;
      }

      if (!current) {
        continue;
      }

      current.rawLines.push(line);
      const noteIdMatch = trimmed.match(/^Note id:\s*(.+)$/i);
      const createdAtMatch = trimmed.match(/^Created at:\s*(.+)$/i);
      const updatedAtMatch = trimmed.match(/^Updated at:\s*(.+)$/i);
      const sourceKindMatch = trimmed.match(/^Source kind:\s*(.+)$/i);
      const sourceTranscriptMatch = trimmed.match(/^Source transcript:\s*(.+)$/i);
      const sourceNoteIdMatch = trimmed.match(/^Source note id:\s*(.+)$/i);
      const sourceSectionHeaderMatch = trimmed.match(/^Source section:\s*(.+)$/i);
      const sourceTextMatch = trimmed.match(/^Source text:\s*(.+)$/i);

      if (noteIdMatch) {
        current.noteId = noteIdMatch[1].trim();
      }
      if (createdAtMatch) {
        current.createdAt = createdAtMatch[1].trim();
      }
      if (updatedAtMatch) {
        current.updatedAt = updatedAtMatch[1].trim();
      }
      if (sourceKindMatch) {
        current.sourceMetadata = {
          ...(current.sourceMetadata ?? {}),
          kind: normalizeNoteSourceKind(sourceKindMatch[1].trim()),
        };
      }

      if (sourceTranscriptMatch) {
        current.sourceMetadata = {
          ...(current.sourceMetadata ?? {}),
          transcript: sourceTranscriptMatch[1].trim(),
        };
      }

      if (sourceNoteIdMatch) {
        current.sourceMetadata = {
          ...(current.sourceMetadata ?? {}),
          noteId: sourceNoteIdMatch[1].trim(),
        };
      }

      if (sourceSectionHeaderMatch) {
        current.sourceMetadata = {
          ...(current.sourceMetadata ?? {}),
          sectionHeader: sourceSectionHeaderMatch[1].trim(),
        };
      }

      if (sourceTextMatch) {
        current.sourceMetadata = {
          ...(current.sourceMetadata ?? {}),
          text: sourceTextMatch[1].trim(),
        };
      }
    }

    if (current) {
      entries.push(current);
    }

    return entries.filter(entry => entry.text.trim());
  }

  private static removeFirstThoughtEntry(content: string, sectionHeader: string, thoughtText: string, thoughtId: string | null): {
    didRemove: boolean;
    content: string;
  } {
    const entries = this.parseThoughtEntries(content);
    const nextEntries: typeof entries = [];
    let didRemove = false;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const matchesId = thoughtId ? this.matchesNoteId(entry.noteId, thoughtId, sectionHeader, index) : false;
      const matchesText = !thoughtId && entry.text.trim() === thoughtText;

      if (!didRemove && (matchesId || matchesText)) {
        didRemove = true;
        continue;
      }

      nextEntries.push(entry);
    }

    return {
      didRemove,
      content: this.serializeEntries(sectionHeader, nextEntries),
    };
  }

  private static buildLegacyNoteId(sectionHeader: string, index: number): string {
    return `${this.normalizeHeader(sectionHeader).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'section'}-${index}`;
  }

  private static matchesNoteId(
    noteId: string | null,
    thoughtId: string,
    sectionHeader: string,
    index: number,
  ): boolean {
    if (noteId && noteId === thoughtId) {
      return true;
    }

    return this.buildLegacyNoteId(sectionHeader, index) === thoughtId;
  }

  private static normalizeSourceMetadata(sourceMetadata?: NoteSourceMetadata): NoteSourceMetadata | undefined {
    if (!sourceMetadata) {
      return undefined;
    }

    const normalized: NoteSourceMetadata = {};

    if (sourceMetadata.kind) {
      const kind = normalizeNoteSourceKind(sourceMetadata.kind);
      if (kind) {
        normalized.kind = kind;
      }
    }

    if (sourceMetadata.transcript?.trim()) {
      normalized.transcript = sourceMetadata.transcript.trim();
    }

    if (sourceMetadata.noteId?.trim()) {
      normalized.noteId = sourceMetadata.noteId.trim();
    }

    if (sourceMetadata.sectionHeader?.trim()) {
      normalized.sectionHeader = sourceMetadata.sectionHeader.trim();
    }

    if (sourceMetadata.text?.trim()) {
      normalized.text = sourceMetadata.text.trim();
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private static serializeThoughtEntry(entry: {
    noteId: string;
    text: string;
    createdAt?: string;
    updatedAt?: string;
    sourceMetadata?: NoteSourceMetadata;
    rawLines: string[];
    noteIdFallback?: string;
  }): string {
    const metadataLines = [
      `  Note id: ${entry.noteIdFallback ?? entry.noteId}`,
      entry.createdAt ? `  Created at: ${entry.createdAt}` : null,
      entry.updatedAt ? `  Updated at: ${entry.updatedAt}` : null,
      entry.sourceMetadata?.kind ? `  Source kind: ${entry.sourceMetadata.kind.toUpperCase()}` : null,
      entry.sourceMetadata?.transcript ? `  Source transcript: ${entry.sourceMetadata.transcript}` : null,
      entry.sourceMetadata?.noteId ? `  Source note id: ${entry.sourceMetadata.noteId}` : null,
      entry.sourceMetadata?.sectionHeader ? `  Source section: ${entry.sourceMetadata.sectionHeader}` : null,
      entry.sourceMetadata?.text ? `  Source text: ${entry.sourceMetadata.text}` : null,
    ].filter((line): line is string => Boolean(line));

    return `\n- [${entry.createdAt ?? new Date().toISOString()}] ${entry.text}${
      metadataLines.length ? `\n${metadataLines.join('\n')}` : ''
    }`;
  }

  private static serializeEntries(
    sectionHeader: string,
    entries: Array<{
    noteId: string | null;
    text: string;
    createdAt?: string;
    updatedAt?: string;
    sourceMetadata?: NoteSourceMetadata;
  }>,
  ): string {
    return entries
      .map((entry, index) =>
        this.serializeThoughtEntry({
          noteId: entry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
          text: entry.text,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          sourceMetadata: entry.sourceMetadata,
          rawLines: [],
        }),
      )
      .join('');
  }
}
