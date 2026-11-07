const mockLoadContext = jest.fn<Promise<void>, []>();
const mockRefreshDeviceReadiness = jest.fn<Promise<any>, []>();
const mockQueueInboxForSynthesis = jest.fn<Promise<number>, [options?: { announce?: boolean }]>();
const mockInitializeEngine = jest.fn<Promise<void>, [options?: { eagerAudio?: boolean; eagerSynthesis?: boolean }]>();
const mockRetryRetainedInboxAudio = jest.fn<Promise<{ recovered: number; hasMore: boolean }>, [options?: { queueSynthesis?: boolean }]>();
const mockHydratePreferences = jest.fn<Promise<void>, []>();
const mockRefreshModels = jest.fn<Promise<void>, []>();
const mockDownloadModel = jest.fn<Promise<void>, [modelId: string, waitForActive?: boolean]>();
const mockDownloadWhisperModel = jest.fn<Promise<void>, [waitForActive?: boolean]>();
const mockRecoverInterruptedRecordings = jest.fn<Promise<number>, []>();
const mockModels: Array<{ id: string; installed: boolean }> = [];
const mockAudioReadiness = { transcriptionReady: true };

jest.mock('../../../core/store', () => ({
  useAppStore: {
    getState: () => ({
      loadContext: mockLoadContext,
      refreshDeviceReadiness: mockRefreshDeviceReadiness,
      queueInboxForSynthesis: mockQueueInboxForSynthesis,
      initializeEngine: mockInitializeEngine,
      retryRetainedInboxAudio: mockRetryRetainedInboxAudio,
      hydratePreferences: mockHydratePreferences,
      refreshModels: mockRefreshModels,
      downloadModel: mockDownloadModel,
      downloadWhisperModel: mockDownloadWhisperModel,
      models: mockModels,
      audioReadiness: mockAudioReadiness,
      recoverInterruptedRecordings: mockRecoverInterruptedRecordings,
    }),
  },
}));

jest.mock('../quickTextCapture', () => ({ drainQuickTextOutbox: jest.fn().mockResolvedValue(0) }));
jest.mock('../../AutomaticReminders', () => ({
  getReminderState: jest.fn(),
  scanAutomaticReminders: jest.fn(),
}));

import { getReminderState, scanAutomaticReminders } from '../../AutomaticReminders';
import { drainQuickTextOutbox } from '../quickTextCapture';
import { ContextManager } from '../../ContextManager';
import { ProcessingQueueManager } from '../../SynthesisEngine/ProcessingQueueManager';
import { SynthesisService } from '../../SynthesisEngine/SynthesisService';
import * as BackgroundSynthesis from '../index';
import { runBackgroundSynthesisTask } from '../runBackgroundSynthesisTask';

