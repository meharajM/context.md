import fs from 'react-native-fs';

/**
 * ContextManager Module
 * Responsible for all operations on the master context.md file.
 */

export interface ContextSection {
  header: string;
  content: string;
}

export class ContextManager {
  private static masterFilePath = '';

  static setPath(path: string) {
    this.masterFilePath = path;
  }

  /**
   * Reads the entire context file and parses it into sections.
   */
  static async readContext(): Promise<ContextSection[]> {
    try {
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
    console.log(`[ContextManager] Appending to ${header}: ${thought}`);
    const sections = await this.readContext();
    const sectionIndex = sections.findIndex(s => s.header.toLowerCase() === header.toLowerCase());

    const timestamp = new Date().toISOString();
    const formattedThought = `\n- [${timestamp}] ${thought}`;

    if (sectionIndex !== -1) {
      sections[sectionIndex].content += formattedThought;
    } else {
      sections.push({
        header: header,
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
    const markdown = sections
      .map(s => `## ${s.header}\n${s.content.trim()}\n`)
      .join('\n');
    
    // Header for the file
    const fileContent = `# Context Master File\n\n${markdown}`;
    
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
}
