import { NativeModules, Platform } from 'react-native';

import { ContextManager } from '../ContextManager';

interface QuickTextEntry {
  noteId: string;
  text: string;
  createdAt: number;
}

interface QuickTextNativeModule {
  readQuickTextOutbox(): Promise<QuickTextEntry[]>;
  acknowledgeQuickText(noteId: string): Promise<boolean>;
}

let draining: Promise<number> | null = null;

export function drainQuickTextOutbox(): Promise<number> {
  const native = NativeModules.BackgroundSynthesisModule as QuickTextNativeModule | undefined;
  if (Platform.OS !== 'android' || !native?.readQuickTextOutbox) return Promise.resolve(0);
  if (draining) return draining;
  draining = drain(native).finally(() => { draining = null; });
  return draining;
}

async function drain(native: QuickTextNativeModule): Promise<number> {
  const entries = await native.readQuickTextOutbox();
  let saved = 0;
  for (const entry of entries) {
    if (!/^quick-text-[0-9a-f-]{36}$/.test(entry.noteId) || !entry.text.trim() ||
      !Number.isFinite(entry.createdAt) || !Number.isFinite(new Date(entry.createdAt).getTime())) {
      throw new Error('Invalid saved quick text');
    }
    const sections = await ContextManager.readContext();
    const exists = sections.some(section => ContextManager.getThoughtsFromSection(section)
      .some(thought => thought.noteId === entry.noteId));
    if (!exists) {
      await ContextManager.appendThought('Inbox', entry.text, {
        noteId: entry.noteId,
        createdAt: new Date(entry.createdAt).toISOString(),
        sourceKind: 'text',
        sourceTranscript: entry.text,
      });
    }
    // Keep the native copy until its stable identity is durably present in any topic.
    if (!(await native.acknowledgeQuickText(entry.noteId))) {
      throw new Error('Could not acknowledge saved quick text');
    }
    saved += 1;
  }
  return saved;
}
