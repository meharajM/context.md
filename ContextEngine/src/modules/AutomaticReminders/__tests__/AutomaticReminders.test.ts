import { NativeModules, Platform } from 'react-native';
import { ContextManager, type ContextThought } from '../../ContextManager';
import { SynthesisService } from '../../SynthesisEngine/SynthesisService';
import { isAutomaticReminderSupported, scanAutomaticReminders, setAutomaticRemindersEnabled } from '../index';

jest.mock('../../SynthesisEngine/SynthesisService', () => ({
  SynthesisService: { extractReminder: jest.fn(), getLiteRtReadiness: jest.fn() },
}));
const now = new Date(2026, 9, 31, 12).getTime();
let state: any;
let notes: ContextThought[];
const bridge = {
  getState: jest.fn(),
  setEnabled: jest.fn(),
  reconcileNote: jest.fn(),
  cancelMissingNotes: jest.fn(),
};

describe('automatic reminders isolation and durability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: 32 });
    NativeModules.AutomaticReminderModule = bridge;
    state = { enabled: true, enabledAt: now - 1000, records: [] };
    notes = [{ noteId: 'note-eggs', id: 'note-eggs', sectionHeader: 'Inbox', text: 'get eggs today', createdAt: new Date(now).toISOString() }];
    jest.spyOn(ContextManager, 'readContext').mockResolvedValue([{ header: 'Inbox', content: 'fixture' }]);
    jest.spyOn(ContextManager, 'getThoughtsFromSection').mockImplementation(() => notes);
    bridge.getState.mockImplementation(async () => JSON.stringify(state));
    bridge.setEnabled.mockImplementation(async (enabled: boolean) => {
      state = { enabled, enabledAt: enabled ? now + 1 : state.enabledAt, records: [] };
      return JSON.stringify(state);
    });
    bridge.cancelMissingNotes.mockImplementation(async (ids: string[], generation: number) => {
      if (!state.enabled || generation !== state.enabledAt) return false;
      state.records = state.records.filter((row: any) => ids.includes(row.noteId));
      return true;
    });
    bridge.reconcileNote.mockImplementation(async (noteId, fingerprint, generation, inferredWithAi, raw) => {
      if (!state.enabled || generation !== state.enabledAt) return false;
      const row = state.records.find((item: any) => item.noteId === noteId);
      if (row?.fingerprint === fingerprint && (row.inferredWithAi || ['delivered', 'done'].includes(row.status) || !inferredWithAi)) return true;
      state.records = state.records.filter((item: any) => item.noteId !== noteId);
      state.records.push({ noteId, fingerprint, inferredWithAi, status: raw ? 'scheduled' : 'none', ...(raw ? JSON.parse(raw) : {}) });
      return true;
    });
    (SynthesisService.extractReminder as jest.Mock).mockResolvedValue(JSON.stringify({
      task: true, title: 'Buy eggs', category: 'shopping', priority: 'normal', day: 'today', time: 'none',
    }));
    (SynthesisService.getLiteRtReadiness as jest.Mock).mockReturnValue({ available: true });
  });
  afterEach(() => {
    delete NativeModules.AutomaticReminderModule;
    jest.restoreAllMocks();
  });
  it('does no model or scheduling work while disabled', async () => {
    state.enabled = false;
    await expect(scanAutomaticReminders()).resolves.toBe(true);
    expect(SynthesisService.extractReminder).not.toHaveBeenCalled();
    expect(bridge.reconcileNote).not.toHaveBeenCalled();
  });
  it('uses the same local inference path when the iOS native scheduler is available', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    expect(isAutomaticReminderSupported()).toBe(true);
    await scanAutomaticReminders();
    expect(state.records[0]).toMatchObject({ title: 'Buy eggs', category: 'shopping', status: 'scheduled' });
    expect(SynthesisService.extractReminder).toHaveBeenCalledTimes(1);
  });
  it('infers a reminder independently and does not repeat it after reload/topic movement', async () => {
    await scanAutomaticReminders();
    expect(state.records[0]).toMatchObject({ title: 'Buy eggs', category: 'shopping', fireAt: new Date(2026, 9, 31, 19).getTime(), inferredWithAi: true });
    notes[0].sectionHeader = 'Shopping';
    await scanAutomaticReminders();
    expect(SynthesisService.extractReminder).toHaveBeenCalledTimes(1);
    expect(state.records).toHaveLength(1);
  });
  it('uses clear-task defaults without a model and does not replay old restored notes', async () => {
    (SynthesisService.extractReminder as jest.Mock).mockResolvedValue(null);
    notes.push({ ...notes[0], noteId: 'restored', id: 'restored', createdAt: new Date(now - 86400000).toISOString() });
    await scanAutomaticReminders();
    expect(state.records).toHaveLength(1);
    expect(state.records[0]).toMatchObject({ category: 'shopping', inferredWithAi: false, status: 'scheduled' });
  });
  it('keeps a clear captured task scheduled when the model abstains', async () => {
    (SynthesisService.extractReminder as jest.Mock).mockResolvedValue('{"task":false}');
    await scanAutomaticReminders();
    expect(state.records[0]).toMatchObject({ title: 'get eggs today', category: 'shopping', status: 'scheduled' });
  });
  it('does not accept an invented clock time from the model', async () => {
    notes[0].text = 'buy eggs tomorrow';
    (SynthesisService.extractReminder as jest.Mock).mockResolvedValue(JSON.stringify({
      task: true, title: 'Buy eggs', category: 'shopping', priority: 'normal', day: 'tomorrow', time: '00:27',
    }));
    await scanAutomaticReminders();
    expect(state.records[0].fireAt).toBe(new Date(2026, 10, 1, 19).getTime());
  });
  it('suppresses completed notes before model inference', async () => {
    notes[0].text = 'Bought eggs today';
    await scanAutomaticReminders();
    expect(SynthesisService.extractReminder).not.toHaveBeenCalled();
    expect(state.records[0].status).toBe('none');
  });
  it('cancels a removed note and replaces an edited task', async () => {
    await scanAutomaticReminders();
    notes[0].text = 'call Sam tomorrow at 10 am';
    (SynthesisService.extractReminder as jest.Mock).mockResolvedValue('{"task":true,"title":"Call Sam","category":"personal","priority":"normal","day":"tomorrow","time":"10:00"}');
    await scanAutomaticReminders();
    expect(state.records).toHaveLength(1);
    expect(state.records[0].title).toBe('Call Sam');
    notes = [];
    await scanAutomaticReminders();
    expect(state.records).toHaveLength(0);
  });
  it('fences a late AI result after the user disables reminders', async () => {
    let finish!: (value: string) => void;
    let started!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    (SynthesisService.extractReminder as jest.Mock).mockImplementation(() => {
      started(); return new Promise<string>(resolve => { finish = resolve; });
    });
    const scanning = scanAutomaticReminders();
    await began;
    await setAutomaticRemindersEnabled(false);
    finish('{"task":true,"title":"Buy eggs","category":"shopping","priority":"high","day":"today"}');
    await scanning;
    expect(state.enabled).toBe(false);
    expect(state.records).toHaveLength(0);
  });
  it('contains reminder storage failures instead of rejecting the capture caller', async () => {
    bridge.getState.mockRejectedValue(new Error('storage unavailable'));
    await expect(scanAutomaticReminders()).resolves.toBe(false);
    expect(SynthesisService.extractReminder).not.toHaveBeenCalled();
  });
});
