const mockLoadContext = jest.fn<Promise<void>, []>();
const mockRefreshDeviceReadiness = jest.fn<Promise<any>, []>();
const mockQueueInboxForSynthesis = jest.fn<Promise<number>, [options?: { announce?: boolean }]>();
const mockInitializeEngine = jest.fn<Promise<void>, [options?: { eagerAudio?: boolean; eagerSynthesis?: boolean }]>();
const mockRetryRetainedInboxAudio = jest.fn<Promise<{ recovered: number; hasMore: boolean }>, [options?: { queueSynthesis?: boolean }]>();
const mockHydratePreferences = jest.fn<Promise<void>, []>();
const mockRecoverInterruptedRecordings = jest.fn<Promise<number>, []>();

jest.mock('../../../core/store', () => ({
  useAppStore: {
    getState: () => ({
      loadContext: mockLoadContext,
      refreshDeviceReadiness: mockRefreshDeviceReadiness,
      queueInboxForSynthesis: mockQueueInboxForSynthesis,
      initializeEngine: mockInitializeEngine,
      retryRetainedInboxAudio: mockRetryRetainedInboxAudio,
      hydratePreferences: mockHydratePreferences,
      recoverInterruptedRecordings: mockRecoverInterruptedRecordings,
    }),
  },
}));

jest.mock('../quickTextCapture', () => ({ drainQuickTextOutbox: jest.fn().mockResolvedValue(0) }));

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
    mockRecoverInterruptedRecordings.mockResolvedValue(0);
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

  it('leaves Inbox untouched by synthesis when the device is below the model baseline', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      meetsSynthesisMinimum: false,
      resourcesAvailable: false,
    });

    await runBackgroundSynthesisTask();

    expect(drainQuickTextOutbox).toHaveBeenCalledTimes(1);
    expect(mockLoadContext).toHaveBeenCalledTimes(1);
    expect(mockQueueInboxForSynthesis).not.toHaveBeenCalled();
    expect(mockRetryRetainedInboxAudio).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.waitUntilSettled).not.toHaveBeenCalled();
    expect(BackgroundSynthesis.scheduleQueuedSynthesis).not.toHaveBeenCalled();
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

  it('recovers retained audio without synthesis below the model baseline when current resources are healthy', async () => {
    mockRefreshDeviceReadiness.mockResolvedValueOnce({
      meetsSynthesisMinimum: false,
      resourcesAvailable: true,
    });

    await runBackgroundSynthesisTask();

    expect(mockRetryRetainedInboxAudio).toHaveBeenCalledWith({ queueSynthesis: false });
    expect(mockInitializeEngine).not.toHaveBeenCalled();
    expect(mockQueueInboxForSynthesis).not.toHaveBeenCalled();
    expect(ProcessingQueueManager.waitUntilSettled).not.toHaveBeenCalled();
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
