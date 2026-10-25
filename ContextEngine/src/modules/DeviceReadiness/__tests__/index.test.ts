import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

import {
  assessDeviceReadiness,
  SYNTHESIS_MINIMUM_AVAILABLE_RAM_BYTES,
  SYNTHESIS_MINIMUM_RAM_GB,
} from '..';

const nativeReadiness = NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock;
const gibibyte = 1024 ** 3;

describe('device readiness assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nativeReadiness.mockResolvedValue({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 6 * gibibyte,
      availableMemoryBytes: 2 * gibibyte,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
      apiLevel: 36,
    });
    (RNFS.getFSInfo as jest.Mock).mockResolvedValue({ freeSpace: 8 * gibibyte, totalSpace: 64 * gibibyte });
  });

  it('marks a device ready when it meets the model memory baseline and resources are free', async () => {
    const readiness = await assessDeviceReadiness();

    expect(readiness).toMatchObject({
      checkAvailable: true,
      meetsSynthesisMinimum: true,
      resourcesAvailable: true,
      reason: 'ready',
      apiLevel: 36,
      freeStorageBytes: 8 * gibibyte,
    });
    expect(readiness.minimumMemoryBytes).toBe(SYNTHESIS_MINIMUM_RAM_GB * gibibyte);
  });

  it('keeps the model RAM baseline separate from temporary resource pressure', async () => {
    nativeReadiness.mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 3 * gibibyte,
      availableMemoryBytes: 2 * gibibyte,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
    });
    const belowMinimum = await assessDeviceReadiness();

    nativeReadiness.mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: false,
      totalMemoryBytes: 6 * gibibyte,
      availableMemoryBytes: SYNTHESIS_MINIMUM_AVAILABLE_RAM_BYTES - 1,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
    });
    const temporarilyBusy = await assessDeviceReadiness();

    expect(belowMinimum).toMatchObject({ meetsSynthesisMinimum: false, resourcesAvailable: true, reason: 'minimum-memory' });
    expect(temporarilyBusy).toMatchObject({ meetsSynthesisMinimum: true, resourcesAvailable: false, reason: 'low-memory' });
  });

  it('does not report a physical-device requirement result on a simulator', async () => {
    nativeReadiness.mockResolvedValueOnce({ checkAvailable: false, isSimulator: true, osVersion: 'simulator' });

    await expect(assessDeviceReadiness()).resolves.toMatchObject({
      checkAvailable: false,
      isSimulator: true,
      meetsSynthesisMinimum: null,
      resourcesAvailable: null,
      reason: 'unavailable',
    });
  });
});
