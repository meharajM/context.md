import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

export const SYNTHESIS_MINIMUM_RAM_GB = 4;
export const SYNTHESIS_MINIMUM_AVAILABLE_RAM_BYTES = 1024 ** 3;
export const RECOMMENDED_FREE_STORAGE_BYTES = 1024 ** 3;
export const MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES = 512 * 1024 ** 2;
const GIGABYTE = 1024 ** 3;
const SEEN_NOTICE_PATH = `${RNFS.DocumentDirectoryPath}/setup/device-readiness-v1.json`;

export type ThermalState = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

interface NativeDeviceReadiness {
  checkAvailable: boolean;
  isSimulator: boolean;
  totalMemoryBytes?: number;
  availableMemoryBytes?: number;
  lowMemory?: boolean;
  thermalState?: ThermalState;
  osVersion?: string;
  apiLevel?: number;
}

export interface DeviceReadinessAssessment {
  checkAvailable: boolean;
  isSimulator: boolean;
  platform: 'ios' | 'android' | 'other';
  osVersion: string;
  apiLevel?: number;
  totalMemoryBytes: number | null;
  availableMemoryBytes: number | null;
  freeStorageBytes: number | null;
  lowMemory: boolean;
  thermalState: ThermalState;
  minimumMemoryBytes: number;
  meetsSynthesisMinimum: boolean | null;
  resourcesAvailable: boolean | null;
  reason: 'ready' | 'minimum-memory' | 'low-memory' | 'thermal' | 'unavailable';
}

interface DeviceReadinessNativeModule {
  getDeviceReadiness(): Promise<NativeDeviceReadiness>;
}

const nativeModule = NativeModules.LiteRtModule as DeviceReadinessNativeModule | undefined;

export async function assessDeviceReadiness(
  minimumMemoryGb = SYNTHESIS_MINIMUM_RAM_GB,
): Promise<DeviceReadinessAssessment> {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other';
  const minimumMemoryBytes = minimumMemoryGb * GIGABYTE;

  try {
    if (!nativeModule?.getDeviceReadiness) {
      return unavailableAssessment(platform, minimumMemoryBytes);
    }

    const [nativeReadiness, fsInfo] = await Promise.all([
      nativeModule.getDeviceReadiness(),
      RNFS.getFSInfo().catch(() => null),
    ]);

    if (!nativeReadiness.checkAvailable) {
      return {
        ...unavailableAssessment(platform, minimumMemoryBytes),
        isSimulator: nativeReadiness.isSimulator,
        osVersion: nativeReadiness.osVersion ?? String(Platform.Version),
        apiLevel: nativeReadiness.apiLevel,
        freeStorageBytes: fsInfo?.freeSpace ?? null,
      };
    }

    const totalMemoryBytes = finiteNumber(nativeReadiness.totalMemoryBytes);
    const availableMemoryBytes = finiteNumber(nativeReadiness.availableMemoryBytes);
    const thermalState = nativeReadiness.thermalState ?? 'unknown';
    const lowMemory = nativeReadiness.lowMemory ?? false;
    const meetsSynthesisMinimum = totalMemoryBytes === null ? null : totalMemoryBytes >= minimumMemoryBytes;
    const thermalBusy = thermalState === 'serious' || thermalState === 'critical';
    const memoryBusy = lowMemory || (
      availableMemoryBytes !== null && availableMemoryBytes < SYNTHESIS_MINIMUM_AVAILABLE_RAM_BYTES
    );
    const resourcesAvailable = !memoryBusy && !thermalBusy;

    return {
      checkAvailable: true,
      isSimulator: nativeReadiness.isSimulator,
      platform,
      osVersion: nativeReadiness.osVersion ?? String(Platform.Version),
      apiLevel: nativeReadiness.apiLevel,
      totalMemoryBytes,
      availableMemoryBytes,
      freeStorageBytes: fsInfo?.freeSpace ?? null,
      lowMemory,
      thermalState,
      minimumMemoryBytes,
      meetsSynthesisMinimum,
      resourcesAvailable,
      reason: !meetsSynthesisMinimum
        ? 'minimum-memory'
        : memoryBusy
          ? 'low-memory'
          : thermalBusy
            ? 'thermal'
            : 'ready',
    };
  } catch {
    return unavailableAssessment(platform, minimumMemoryBytes);
  }
}

export async function hasSeenDeviceReadinessNotice(): Promise<boolean> {
  try {
    return RNFS.exists(SEEN_NOTICE_PATH);
  } catch {
    return false;
  }
}

export async function markDeviceReadinessNoticeSeen(): Promise<void> {
  const directory = `${RNFS.DocumentDirectoryPath}/setup`;
  if (!(await RNFS.exists(directory))) {
    await RNFS.mkdir(directory);
  }
  await RNFS.writeFile(SEEN_NOTICE_PATH, JSON.stringify({ seen: true }), 'utf8');
}

export function formatBytesAsGiB(bytes: number | null): string {
  return bytes === null ? 'Unknown' : `${(bytes / GIGABYTE).toFixed(1)} GB`;
}

const finiteNumber = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const unavailableAssessment = (
  platform: DeviceReadinessAssessment['platform'],
  minimumMemoryBytes: number,
): DeviceReadinessAssessment => ({
  checkAvailable: false,
  isSimulator: false,
  platform,
  osVersion: String(Platform.Version),
  totalMemoryBytes: null,
  availableMemoryBytes: null,
  freeStorageBytes: null,
  lowMemory: false,
  thermalState: 'unknown',
  minimumMemoryBytes,
  meetsSynthesisMinimum: null,
  resourcesAvailable: null,
  reason: 'unavailable',
});
