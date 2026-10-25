import { NativeModules, Platform } from 'react-native';

import { reportQueuedSynthesisResult, scheduleQueuedSynthesis } from '../index';

describe('scheduleQueuedSynthesis', () => {
  const originalPlatform = Platform.OS;
  const nativeModule = NativeModules.BackgroundSynthesisModule as {
    scheduleQueuedSynthesis: jest.Mock;
    reportQueuedSynthesisResult: jest.Mock;
  };

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    nativeModule.scheduleQueuedSynthesis.mockReset().mockResolvedValue(true);
    nativeModule.reportQueuedSynthesisResult.mockReset().mockResolvedValue(true);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('asks Android to schedule resource-blocked synthesis', async () => {
    await expect(scheduleQueuedSynthesis()).resolves.toBe(true);
    expect(nativeModule.scheduleQueuedSynthesis).toHaveBeenCalledTimes(1);
  });

  it('does not ask iOS to schedule through the Android worker', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await expect(scheduleQueuedSynthesis()).resolves.toBe(false);
    expect(nativeModule.scheduleQueuedSynthesis).not.toHaveBeenCalled();
  });

  it('keeps the note recoverable when WorkManager cannot accept the job', async () => {
    nativeModule.scheduleQueuedSynthesis.mockRejectedValueOnce(new Error('WorkManager unavailable'));

    await expect(scheduleQueuedSynthesis()).resolves.toBe(false);
  });

  it('reports whether the headless task needs WorkManager to retry', async () => {
    await expect(reportQueuedSynthesisResult(true)).resolves.toBe(true);
    expect(nativeModule.reportQueuedSynthesisResult).toHaveBeenCalledWith(true);
  });

  it('does not send Android task results from iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await expect(reportQueuedSynthesisResult(false)).resolves.toBe(false);
    expect(nativeModule.reportQueuedSynthesisResult).not.toHaveBeenCalled();
  });
});
