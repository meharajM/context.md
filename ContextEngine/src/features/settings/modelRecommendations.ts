import {
  MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES,
  type DeviceReadinessAssessment,
} from '../../modules/DeviceReadiness';

interface ModelOption {
  id: string;
  sizeInBytes: number;
  minDeviceMemoryInGb: number;
  supportsAudio?: boolean;
  recommendedForMultilingualText?: boolean;
  recommended?: boolean;
}

export function recommendModelId(
  models: ModelOption[],
  readiness: DeviceReadinessAssessment | null,
  preferUnifiedAudio = false,
): string | null {
  if (!readiness?.checkAvailable || readiness.totalMemoryBytes === null || readiness.freeStorageBytes === null) {
    return null;
  }

  const compatibleModels = models
    .filter(model => model.minDeviceMemoryInGb * 1024 ** 3 <= readiness.totalMemoryBytes!)
    .filter(model => readiness.freeStorageBytes! >= model.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES)
    .sort((first, second) =>
      first.minDeviceMemoryInGb - second.minDeviceMemoryInGb || first.sizeInBytes - second.sizeInBytes,
    );

  if (preferUnifiedAudio && !readiness.isSimulator) {
    const audioModel = compatibleModels.find(model => model.supportsAudio);
    if (audioModel && readiness.freeStorageBytes !== null &&
      readiness.freeStorageBytes >= audioModel.sizeInBytes + MODEL_DOWNLOAD_STORAGE_HEADROOM_BYTES) {
      return audioModel.id;
    }
  }

  if (!readiness.isSimulator) {
    const multilingualTextModel = compatibleModels
      .filter(model => model.recommendedForMultilingualText && !model.supportsAudio)
      .sort((first, second) =>
        second.minDeviceMemoryInGb - first.minDeviceMemoryInGb || second.sizeInBytes - first.sizeInBytes,
      )[0];
    if (multilingualTextModel) return multilingualTextModel.id;
  }

  return compatibleModels[0]?.id ?? null;
}

export function closestModelId(models: ModelOption[]): string | null {
  return [...models]
    .sort((first, second) =>
      first.minDeviceMemoryInGb - second.minDeviceMemoryInGb || first.sizeInBytes - second.sizeInBytes,
    )[0]?.id ?? null;
}