describe('runBackgroundSynthesisTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadContext.mockResolvedValue(undefined);
    mockRefreshDeviceReadiness.mockResolvedValue({
      meetsSynthesisMinimum: true,
      resourcesAvailable: true,
    });
    mockQueueInboxForSynthesis.mockResolvedValue(1);
    mockInitializeEngine.mockResolvedValue(undefined);
    mockRetryRetainedInboxAudio.mockResolvedValue({ recovered: 0, hasMore: false });
    mockHydratePreferences.mockResolvedValue(undefined);
    mockRefreshModels.mockResolvedValue(undefined);
    mockDownloadModel.mockResolvedValue(undefined);
    mockDownloadWhisperModel.mockResolvedValue(undefined);
    mockModels.splice(0);
    mockAudioReadiness.transcriptionReady = true;
    mockRecoverInterruptedRecordings.mockResolvedValue(0);
    (getReminderState as jest.Mock).mockResolvedValue({ enabled: false, enabledAt: 0, records: [] });
    (scanAutomaticReminders as jest.Mock).mockResolvedValue(true);
    jest.spyOn(ContextManager, 'setPath').mockImplementation(() => undefined);
    jest.spyOn(ProcessingQueueManager, 'waitUntilSettled').mockResolvedValue('idle');
    jest.spyOn(ProcessingQueueManager, 'getState').mockReturnValue({
      pendingCount: 0,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
      blockedReason: null,
      clarification: null,
    });
    jest.spyOn(SynthesisService, 'getLiteRtReadiness').mockReturnValue({
      available: true,
      status: 'ready',
      detail: 'ready',
    });
    jest.spyOn(BackgroundSynthesis, 'scheduleQueuedSynthesis').mockResolvedValue(true);
    jest.spyOn(BackgroundSynthesis, 'reportQueuedSynthesisResult').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does no cold reminder capture or model work when the toggle is off', async () => {
    await runBackgroundSynthesisTask({ automaticRemindersOnly: true });
    expect(drainQuickTextOutbox).not.toHaveBeenCalled();
    expect(mockInitializeEngine).not.toHaveBeenCalled();
    expect(scanAutomaticReminders).not.toHaveBeenCalled();
  });

  it('drains widget text before waiting for background Whisper and synthesis model downloads', async () => {
    const modelId = 'gemma3-1b-it';
    mockModels.push({ id: modelId, installed: false });
    mockAudioReadiness.transcriptionReady = false;
    mockDownloadWhisperModel.mockImplementationOnce(async waitForActive => {
      expect(waitForActive).toBe(true);
      mockAudioReadiness.transcriptionReady = true;
    });
    mockDownloadModel.mockImplementationOnce(async (requestedModelId, waitForActive) => {
      expect(requestedModelId).toBe(modelId);
      expect(waitForActive).toBe(true);
      mockModels[0].installed = true;
    });

    await runBackgroundSynthesisTask({
      synthesisModelId: modelId,
      downloadWhisperModel: true,
    });

    expect(drainQuickTextOutbox).toHaveBeenCalledTimes(1);
    expect((drainQuickTextOutbox as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      mockDownloadWhisperModel.mock.invocationCallOrder[0],
    );
    expect(mockDownloadModel).toHaveBeenCalledWith(modelId, true);
    expect(mockRefreshModels).toHaveBeenCalledTimes(2);
    expect(mockQueueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('handles cold widget reminders without starting ordinary topic organization', async () => {
    (getReminderState as jest.Mock).mockResolvedValue({ enabled: true, enabledAt: 1, records: [] });
    await runBackgroundSynthesisTask({ automaticRemindersOnly: true });
    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: false });
    expect(scanAutomaticReminders).toHaveBeenCalledWith(true);
    expect((scanAutomaticReminders as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan(mockRetryRetainedInboxAudio.mock.invocationCallOrder[0]);
    expect(mockQueueInboxForSynthesis).not.toHaveBeenCalled();
    expect(mockInitializeEngine).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.waitUntilSettled).not.toHaveBeenCalled();
  });

  it('synthesizes widget text drained by a reminder task', async () => {
    (getReminderState as jest.Mock).mockResolvedValue({ enabled: true, enabledAt: 1, records: [] });
    (drainQuickTextOutbox as jest.Mock).mockResolvedValueOnce(1);

    await runBackgroundSynthesisTask({ automaticRemindersOnly: true });

    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: true });
    expect(mockQueueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(ProcessingQueueManager.waitUntilSettled).toHaveBeenCalled();
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('synthesizes voice recovered by a reminder task', async () => {
    (getReminderState as jest.Mock).mockResolvedValue({ enabled: true, enabledAt: 1, records: [] });
    mockRetryRetainedInboxAudio.mockResolvedValueOnce({ recovered: 1, hasMore: false });

    await runBackgroundSynthesisTask({ automaticRemindersOnly: true });

    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: false });
    expect(mockQueueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(ProcessingQueueManager.waitUntilSettled).toHaveBeenCalled();
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('transcribes a user capture despite synthesis memory pressure, then queues organization separately', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      meetsSynthesisMinimum: true,
      resourcesAvailable: false,
      lowMemory: false,
      thermalState: 'nominal',
    });
    mockRetryRetainedInboxAudio.mockResolvedValueOnce({ recovered: 1, hasMore: false });

    await runBackgroundSynthesisTask({ captureProcessing: true, backgroundWorkId: 'capture-1' });

    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: false });
    expect(mockQueueInboxForSynthesis).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false, 'capture-1');
  });

  it('retries capture work deferred by system memory or thermal pressure', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      resourcesAvailable: false,
      lowMemory: true,
      thermalState: 'critical',
    });

    await runBackgroundSynthesisTask({ captureProcessing: true, backgroundWorkId: 'capture-deferred' });

    expect(mockRetryRetainedInboxAudio).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(true, 'capture-deferred');
  });

  it('retries reminder work separately when resources are unavailable', async () => {
    (getReminderState as jest.Mock).mockResolvedValue({ enabled: true, enabledAt: 1, records: [] });
    mockRefreshDeviceReadiness.mockResolvedValue({ resourcesAvailable: false, meetsSynthesisMinimum: false });
    await runBackgroundSynthesisTask({ automaticRemindersOnly: true });
    expect(scanAutomaticReminders).toHaveBeenCalledWith(false);
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(true);
  });

  it('keeps retrying below the model baseline when current resources are unavailable', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      meetsSynthesisMinimum: false,
      resourcesAvailable: false,
    });
    jest.spyOn(ProcessingQueueManager, 'waitUntilSettled').mockResolvedValueOnce('blocked');
    jest.spyOn(ProcessingQueueManager, 'getState').mockReturnValueOnce({
      pendingCount: 1,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
      blockedReason: 'Waiting for device resources: available memory is low',
      clarification: null,
    });

    await runBackgroundSynthesisTask();

    expect(drainQuickTextOutbox).toHaveBeenCalledTimes(1);
    expect(mockLoadContext).toHaveBeenCalledTimes(1);
    expect(mockQueueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(mockRetryRetainedInboxAudio).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.waitUntilSettled).toHaveBeenCalled();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('requeues temporary resource pressure after the headless queue settles blocked', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      meetsSynthesisMinimum: true,
      resourcesAvailable: false,
    });
    jest.spyOn(ProcessingQueueManager, 'waitUntilSettled').mockResolvedValueOnce('blocked');
    jest.spyOn(ProcessingQueueManager, 'getState').mockReturnValueOnce({
      pendingCount: 1,
      isProcessing: false,
      currentThoughtId: null,
      lastError: null,
      blockedReason: 'Waiting for device resources: available memory is low',
      clarification: null,
    });

    await runBackgroundSynthesisTask();

    expect(ContextManager.setPath).toHaveBeenCalledWith('/mock/path/topics', {
      legacyPath: '/mock/path/context.md',
    });
    expect(mockQueueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(mockRetryRetainedInboxAudio).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('initializes local synthesis without audio when the runtime is not ready', async () => {
    jest.spyOn(SynthesisService, 'getLiteRtReadiness').mockReturnValueOnce({
      available: false,
      status: 'unavailable',
      detail: 'missing model',
    });

    await runBackgroundSynthesisTask();

    expect(mockInitializeEngine).toHaveBeenCalledWith({
      eagerAudio: false,
      eagerSynthesis: true,
    });
    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: true });
    expect(mockQueueInboxForSynthesis).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.waitUntilSettled).toHaveBeenCalled();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('synthesizes below the model baseline when current resources are healthy', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      meetsSynthesisMinimum: false,
      resourcesAvailable: true,
    });

    await runBackgroundSynthesisTask();

    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: true });
    expect(mockInitializeEngine).not.toHaveBeenCalled();
    expect(mockQueueInboxForSynthesis).toHaveBeenCalledWith({ announce: false });
    expect(ProcessingQueueManager.waitUntilSettled).toHaveBeenCalled();
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('continues remaining audio even below the synthesis RAM baseline', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({ meetsSynthesisMinimum: false, resourcesAvailable: true });
    mockRetryRetainedInboxAudio.mockResolvedValueOnce({ recovered: 0, hasMore: true });
    await runBackgroundSynthesisTask();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });

  it('deducts recovery time from the synthesis wait budget', async () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockRetryRetainedInboxAudio.mockImplementationOnce(async () => {
      now += 120000;
      return { recovered: 1, hasMore: true };
    });
    await runBackgroundSynthesisTask();
    expect(ProcessingQueueManager.waitUntilSettled).toHaveBeenCalledWith(330000);
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
  });

  it('asks WorkManager to retry when queue timeout cannot be rescheduled', async () => {
    jest.spyOn(ProcessingQueueManager, 'waitUntilSettled').mockResolvedValueOnce('timeout');
    jest.spyOn(BackgroundSynthesis, 'scheduleQueuedSynthesis').mockResolvedValueOnce(false);

    await runBackgroundSynthesisTask();

    expect(BackgroundSynthesis.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
    expect(BackgroundSynthesis.reportQueuedSynthesisResult).toHaveBeenCalledWith(true);
  });
});
