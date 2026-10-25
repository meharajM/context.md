import { closestModelId, recommendModelId } from '../modelRecommendations';

const models = [
  { id: 'gemma3-1b-it', sizeInBytes: 584417280, minDeviceMemoryInGb: 4, recommended: true },
  { id: 'gemma4-e2b-it', sizeInBytes: 1620000000, minDeviceMemoryInGb: 6 },
  { id: 'gemma4-e4b-it', sizeInBytes: 3100000000, minDeviceMemoryInGb: 8 },
];

const readiness = (ramGb: number) => ({
  checkAvailable: true,
  isSimulator: false,
  platform: 'android' as const,
  osVersion: '12',
  totalMemoryBytes: ramGb * 1024 ** 3,
  availableMemoryBytes: 1.5 * 1024 ** 3,
  freeStorageBytes: 10 * 1024 ** 3,
  lowMemory: false,
  thermalState: 'nominal' as const,
  minimumMemoryBytes: 4 * 1024 ** 3,
  meetsSynthesisMinimum: ramGb >= 4,
  resourcesAvailable: ramGb >= 4,
  reason: ramGb >= 4 ? 'ready' as const : 'minimum-memory' as const,
});

describe('model recommendations', () => {
  it('does not recommend a model when device RAM is below every catalog minimum', () => {
    expect(recommendModelId(models, readiness(3.5))).toBeNull();
    expect(closestModelId(models)).toBe('gemma3-1b-it');
  });

  it('recommends the smallest compatible model when device RAM meets its minimum', () => {
    expect(recommendModelId(models, readiness(6))).toBe('gemma3-1b-it');
  });

  it('does not claim a resource-based recommendation when the device check is unavailable', () => {
    expect(recommendModelId(models, null)).toBeNull();
  });
});
