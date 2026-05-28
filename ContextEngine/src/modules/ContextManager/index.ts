import fs from 'react-native-fs';

/**
 * ContextManager Module
 * Responsible for all operations on the master context.md file.
 */

export interface ContextSection {
  header: string;
  content: string;
}

export interface ContextThought {
  id: string;
  sectionHeader: string;
  text: string;
  sourceKind?: AppendThoughtOptions['sourceKind'];
  sourceTranscript?: string;
}

export interface AppendThoughtOptions {
  sourceKind?: 'voice' | 'text' | 'image';
  sourceTranscript?: string;
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
    const sourceLines: string[] = [];
    const sourceKind = options.sourceKind ? options.sourceKind.toUpperCase() : null;
    const sourceTranscript = options.sourceTranscript?.trim();

    if (sourceKind) {
      sourceLines.push(`  Source kind: ${sourceKind}`);
    }

    if (sourceTranscript && sourceTranscript !== thought.trim()) {
      sourceLines.push(`  Source transcript: ${sourceTranscript}`);
    }

    const formattedThought = `\n- [${timestamp}] ${thought.trim()}${sourceLines.length ? `\n${sourceLines.join('\n')}` : ''}`;

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
      id: `${this.normalizeHeader(section.header).toLowerCase()}-${index}`,
      sectionHeader: section.header,
      text: entry.text,
      sourceKind: entry.sourceKind,
      sourceTranscript: entry.sourceTranscript,
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
      trimmedThought,
      thoughtId ? this.parseThoughtIndex(thoughtId) : null,
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
    text: string;
    sourceKind?: AppendThoughtOptions['sourceKind'];
    sourceTranscript?: string;
  }> {
    const entries: Array<{
      rawLines: string[];
      text: string;
      sourceKind?: AppendThoughtOptions['sourceKind'];
      sourceTranscript?: string;
    }> = [];
    let current: {
      rawLines: string[];
      text: string;
      sourceKind?: AppendThoughtOptions['sourceKind'];
      sourceTranscript?: string;
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
        const timestampMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (timestampMatch) {
          text = timestampMatch[2].trim();
        }

        current = {
          rawLines: [line],
          text,
        };
        continue;
      }

      if (!current) {
        continue;
      }

      current.rawLines.push(line);
      const sourceKindMatch = trimmed.match(/^Source kind:\s*(.+)$/i);
      const sourceTranscriptMatch = trimmed.match(/^Source transcript:\s*(.+)$/i);

      if (sourceKindMatch) {
        const sourceKind = sourceKindMatch[1].trim().toLowerCase();
        if (sourceKind === 'voice' || sourceKind === 'text' || sourceKind === 'image') {
          current.sourceKind = sourceKind;
        }
      }

      if (sourceTranscriptMatch) {
        current.sourceTranscript = sourceTranscriptMatch[1].trim();
      }
    }

    if (current) {
      entries.push(current);
    }

    return entries.filter(entry => entry.text.trim());
  }

  private static removeFirstThoughtEntry(content: string, thoughtText: string, thoughtIndex: number | null): {
    didRemove: boolean;
    content: string;
  } {
    const lines = content.split('\n');
    const nextLines: string[] = [];
    let currentEntryLines: string[] = [];
    let currentEntryText = '';
    let currentEntryIndex = -1;
    let entryIndex = -1;
    let didRemove = false;

    const flushEntry = () => {
      if (!currentEntryLines.length) {
        return;
      }

      const isTargetIndex = thoughtIndex !== null && currentEntryIndex === thoughtIndex;
      const isTargetText = thoughtIndex === null && currentEntryText.trim() === thoughtText;

      if (!didRemove && (isTargetIndex || isTargetText)) {
        didRemove = true;
      } else {
        nextLines.push(...currentEntryLines);
      }

      currentEntryLines = [];
      currentEntryText = '';
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-')) {
        flushEntry();
        entryIndex += 1;
        currentEntryIndex = entryIndex;
        currentEntryLines = [line];
        let text = trimmed.substring(1).trim();
        const timestampMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);
        currentEntryText = timestampMatch ? timestampMatch[2].trim() : text;
        continue;
      }

      if (currentEntryLines.length) {
        currentEntryLines.push(line);
      } else {
        nextLines.push(line);
      }
    }

    flushEntry();

    return {
      didRemove,
      content: nextLines.join('\n'),
    };
  }

  private static parseThoughtIndex(thoughtId: string): number | null {
    const match = thoughtId.match(/-(\d+)$/);
    if (!match) {
      return null;
    }

    const index = Number.parseInt(match[1], 10);
    return Number.isFinite(index) ? index : null;
  }
}
