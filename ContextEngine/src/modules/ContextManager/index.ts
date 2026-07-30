import fs from 'react-native-fs';

import {
  createNoteId,
  normalizeNoteSourceKind,
  type NoteSourceKind,
  type NoteSourceMetadata,
} from '../../shared/notes/noteTypes';

/**
 * ContextManager Module
 * Responsible for all operations on per-topic markdown files.
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

interface TopicFileRecord {
  header: string;
  content: string;
  filePath: string;
  modifiedAtMs: number;
}

const DEFAULT_TOPIC = 'Inbox';

export class ContextManager {
  private static storageRootPath = '';
  private static legacyMasterFilePath = '';

  static setPath(path: string, options: { legacyPath?: string } = {}) {
    this.storageRootPath = path.trim();
    this.legacyMasterFilePath = options.legacyPath?.trim() ?? '';
  }

  static async readContext(): Promise<ContextSection[]> {
    try {
      if (!this.storageRootPath) return [];

      await this.ensureStorageReady();
      const topicFiles = await this.readTopicFiles();
      return topicFiles.map(({ header, content }) => ({ header, content }));
    } catch (error) {
      console.error('Failed to read topic files:', error);
      return [];
    }
  }

  static async appendThought(header: string, thought: string, options: AppendThoughtOptions = {}): Promise<void> {
    if (!thought.trim()) return;

    await this.ensureStorageReady();

    const normalizedHeader = this.normalizeHeader(header);
    console.log(`[ContextManager] Appending to ${normalizedHeader}: ${thought}`);

    const topicFiles = await this.readTopicFiles();
    const existing = topicFiles.find(topic => this.matchesHeader(topic.header, normalizedHeader));

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

    const nextContent = existing?.content.trim()
      ? `${existing.content.trim()}\n${formattedThought.trim()}`
      : formattedThought.trim();
    const targetPath = existing?.filePath ?? await this.buildUniqueTopicFilePath(normalizedHeader, topicFiles);
    const targetHeader = existing?.header ?? normalizedHeader;

    await this.writeTopicFile(targetPath, targetHeader, nextContent);
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

    await this.ensureStorageReady();

    const topicFiles = await this.readTopicFiles();
    const topic = topicFiles.find(section => this.matchesHeader(section.header, sectionHeader));
    if (!topic) return false;

    const removed = this.removeFirstThoughtEntry(
      topic.content,
      sectionHeader,
      trimmedThought,
      thoughtId ?? null,
    );
    if (!removed.didRemove) return false;

    if (removed.content.trim()) {
      await this.writeTopicFile(topic.filePath, topic.header, removed.content.trim());
    } else if (await fs.exists(topic.filePath)) {
      await fs.unlink(topic.filePath);
    }

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
    await this.ensureStorageReady();

    const topicFiles = await this.readTopicFiles();
    const topic = topicFiles.find(section => this.matchesHeader(section.header, sectionHeader));
    if (!topic) return false;

    const parsedEntries = this.parseThoughtEntries(topic.content);
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
              noteId:
                updates.sourceMetadata?.noteId ??
                entry.sourceMetadata?.noteId ??
                targetEntry.noteId ??
                this.buildLegacyNoteId(sectionHeader, index),
            }),
            noteId: targetEntry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
          }
        : entry,
    );

    await this.writeTopicFile(topic.filePath, topic.header, this.serializeEntries(sectionHeader, nextEntries).trim());
    return true;
  }

  private static async ensureStorageReady(): Promise<void> {
    if (!this.storageRootPath) {
      throw new Error('ContextManager path has not been configured');
    }

    const rootExists = await fs.exists(this.storageRootPath);
    if (!rootExists) {
      await fs.mkdir(this.storageRootPath);
    }

    await this.migrateLegacyContextIfNeeded();
  }

  private static async migrateLegacyContextIfNeeded(): Promise<void> {
    if (!this.legacyMasterFilePath) {
      return;
    }

    const legacyExists = await fs.exists(this.legacyMasterFilePath);
    if (!legacyExists) {
      return;
    }

    const legacyContent = await fs.readFile(this.legacyMasterFilePath, 'utf8');
    const sections = this.parseLegacyMarkdown(legacyContent);
    const existingTopics = await this.readTopicFiles();

    for (const section of sections) {
      const sectionContent = section.content.trim();
      const matchingTopic = existingTopics.find(topic => this.matchesHeader(topic.header, section.header));
      const alreadyMigrated = matchingTopic && this.normalizedContentContains(
        matchingTopic.content,
        sectionContent,
      );

      if (alreadyMigrated) {
        continue;
      }

      // If a topic with the same name has diverged, preserve the legacy section separately instead
      // of guessing at an entry-level merge that could either duplicate or drop manually edited data.
      const targetHeader = matchingTopic ? `Legacy ${section.header}` : section.header;
      const filePath = await this.buildUniqueTopicFilePath(targetHeader, existingTopics);
      await this.writeTopicFile(filePath, targetHeader, sectionContent);
      existingTopics.push({
        header: targetHeader,
        content: sectionContent,
        filePath,
        modifiedAtMs: Date.now(),
      });
    }

    await fs.unlink(this.legacyMasterFilePath);
  }

  private static normalizedContentContains(container: string, candidate: string): boolean {
    const normalize = (value: string) => value
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
    const normalizedCandidate = normalize(candidate);
    return normalizedCandidate.length > 0 && normalize(container).includes(normalizedCandidate);
  }

  private static async readTopicFiles(): Promise<TopicFileRecord[]> {
    const files = await this.listTopicMarkdownFiles();
    const topics: TopicFileRecord[] = [];

    for (const file of files) {
      const content = await fs.readFile(file.path, 'utf8');
      const parsed = this.parseTopicFile(content, file.name);
      topics.push({
        header: parsed.header,
        content: parsed.content,
        filePath: file.path,
        modifiedAtMs: file.mtime ? new Date(file.mtime).getTime() : 0,
      });
    }

    return topics.sort((a, b) => {
      if (b.modifiedAtMs !== a.modifiedAtMs) {
        return b.modifiedAtMs - a.modifiedAtMs;
      }

      return a.header.localeCompare(b.header);
    });
  }

  private static async listTopicMarkdownFiles(): Promise<Array<{ path: string; name: string; mtime?: string | Date }>> {
    const entries = await fs.readDir(this.storageRootPath);
    return entries
      .filter(entry => typeof entry.isFile === 'function' ? entry.isFile() : true)
      .filter(entry => entry.name.toLowerCase().endsWith('.md'))
      .map(entry => ({
        path: entry.path,
        name: entry.name,
        mtime: entry.mtime,
      }));
  }

  private static parseTopicFile(content: string, fallbackFilename: string): ContextSection {
    const lines = content.split('\n');
    const headingLine = lines.find(line => line.startsWith('# ')) ?? '';
    const header = headingLine ? headingLine.replace(/^#\s+/, '').trim() : this.headerFromFilename(fallbackFilename);
    const bodyStart = headingLine ? lines.indexOf(headingLine) + 1 : 0;
    const body = lines.slice(bodyStart).join('\n').trim();
    return {
      header: this.normalizeHeader(header),
      content: body,
    };
  }

  private static async buildUniqueTopicFilePath(header: string, existingTopics: TopicFileRecord[]): Promise<string> {
    const slugBase = this.slugifyHeader(header) || 'topic';
    let attempt = 0;

    while (true) {
      const filename = attempt === 0 ? `${slugBase}.md` : `${slugBase}-${attempt + 1}.md`;
      const filePath = `${this.storageRootPath}/${filename}`;
      const existsInMemory = existingTopics.some(topic => topic.filePath === filePath);
      const existsOnDisk = existsInMemory || await fs.exists(filePath);

      if (!existsOnDisk) {
        return filePath;
      }

      attempt += 1;
    }
  }

  private static async writeTopicFile(filePath: string, header: string, content: string): Promise<void> {
    const normalizedHeader = this.normalizeHeader(header);
    const fileContent = this.serializeTopicFile(normalizedHeader, content);
    const tempPath = `${filePath}.tmp`;
    const canMoveFiles = typeof (fs as { moveFile?: unknown }).moveFile === 'function';

    if (canMoveFiles) {
      try {
        await fs.writeFile(tempPath, fileContent, 'utf8');
        const destExists = await fs.exists(filePath);
        if (destExists) {
          await fs.unlink(filePath);
        }
        await fs.moveFile(tempPath, filePath);
        return;
      } catch (error) {
        console.warn('Atomic topic save failed, falling back to direct write:', error);
      }
    }

    await fs.writeFile(filePath, fileContent, 'utf8');
  }

  private static serializeTopicFile(header: string, content: string): string {
    return `# ${header}\n\n${content.trim()}\n`;
  }

  private static parseLegacyMarkdown(content: string): ContextSection[] {
    const sections: ContextSection[] = [];
    const lines = content.split('\n');
    let currentHeader = 'General';
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
        currentContent += `${line}\n`;
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

  private static headerFromFilename(filename: string): string {
    const basename = filename.replace(/\.md$/i, '');
    return basename
      .split('-')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private static slugifyHeader(header: string): string {
    return this.normalizeHeader(header)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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
      const sourceAudioFileMatch = trimmed.match(/^Source audio file:\s*(.+)$/i);

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

      if (sourceAudioFileMatch) {
        current.sourceMetadata = {
          ...(current.sourceMetadata ?? {}),
          audioFilePath: sourceAudioFileMatch[1].trim(),
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

    if (sourceMetadata.audioFilePath?.trim()) {
      normalized.audioFilePath = sourceMetadata.audioFilePath.trim();
    } else if (sourceMetadata.audioFilePath === null) {
      normalized.audioFilePath = null;
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
      entry.sourceMetadata?.audioFilePath ? `  Source audio file: ${entry.sourceMetadata.audioFilePath}` : null,
    ].filter((line): line is string => Boolean(line));

    return [`- [${entry.createdAt ?? new Date().toISOString()}] ${entry.text}`, ...metadataLines].join('\n') + '\n';
  }

  private static serializeEntries(
    sectionHeader: string,
    entries: Array<ThoughtEntry & { noteId?: string | null; text: string; createdAt?: string; updatedAt?: string }>,
  ): string {
    return entries
      .map((entry, index) =>
        this.serializeThoughtEntry({
          noteId: entry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
          noteIdFallback: entry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
          text: entry.text,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          sourceMetadata: entry.sourceMetadata,
          rawLines: entry.rawLines,
        }).trimEnd(),
      )
      .join('\n');
  }
}
