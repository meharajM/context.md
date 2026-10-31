import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

import { ContextManager, type ContextThought } from '../ContextManager';
import { SynthesisService } from '../SynthesisEngine/SynthesisService';
import {
  buildReminderPrompt, hasExplicitDeadline, hasTimeCue, inferReminderLocally, isCompletedOrNegated, noteFingerprint, parseReminderSuggestion, planReminder,
} from './planning';

interface ReminderRecord {
  noteId: string;
  fingerprint: string;
  inferredWithAi: boolean;
  status: 'none' | 'scheduled' | 'delivered' | 'done';
}
export interface ReminderState {
  enabled: boolean;
  enabledAt: number;
  records: ReminderRecord[];
}
interface ReminderNative {
  getState(): Promise<string>;
  setEnabled(enabled: boolean): Promise<string>;
  reconcileNote(noteId: string, fingerprint: string, enabledAt: number, ai: boolean, plan: string): Promise<boolean>;
  cancelMissingNotes(ids: string[], enabledAt: number): Promise<boolean>;
}
const native = (): ReminderNative | undefined => Platform.OS === 'android'
  ? NativeModules.AutomaticReminderModule : undefined;
let running: Promise<boolean> | null = null;
let requested = 0;
let allowModel = true;

export const isAutomaticReminderSupported = () => Boolean(native());
function decodeState(raw: string): ReminderState {
  const state = JSON.parse(raw);
  if (typeof state.enabled !== 'boolean' || !Number.isSafeInteger(state.enabledAt) ||
      state.enabledAt < 0 || !Array.isArray(state.records)) throw new Error('Saved reminder settings could not be read.');
  return state;
}
export async function getReminderState(): Promise<ReminderState> {
  return native() ? decodeState(await native()!.getState()) : { enabled: false, enabledAt: 0, records: [] };
}
export async function setAutomaticRemindersEnabled(enabled: boolean): Promise<ReminderState> {
  const bridge = native();
  if (!bridge) throw new Error('Automatic reminders are available on Android.');
  if (enabled && Number(Platform.Version) >= 33 &&
      !(await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS))) {
    const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
      title: 'Allow task reminders',
      message: 'Thought Notes can notify you about tasks found in your notes.',
      buttonPositive: 'Continue',
    });
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Allow notifications in Android Settings to use automatic reminders.');
    }
  }
  const result = decodeState(await bridge.setEnabled(enabled));
  requested++;
  if (enabled) void scanAutomaticReminders();
  return result;
}

async function readNotes(): Promise<ContextThought[]> {
  const sections = await ContextManager.readContext();
  const unique = new Map<string, ContextThought>();
  sections.forEach(section => ContextManager.getThoughtsFromSection(section).forEach(note => {
    if (!unique.has(note.noteId)) unique.set(note.noteId, note);
  }));
  return [...unique.values()];
}
async function cancelDeletedNotes(): Promise<void> {
  const bridge = native();
  if (!bridge) return;
  const state = await getReminderState();
  if (state.enabled) await bridge.cancelMissingNotes((await readNotes()).map(note => note.noteId), state.enabledAt);
}

/** Reminder failures are contained here, after durable note storage. */
export function scanAutomaticReminders(modelAllowed = true): Promise<boolean> {
  if (!native()) return Promise.resolve(true);
  allowModel = modelAllowed;
  requested++;
  // Cancellation must not wait behind an in-flight model inference.
  void cancelDeletedNotes().catch(error => console.warn('Reminder cancellation will retry:', error));
  if (running) return running;
  running = (async () => {
    let completed = true;
    let processed = -1;
    while (processed !== requested) {
      processed = requested;
      try {
        const bridge = native()!;
        const state = await getReminderState();
        if (!state.enabled) continue;
        const notes = await readNotes();
        await bridge.cancelMissingNotes(notes.map(note => note.noteId), state.enabledAt);
        for (const note of notes) {
          if (processed !== requested) break;
          const createdAt = Date.parse(note.createdAt ?? '');
          if (!Number.isFinite(createdAt) || createdAt < state.enabledAt || !note.text.trim() ||
              note.sourceMetadata?.audioFilePath || note.sourceMetadata?.transcriptionError) continue;
          const text = note.text.trim();
          const fingerprint = noteFingerprint(text);
          const previous = state.records.find(record => record.noteId === note.noteId);
          if (previous?.fingerprint === fingerprint && (previous.inferredWithAi ||
              ['done', 'delivered'].includes(previous.status) ||
              !allowModel || !SynthesisService.getLiteRtReadiness()?.available)) continue;
          const capturedAt = createdAt;
          if (isCompletedOrNegated(text)) {
            await bridge.reconcileNote(note.noteId, fingerprint, state.enabledAt, true, '');
            continue;
          }
          const fallback = inferReminderLocally(text);
          const fallbackPlan = planReminder(fallback, capturedAt);
          if (fallbackPlan) await bridge.reconcileNote(note.noteId, fingerprint, state.enabledAt, false, JSON.stringify(fallbackPlan));
          if (processed !== requested) break;
          let suggestion = fallback;
          let inferredWithAi = false;
          if (allowModel) {
            try {
              const raw = await SynthesisService.extractReminder(buildReminderPrompt(text, capturedAt));
              const parsed = raw ? parseReminderSuggestion(raw) : null;
              if (parsed) {
                suggestion = {
                  ...parsed,
                  day: fallback.day ?? parsed.day,
                  time: fallback.time ?? (hasTimeCue(text) ? parsed.time : undefined),
                  deadline: hasExplicitDeadline(text),
                };
                inferredWithAi = true;
              }
            } catch (error) {
              console.warn('Local reminder inference deferred; explicit tasks keep their local defaults:', error);
            }
          }
          if (processed !== requested) break;
          const plan = planReminder(suggestion, capturedAt) ?? fallbackPlan;
          const saved = await bridge.reconcileNote(note.noteId, fingerprint, state.enabledAt, inferredWithAi, plan ? JSON.stringify(plan) : '');
          if (!saved) break;
        }
      } catch (error) {
        completed = false;
        console.warn('Automatic reminders will retry; notes remain saved:', error);
      }
    }
    return completed;
  })().finally(() => { running = null; });
  return running;
}
