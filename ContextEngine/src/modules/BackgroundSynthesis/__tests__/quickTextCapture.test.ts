import { NativeModules, Platform } from 'react-native';

import { ContextManager } from '../../ContextManager';
import { drainQuickTextOutbox } from '../quickTextCapture';

const entry = { noteId: 'quick-text-12345678-1234-1234-1234-123456789abc', text: 'Thought from widget', createdAt: 1730000000000 };
const native = { readQuickTextOutbox: jest.fn(), acknowledgeQuickText: jest.fn() };

describe('durable quick text capture', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
    NativeModules.BackgroundSynthesisModule = native;
    native.readQuickTextOutbox.mockResolvedValue([entry]);
    native.acknowledgeQuickText.mockResolvedValue(true);
    jest.spyOn(ContextManager, 'readContext').mockResolvedValue([]);
    jest.spyOn(ContextManager, 'appendThought').mockResolvedValue(undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

  it('acknowledges only after the stable Inbox write finishes', async () => {
    let finishWrite: () => void = () => {};
    jest.spyOn(ContextManager, 'appendThought').mockImplementationOnce(() => new Promise(resolve => { finishWrite = resolve; }));
    const draining = drainQuickTextOutbox();
    await new Promise(resolve => setImmediate(resolve));
    expect(native.acknowledgeQuickText).not.toHaveBeenCalled();
    finishWrite();
    await expect(draining).resolves.toBe(1);
    expect(ContextManager.appendThought).toHaveBeenCalledWith('Inbox', entry.text, {
      noteId: entry.noteId, createdAt: new Date(entry.createdAt).toISOString(), sourceKind: 'text', sourceTranscript: entry.text,
    });
    expect(native.acknowledgeQuickText).toHaveBeenCalledWith(entry.noteId);
  });

  it('leaves the native copy intact when Inbox writing fails', async () => {
    jest.spyOn(ContextManager, 'appendThought').mockRejectedValueOnce(new Error('disk full'));
    await expect(drainQuickTextOutbox()).rejects.toThrow('disk full');
    expect(native.acknowledgeQuickText).not.toHaveBeenCalled();
  });

  it('does not recreate a note already filed before an interrupted acknowledgement', async () => {
    jest.spyOn(ContextManager, 'readContext').mockResolvedValue([{ header: 'Work', content: 'saved' }]);
    jest.spyOn(ContextManager, 'getThoughtsFromSection').mockReturnValue([{
      noteId: entry.noteId, id: 'id', sectionHeader: 'Work', text: entry.text,
    }]);
    await expect(drainQuickTextOutbox()).resolves.toBe(1);
    expect(ContextManager.appendThought).not.toHaveBeenCalled();
    expect(native.acknowledgeQuickText).toHaveBeenCalledWith(entry.noteId);
  });

  it('shares one drain when foreground launch and headless task overlap', async () => {
    const first = drainQuickTextOutbox();
    expect(drainQuickTextOutbox()).toBe(first);
    await first;
    expect(native.readQuickTextOutbox).toHaveBeenCalledTimes(1);
    expect(ContextManager.appendThought).toHaveBeenCalledTimes(1);
  });

  it('retains malformed entries instead of acknowledging them', async () => {
    native.readQuickTextOutbox.mockResolvedValueOnce([{ ...entry, noteId: '../invalid' }]);
    await expect(drainQuickTextOutbox()).rejects.toThrow('Invalid saved quick text');
    expect(native.acknowledgeQuickText).not.toHaveBeenCalled();
    expect(ContextManager.appendThought).not.toHaveBeenCalled();
  });

  it('imports replies in native capture order with their original timestamps', async () => {
    const later = { ...entry, noteId: 'quick-text-12345678-1234-1234-1234-123456789abd', text: 'Later', createdAt: entry.createdAt + 1000 };
    native.readQuickTextOutbox.mockResolvedValueOnce([entry, later]);
    await expect(drainQuickTextOutbox()).resolves.toBe(2);
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(1, 'Inbox', entry.text,
      expect.objectContaining({ createdAt: new Date(entry.createdAt).toISOString() }));
    expect(ContextManager.appendThought).toHaveBeenNthCalledWith(2, 'Inbox', later.text,
      expect.objectContaining({ createdAt: new Date(later.createdAt).toISOString() }));
  });

  it('does nothing on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(drainQuickTextOutbox()).resolves.toBe(0);
    expect(native.readQuickTextOutbox).not.toHaveBeenCalled();
  });
});
