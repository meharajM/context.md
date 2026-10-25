import {
  MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES,
  type DeviceReadinessAssessment,
} from '../../modules/DeviceReadiness';

interface ModelOption {
  id: string;
  sizeInBytes: number;
  minDeviceMemoryInGb: number;
  recommended?: boolean;
}

export function recommendModelId(
  models: ModelOption[],
  readiness: DeviceReadinessAssessment | null,
): string | null {
  if (!readiness?.checkAvailable || readiness.totalMemoryBytes === null) {
    return null;
  }

  const compatibleModels = models
    .filter(model => model.minDeviceMemoryInGb * 1024 ** 3 <= readiness.totalMemoryBytes!)
    .filter(model =>
      readiness.freeStorageBytes === null ||
      readiness.freeStorageBytes >= model.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES,
    )
    .sort((first, second) =>
      first.minDeviceMemoryInGb - second.minDeviceMemoryInGb || first.sizeInBytes - second.sizeInBytes,
    );

  return compatibleModels[0]?.id ?? null;
}

export function closestModelId(models: ModelOption[]): string | null {
  return [...models]
    .sort((first, second) =>
      first.minDeviceMemoryInGb - second.minDeviceMemoryInGb || first.sizeInBytes - second.sizeInBytes,
    )[0]?.id ?? null;
}
