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

interface BackupNote {
  noteId: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
  sourceMetadata?: Omit<NoteSourceMetadata, 'audioFilePath'>;
}

interface BackupTopic {
  header: string;
  notes: BackupNote[];
}

interface LibraryBackup {
  format: 'thought-notes-backup';
  version: 1;
  exportedAt: string;
  topics: BackupTopic[];
}

export interface BackupMergeResult {
  added: number;
  skipped: number;
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
  private static storageOperations: Promise<unknown> = Promise.resolve();

  private static serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.storageOperations.then(operation);
    // A failed save must not prevent later captures from being stored.
    this.storageOperations = result.catch(() => undefined);
    return result;
  }

  static setPath(path: string, options: { legacyPath?: string } = {}) {
    this.storageRootPath = path.trim();
    this.legacyMasterFilePath = options.legacyPath?.trim() ?? '';
  }

  static readContext(): Promise<ContextSection[]> {
    return this.serializeStorage(() => this.readContextUnlocked());
  }

  private static async readContextUnlocked(): Promise<ContextSection[]> {
    if (!this.storageRootPath) return [];

    await this.ensureStorageReady();
    const topicFiles = await this.readTopicFiles(true);
    return topicFiles.map(({ header, content }) => ({ header, content }));
  }

  static appendThought(header: string, thought: string, options: AppendThoughtOptions = {}): Promise<void> {
    return this.serializeStorage(() => this.appendThoughtUnlocked(header, thought, options));
  }

  private static async appendThoughtUnlocked(
    header: string,
    thought: string,
    options: AppendThoughtOptions,
    replaceExisting = false,
  ): Promise<void> {
    if (!thought.trim()) return;

    await this.ensureStorageReady();

    const normalizedHeader = this.normalizeHeader(header);
    console.log(`[ContextManager] Appending to ${normalizedHeader}: ${thought}`);

    const topicFiles = await this.readTopicFiles();
    const existing = topicFiles.find(topic => this.matchesHeader(topic.header, normalizedHeader));

    if (options.noteId && existing) {
      const entries = this.parseThoughtEntries(existing.content);
      const matchingIndex = entries.findIndex((entry, index) => replaceExisting
        ? this.matchesNoteId(entry.noteId, options.noteId!, existing.header, index)
        : entry.noteId === options.noteId);
      if (matchingIndex !== -1) {
        if (replaceExisting) {
          await this.updateThoughtUnlocked(existing.header, options.noteId, {
            text: thought,
            sourceMetadata: options.sourceMetadata,
            updatedAt: options.updatedAt,
          });
        }
        return;
      }
    }

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
      text: thought,
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

  static createBackup(): Promise<string> {
    return this.serializeStorage(async () => {
      await this.ensureStorageReady();
      const topics = await this.readTopicFiles();
      const backup: LibraryBackup = {
        format: 'thought-notes-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        topics: topics.map(topic => ({
          header: topic.header,
          notes: this.parseThoughtEntries(topic.content).map((entry, index) => ({
            noteId: entry.noteId ?? this.buildLegacyNoteId(topic.header, index),
            text: entry.text,
            ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
            ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
            ...(entry.sourceMetadata ? {
              sourceMetadata: {
                ...(entry.sourceMetadata.kind ? { kind: entry.sourceMetadata.kind } : {}),
                ...(entry.sourceMetadata.transcript ? { transcript: entry.sourceMetadata.transcript } : {}),
                ...(entry.sourceMetadata.noteId ? { noteId: entry.sourceMetadata.noteId } : {}),
                ...(entry.sourceMetadata.sectionHeader ? { sectionHeader: entry.sourceMetadata.sectionHeader } : {}),
                ...(entry.sourceMetadata.text ? { text: entry.sourceMetadata.text } : {}),
                ...(entry.sourceMetadata.transcriptionError ? { transcriptionError: entry.sourceMetadata.transcriptionError } : {}),
              },
            } : {}),
          })),
        })),
      };
      const serialized = JSON.stringify(backup, null, 2);
      parseLibraryBackup(serialized);
      return serialized;
    });
  }

  static mergeBackup(serializedBackup: string): Promise<BackupMergeResult> {
    const backup = parseLibraryBackup(serializedBackup);
    return this.serializeStorage(async () => {
      await this.ensureStorageReady();
      const topics = await this.readTopicFiles();
      const seenById = new Map<string, Array<{ text: string }>>();
      for (const topic of topics) {
        this.parseThoughtEntries(topic.content).forEach((entry, index) => {
          const noteId = entry.noteId ?? this.buildLegacyNoteId(topic.header, index);
          const matches = seenById.get(noteId) ?? [];
          matches.push({ text: entry.text });
          seenById.set(noteId, matches);
        });
      }

      let added = 0;
      let skipped = 0;
      const modifiedTopics = new Set<TopicFileRecord>();
      for (const sourceTopic of backup.topics) {
        let targetTopic = topics.find(topic => this.matchesHeader(topic.header, sourceTopic.header));
        if (!targetTopic) {
          targetTopic = {
            header: this.normalizeHeader(sourceTopic.header),
            content: '',
            filePath: await this.buildUniqueTopicFilePath(sourceTopic.header, topics),
            modifiedAtMs: Date.now(),
          };
          topics.push(targetTopic);
        }

        for (const note of sourceTopic.notes) {
          if (seenById.get(note.noteId)?.some(entry => entry.text === note.text)) {
            skipped += 1;
            continue;
          }

          let noteId = note.noteId;
          if (seenById.has(noteId)) {
            const baseId = `restored-${hashBackupNote(sourceTopic.header, note)}`;
            let suffix = 1;
            while (true) {
              const candidate = suffix === 1 ? baseId : `${baseId}-${suffix}`;
              const conflicts = seenById.get(candidate);
              if (!conflicts) {
                noteId = candidate;
                break;
              }
              if (conflicts.some(entry => entry.text === note.text)) {
                skipped += 1;
                noteId = '';
                break;
              }
              suffix += 1;
            }
            if (!noteId) continue;
          }

          const metadata = this.normalizeSourceMetadata(note.sourceMetadata);
          const formatted = this.serializeThoughtEntry({
            noteId,
            text: note.text,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            sourceMetadata: metadata,
            rawLines: [],
          }).trim();
          targetTopic.content = targetTopic.content.trim()
            ? `${targetTopic.content.trim()}\n${formatted}`
            : formatted;
          const matches = seenById.get(noteId) ?? [];
          matches.push({ text: note.text });
          seenById.set(noteId, matches);
          modifiedTopics.add(targetTopic);
          added += 1;
        }
      }

      let writtenTopics = 0;
      try {
        for (const topic of modifiedTopics) {
          await this.writeTopicFile(topic.filePath, topic.header, topic.content);
          writtenTopics += 1;
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Backup restore stopped after writing ${writtenTopics} topic(s). Retry the same backup to finish safely. ${detail}`);
      }

      return { added, skipped };
    });
  }

  static getInboxThoughts(sections: ContextSection[]): ContextThought[] {
    const inbox = sections.find(section => this.matchesHeader(section.header, DEFAULT_TOPIC));
    return inbox ? this.getThoughtsFromSection(inbox) : [];
  }

  static removeThought(sectionHeader: string, thoughtText: string, thoughtId?: string): Promise<boolean> {
    return this.serializeStorage(() => this.removeThoughtUnlocked(sectionHeader, thoughtText, thoughtId));
  }

  private static async removeThoughtUnlocked(sectionHeader: string, thoughtText: string, thoughtId?: string): Promise<boolean> {
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

  static commitSynthesisResult(
    source: {
      sectionHeader: string;
      thoughtText: string;
      thoughtId?: string;
      noteId?: string;
    },
    targetHeader: string,
    refinedText: string,
    options: AppendThoughtOptions = {},
  ): Promise<boolean> {
    return this.serializeStorage(async () => {
      if (!refinedText.trim()) return false;

      await this.ensureStorageReady();

      const topicFiles = await this.readTopicFiles();
      const sourceTopic = topicFiles.find(topic => this.matchesHeader(topic.header, source.sectionHeader));
      if (!sourceTopic) return false;

      const sourceId = source.noteId?.trim() || source.thoughtId?.trim();
      const sourceEntries = this.parseThoughtEntries(sourceTopic.content);
      const sourceIndex = sourceEntries.findIndex((entry, index) => {
        const idMatches = sourceId
          ? this.matchesNoteId(entry.noteId, sourceId, sourceTopic.header, index)
          : entry.text.trim() === source.thoughtText.trim();
        return idMatches && entry.text.trim() === source.thoughtText.trim();
      });
      if (sourceIndex === -1) return false;

      const stableSourceId = sourceId ?? this.buildLegacyNoteId(sourceTopic.header, sourceIndex);
      if (this.matchesHeader(sourceTopic.header, targetHeader)) {
        return this.updateThoughtUnlocked(sourceTopic.header, stableSourceId, {
          text: refinedText,
          sourceMetadata: options.sourceMetadata,
          updatedAt: options.updatedAt,
        });
      }

      await this.appendThoughtUnlocked(targetHeader, refinedText, {
        ...options,
        noteId: options.noteId?.trim() || stableSourceId,
      }, true);
      return this.removeThoughtUnlocked(sourceTopic.header, source.thoughtText, stableSourceId);
    });
  }

  static updateThought(
    sectionHeader: string,
    thoughtId: string,
    updates: {
      text?: string;
      sourceMetadata?: NoteSourceMetadata;
      updatedAt?: string;
    },
  ): Promise<boolean> {
    return this.serializeStorage(() => this.updateThoughtUnlocked(sectionHeader, thoughtId, updates));
  }

  static updateThoughtAndResolveSection(
    preferredSectionHeader: string,
    thoughtId: string,
    updates: {
      text?: string;
      sourceMetadata?: NoteSourceMetadata;
      updatedAt?: string;
    },
  ): Promise<string | null> {
    return this.serializeStorage(async () => {
      await this.ensureStorageReady();

      const topicFiles = await this.readTopicFiles();
      const preferredTopic = topicFiles.find(topic => this.matchesHeader(topic.header, preferredSectionHeader));
      const candidates = preferredTopic
        ? [preferredTopic, ...topicFiles.filter(topic => topic !== preferredTopic)]
        : topicFiles;

      for (const topic of candidates) {
        const entries = this.parseThoughtEntries(topic.content);
        const found = entries.some((entry, index) =>
          this.matchesNoteId(entry.noteId, thoughtId, topic.header, index) ||
          (entry.noteId === null && this.buildLegacyNoteId(topic.header, index) === thoughtId),
        );
        if (!found) continue;

        const updated = await this.updateThoughtUnlocked(topic.header, thoughtId, updates);
        return updated ? topic.header : null;
      }

      return null;
    });
  }

  private static async updateThoughtUnlocked(
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
            text: updates.text?.trim() ? updates.text : entry.text,
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

  private static async readTopicFiles(allowRecoveryFallback = false): Promise<TopicFileRecord[]> {
    const recoveryFallbacks = await this.recoverInterruptedTopicSaves(allowRecoveryFallback);
    const files = await this.listTopicMarkdownFiles();
    for (const finalPath of recoveryFallbacks.keys()) {
      if (!files.some(file => file.path === finalPath)) {
        files.push({ path: finalPath, name: finalPath.split('/').pop()! });
      }
    }
    const topics: TopicFileRecord[] = [];

    for (const file of files) {
      const content = await fs.readFile(recoveryFallbacks.get(file.path) ?? file.path, 'utf8');
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
    await this.recoverTopicSave(filePath);
    const fileContent = this.serializeTopicFile(this.normalizeHeader(header), content);
    const tempPath = `${filePath}.tmp`;
    const readyPath = `${filePath}.ready`;
    if (typeof fs.moveFile !== 'function') {
      throw new Error('Safe topic storage requires filesystem move support.');
    }

    await fs.writeFile(tempPath, fileContent, 'utf8');
    if (await fs.readFile(tempPath, 'utf8') !== fileContent) {
      throw new Error('The staged topic file could not be verified.');
    }
    const sha256 = await fs.hash(tempPath, 'sha256');
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('The staged topic checksum is invalid.');
    const marker = JSON.stringify({ version: 1, sha256 });
    await fs.writeFile(readyPath, marker, 'utf8');
    if (await fs.readFile(readyPath, 'utf8') !== marker) {
      throw new Error('The completed topic marker could not be verified.');
    }
    await this.recoverTopicSave(filePath);
  }

  private static async recoverInterruptedTopicSaves(allowFallback: boolean): Promise<Map<string, string>> {
    const entries = await fs.readDir(this.storageRootPath);
    const paths = new Set(entries
      .filter(entry => typeof entry.isFile !== 'function' || entry.isFile())
      .map(entry => entry.name.match(/^(.*\.md)\.(?:tmp|ready|bak)$/)?.[1])
      .filter((name): name is string => Boolean(name)));
    const fallbacks = new Map<string, string>();
    for (const name of paths) {
      const finalPath = `${this.storageRootPath}/${name}`;
      try {
        await this.recoverTopicSave(finalPath);
      } catch (error) {
        if (!allowFallback) throw error;
        const backupPath = `${finalPath}.bak`;
        if (await fs.exists(backupPath)) fallbacks.set(finalPath, backupPath);
        else if (await fs.exists(finalPath)) fallbacks.set(finalPath, finalPath);
        else throw error;
        console.error('Topic save recovery failed; showing the previous saved copy and retrying on the next operation:', error);
      }
    }
    return fallbacks;
  }

  private static async recoverTopicSave(filePath: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    const readyPath = `${filePath}.ready`;
    const backupPath = `${filePath}.bak`;
    let expectedHash: string | undefined;
    if (await fs.exists(readyPath)) {
      try {
        const marker: unknown = JSON.parse(await fs.readFile(readyPath, 'utf8'));
        if (isRecord(marker) && marker.version === 1 && typeof marker.sha256 === 'string' && /^[a-f0-9]{64}$/.test(marker.sha256)) {
          expectedHash = marker.sha256;
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }

    const finalExists = await fs.exists(filePath);
    const backupExists = await fs.exists(backupPath);
    const tempExists = await fs.exists(tempPath);
    const finalIsComplete = expectedHash && finalExists && await fs.hash(filePath, 'sha256') === expectedHash;
    const tempIsComplete = expectedHash && tempExists && await fs.hash(tempPath, 'sha256') === expectedHash;

    if (tempIsComplete && !finalIsComplete) {
      if (finalExists) {
        if (backupExists) {
          // A failed native move may leave a partial final; the old good copy is in .bak.
          await fs.unlink(filePath);
        } else {
          await fs.moveFile(filePath, backupPath);
        }
      }
      await fs.moveFile(tempPath, filePath);
      if (await fs.hash(filePath, 'sha256') !== expectedHash) {
        throw new Error('The saved topic file could not be verified; its previous copy is retained.');
      }
    } else if (!finalIsComplete && backupExists && (!finalExists || expectedHash)) {
      if (finalExists) await fs.unlink(filePath);
      await fs.moveFile(backupPath, filePath);
    }

    // A raw/partial temp is never a recovery candidate. Clear the marker before retiring the old copy.
    if (await fs.exists(readyPath)) await fs.unlink(readyPath);
    for (const path of [tempPath, backupPath]) {
      if (await fs.exists(path)) {
        try {
          await fs.unlink(path);
        } catch (error) {
          console.warn('Topic save cleanup will retry on the next read:', error);
        }
      }
    }
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
    if (/[\r\n]/.test(header)) throw new Error('Topic headers must use a single line.');
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

  private static parseThoughtEntries(content: string): ThoughtEntry[] {
    const entries: ThoughtEntry[] = [];
    let current: ThoughtEntry | null = null;
    let encoded = false;
    let bodyLines: string[] = [];
    let pendingLegacyMetadata: Array<{ line: string; field: string; value: string }> = [];
    let pendingLegacyBlankLines = 0;
    const applyLegacyMetadata = ({ field, value }: { field: string; value: string }) => {
      if (!current) return;
      switch (field.toLowerCase()) {
        case 'note id': current.noteId = value; break;
        case 'created at': current.createdAt = value; break;
        case 'updated at': current.updatedAt = value; break;
        case 'source kind': current.sourceMetadata = { ...current.sourceMetadata, kind: normalizeNoteSourceKind(value) }; break;
        case 'source transcript': current.sourceMetadata = { ...current.sourceMetadata, transcript: value }; break;
        case 'source note id': current.sourceMetadata = { ...current.sourceMetadata, noteId: value }; break;
        case 'source section': current.sourceMetadata = { ...current.sourceMetadata, sectionHeader: value }; break;
        case 'source text': current.sourceMetadata = { ...current.sourceMetadata, text: value }; break;
        case 'source audio file': current.sourceMetadata = { ...current.sourceMetadata, audioFilePath: value }; break;
        case 'transcription error': current.sourceMetadata = { ...current.sourceMetadata, transcriptionError: value }; break;
      }
    };
    const flushLegacyMetadataAsBody = () => {
      if (!current || !pendingLegacyMetadata.length) return;
      current.text += pendingLegacyMetadata.map(({ line }) => `\n${line}`).join('');
      current.text += '\n'.repeat(pendingLegacyBlankLines);
      pendingLegacyMetadata = [];
      pendingLegacyBlankLines = 0;
    };
    const finish = () => {
      if (!current) return;
      if (encoded) current.text = bodyLines.join('\n');
      else {
        // Old notes wrote metadata as a trailing block; interior matches stay body text.
        pendingLegacyMetadata.forEach(applyLegacyMetadata);
        pendingLegacyMetadata = [];
        pendingLegacyBlankLines = 0;
        current.text = current.text.trimEnd();
      }
      if (current.text.trim()) entries.push(current);
    };

    for (const line of content.split('\n')) {
      const encodedHeader = line.match(/^- \[([^\]]+)\] <!-- thought-note:v2 (.*) -->$/);
      if (encodedHeader) {
        let metadata: unknown;
        try {
          metadata = JSON.parse(encodedHeader[2]);
        } catch {
          // Malformed manually edited headers remain readable as legacy text.
        }
        if (isRecord(metadata) && typeof metadata.noteId === 'string' && !/[\r\n]/.test(metadata.noteId)) {
          finish();
          current = {
            rawLines: [line],
            noteId: metadata.noteId,
            text: '',
            createdAt: typeof metadata.createdAt === 'string' ? metadata.createdAt : encodedHeader[1],
            updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : undefined,
            sourceMetadata: isRecord(metadata.sourceMetadata)
              ? this.normalizeSourceMetadata(metadata.sourceMetadata as NoteSourceMetadata)
              : undefined,
          };
          encoded = true;
          bodyLines = [];
          continue;
        }
      }
      if (encoded && line === '  <!-- /thought-note -->') continue;
      if (encoded && current && line.startsWith('  | ')) {
        current.rawLines.push(line);
        bodyLines.push(line.slice(4));
        continue;
      }
      if (/^\s*-\s/.test(line)) {
        finish();
        const bulletText = line.trim().slice(1).trim();
        const timestamp = bulletText.match(/^\[([^\]]+)\]\s*(.*)$/);
        current = { rawLines: [line], noteId: null, text: timestamp ? timestamp[2] : bulletText,
          createdAt: timestamp?.[1] };
        encoded = false;
        continue;
      }
      if (!current) continue;
      current.rawLines.push(line);
      if (encoded) {
        // Preserve unprefixed manual edits without interpreting them as generated metadata.
        if (line) bodyLines.push(line);
        continue;
      }
      if (!line && pendingLegacyMetadata.length) {
        pendingLegacyBlankLines += 1;
        continue;
      }
      const metadata = line.match(/^[ \t]+(Note id|Created at|Updated at|Source kind|Source transcript|Source note id|Source section|Source text|Source audio file|Transcription error):\s*(.+)$/i);
      if (metadata) {
        if (pendingLegacyBlankLines) flushLegacyMetadataAsBody();
        pendingLegacyMetadata.push({ line, field: metadata[1], value: metadata[2].trim() });
        continue;
      }
      flushLegacyMetadataAsBody();
      current.text += `\n${line}`;
    }
    finish();
    return entries;
  }

  private static removeFirstThoughtEntry(content: string, sectionHeader: string, thoughtText: string, thoughtId: string | null): {
    didRemove: boolean;
    content: string;
  } {
    const entries = this.parseThoughtEntries(content).map((entry, index) => ({
      ...entry,
      noteId: entry.noteId ?? this.buildLegacyNoteId(sectionHeader, index),
    }));
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
    return noteId ? noteId === thoughtId : this.buildLegacyNoteId(sectionHeader, index) === thoughtId;
  }

  private static normalizeSourceMetadata(sourceMetadata?: NoteSourceMetadata): NoteSourceMetadata | undefined {
    if (!sourceMetadata) {
      return undefined;
    }

    const normalized: NoteSourceMetadata = {};

    if (typeof sourceMetadata.kind === 'string') {
      const kind = normalizeNoteSourceKind(sourceMetadata.kind);
      if (kind) {
        normalized.kind = kind;
      }
    }

    if (typeof sourceMetadata.transcript === 'string' && sourceMetadata.transcript.trim()) {
      normalized.transcript = sourceMetadata.transcript;
    }

    if (typeof sourceMetadata.noteId === 'string' && sourceMetadata.noteId.trim()) {
      normalized.noteId = sourceMetadata.noteId.trim();
    }

    if (typeof sourceMetadata.sectionHeader === 'string' && sourceMetadata.sectionHeader.trim()) {
      normalized.sectionHeader = sourceMetadata.sectionHeader.trim();
    }

    if (typeof sourceMetadata.text === 'string' && sourceMetadata.text.trim()) {
      normalized.text = sourceMetadata.text;
    }

    if (typeof sourceMetadata.audioFilePath === 'string' && sourceMetadata.audioFilePath.trim()) {
      normalized.audioFilePath = sourceMetadata.audioFilePath.trim();
    } else if (sourceMetadata.audioFilePath === null) {
      normalized.audioFilePath = null;
    }

    if (typeof sourceMetadata.transcriptionError === 'string' && sourceMetadata.transcriptionError.trim()) {
      normalized.transcriptionError = sourceMetadata.transcriptionError;
    } else if (sourceMetadata.transcriptionError === null) {
      normalized.transcriptionError = null;
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
    for (const value of [entry.noteIdFallback ?? entry.noteId, entry.createdAt, entry.updatedAt,
      entry.sourceMetadata?.noteId, entry.sourceMetadata?.sectionHeader, entry.sourceMetadata?.audioFilePath]) {
      if (value && /[\r\n]/.test(value)) throw new Error('Note identity and metadata headers must use a single line.');
    }
    const metadata = {
      noteId: entry.noteIdFallback ?? entry.noteId,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
      ...(entry.sourceMetadata ? { sourceMetadata: entry.sourceMetadata } : {}),
    };
    return `- [${metadata.createdAt}] <!-- thought-note:v2 ${JSON.stringify(metadata)} -->\n` +
      entry.text.split('\n').map(line => `  | ${line}`).join('\n') + '\n  <!-- /thought-note -->\n';
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

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_BACKUP_TOPICS = 1000;
const MAX_BACKUP_NOTES = 10000;
const MAX_BACKUP_NOTE_LENGTH = 100000;

function parseLibraryBackup(serializedBackup: string): LibraryBackup {
  if (serializedBackup.length > MAX_BACKUP_BYTES) {
    throw new Error('Backup file is larger than the 10 MB limit.');
  }

  let value: unknown;
  try {
    value = JSON.parse(serializedBackup);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!isRecord(value) || value.format !== 'thought-notes-backup' || value.version !== 1) {
    throw new Error('This is not a supported Thought Notes backup.');
  }
  if (!Array.isArray(value.topics) || value.topics.length > MAX_BACKUP_TOPICS) {
    throw new Error('The backup contains an invalid number of topics.');
  }

  let noteCount = 0;
  const topics = value.topics.map((topicValue, topicIndex): BackupTopic => {
    if (!isRecord(topicValue)) throw new Error(`Backup topic ${topicIndex + 1} is invalid.`);
    const header = requireBackupString(topicValue.header, `topic ${topicIndex + 1}`, 120);
    if (!header.trim()) throw new Error(`Backup topic ${topicIndex + 1} has no name.`);
    if (!Array.isArray(topicValue.notes)) throw new Error(`Backup topic “${header}” has an invalid note list.`);

    const notes = topicValue.notes.map((noteValue, noteIndex): BackupNote => {
      noteCount += 1;
      if (noteCount > MAX_BACKUP_NOTES) throw new Error('The backup contains too many notes.');
      if (!isRecord(noteValue)) throw new Error(`A note in “${header}” is invalid.`);
      const noteId = requireBackupString(noteValue.noteId, `note ${noteIndex + 1} id`, 200);
      const text = requireBackupString(noteValue.text, `note ${noteIndex + 1}`, MAX_BACKUP_NOTE_LENGTH, true);
      if (!noteId.trim() || !text.trim()) throw new Error(`A note in “${header}” is empty.`);

      const createdAt = optionalBackupString(noteValue.createdAt, 'created time', 100);
      const updatedAt = optionalBackupString(noteValue.updatedAt, 'updated time', 100);
      let sourceMetadata: BackupNote['sourceMetadata'];
      if (noteValue.sourceMetadata !== undefined) {
        if (!isRecord(noteValue.sourceMetadata)) throw new Error(`Source details for a note in “${header}” are invalid.`);
        const kind = noteValue.sourceMetadata.kind;
        if (kind !== undefined && kind !== 'voice' && kind !== 'text' && kind !== 'image') {
          throw new Error(`Source type for a note in “${header}” is invalid.`);
        }
        const transcript = optionalBackupString(noteValue.sourceMetadata.transcript, 'transcript', MAX_BACKUP_NOTE_LENGTH, true);
        const sourceNoteId = optionalBackupString(noteValue.sourceMetadata.noteId, 'source note id', 200);
        const sourceTopic = optionalBackupString(noteValue.sourceMetadata.sectionHeader, 'source topic', 120);
        const sourceText = optionalBackupString(noteValue.sourceMetadata.text, 'source text', MAX_BACKUP_NOTE_LENGTH, true);
        const transcriptionError = optionalBackupString(noteValue.sourceMetadata.transcriptionError, 'transcription error', MAX_BACKUP_NOTE_LENGTH, true);
        sourceMetadata = {
          ...(kind ? { kind } : {}),
          ...(transcript ? { transcript } : {}),
          ...(sourceNoteId ? { noteId: sourceNoteId } : {}),
          ...(sourceTopic ? { sectionHeader: sourceTopic } : {}),
          ...(sourceText ? { text: sourceText } : {}),
          ...(transcriptionError ? { transcriptionError } : {}),
        };
      }

      return {
        noteId,
        text,
        ...(createdAt ? { createdAt } : {}),
        ...(updatedAt ? { updatedAt } : {}),
        ...(sourceMetadata && Object.keys(sourceMetadata).length ? { sourceMetadata } : {}),
      };
    });

    return { header, notes };
  });

  return {
    format: 'thought-notes-backup',
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    topics,
  };
}

function requireBackupString(value: unknown, label: string, maxLength: number, multiline = false): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || (!multiline && /[\r\n]/.test(value))) {
    throw new Error(`Backup ${label} is invalid.`);
  }
  return value;
}

function optionalBackupString(value: unknown, label: string, maxLength: number, multiline = false): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requireBackupString(value, label, maxLength, multiline);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hashBackupNote(topic: string, note: BackupNote): string {
  const value = `${topic}\0${note.noteId}\0${note.createdAt ?? ''}\0${note.text}`;
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 4294967296;
  }
  return Math.floor(hash).toString(36);
}
