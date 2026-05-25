import fs from 'react-native-fs';

/**
 * ContextManager Module
 * Responsible for all operations on the master context.md file.
 */

export interface ContextSection {
  header: string;
  content: string;
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
  static async appendThought(header: string, thought: string): Promise<void> {
    if (!thought.trim()) return;

    const normalizedHeader = this.normalizeHeader(header);
    console.log(`[ContextManager] Appending to ${normalizedHeader}: ${thought}`);

    const sections = await this.readContext();
    const sectionIndex = sections.findIndex(section => this.matchesHeader(section.header, normalizedHeader));

    const timestamp = new Date().toISOString();
    const formattedThought = `\n- [${timestamp}] ${thought.trim()}`;

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
}
