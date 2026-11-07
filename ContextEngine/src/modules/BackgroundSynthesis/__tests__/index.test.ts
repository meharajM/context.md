import { NativeModules, Platform } from 'react-native';

import {
  reportQueuedSynthesisResult,
  scheduleQueuedSynthesis,
  takePendingBackgroundSynthesisRequest,
} from '../index';

describe('scheduleQueuedSynthesis', () => {
  const originalPlatform = Platform.OS;
  const nativeModule = NativeModules.BackgroundSynthesisModule as {
    scheduleQueuedSynthesis: jest.Mock;
    reportQueuedSynthesisResult: jest.Mock;
  };
  const iosNativeModule = NativeModules.EventEmitter as {
    scheduleQueuedSynthesis: jest.Mock;
    takePendingBackgroundSynthesisRequest: jest.Mock;
    reportQueuedSynthesisResult: jest.Mock;
  };

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    nativeModule.scheduleQueuedSynthesis.mockReset().mockResolvedValue(true);
    nativeModule.reportQueuedSynthesisResult.mockReset().mockResolvedValue(true);
    iosNativeModule.scheduleQueuedSynthesis.mockReset().mockResolvedValue(true);
    iosNativeModule.takePendingBackgroundSynthesisRequest.mockReset().mockResolvedValue(true);
    iosNativeModule.reportQueuedSynthesisResult.mockReset().mockResolvedValue(true);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('asks Android to schedule resource-blocked synthesis', async () => {
    await expect(scheduleQueuedSynthesis()).resolves.toBe(true);
    expect(nativeModule.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
  });

  it('uses BGProcessingTask scheduling on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await expect(scheduleQueuedSynthesis()).resolves.toBe(true);
    expect(nativeModule.scheduleQueuedSynthesis).not.toHaveBeenCalled();
    expect(iosNativeModule.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
  });

  it('keeps the note recoverable when WorkManager cannot accept the job', async () => {
    nativeModule.scheduleQueuedSynthesis.mockRejectedValueOnce(new Error('WorkManager unavailable'));

    await expect(scheduleQueuedSynthesis()).resolves.toBe(false);
  });

  it('reports whether the headless task needs WorkManager to retry', async () => {
    await expect(reportQueuedSynthesisResult(true, 'worker-1')).resolves.toBe(true);
    expect(nativeModule.reportQueuedSynthesisResult).toHaveBeenCalledWith(true, 'worker-1');
  });

  it('reads and reports iOS background-task results through EventEmitter', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await expect(takePendingBackgroundSynthesisRequest()).resolves.toBe(true);
    await expect(reportQueuedSynthesisResult(false)).resolves.toBe(true);
    expect(nativeModule.reportQueuedSynthesisResult).not.toHaveBeenCalled();
    expect(iosNativeModule.takePendingBackgroundSynthesisRequest).toHaveBeenCalledTimes(1);
    expect(iosNativeModule.reportQueuedSynthesisResult).toHaveBeenCalledWith(false);
  });
});
