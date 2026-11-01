import RNFS from 'react-native-fs';
import { NativeModules, Platform } from 'react-native';
import * as ModelManager from '../../modules/SynthesisEngine/modelManager';
const { RELEASE_CAPABILITIES: ACTUAL_RELEASE_CAPABILITIES } = jest.requireActual('../releaseCapabilities') as typeof import('../releaseCapabilities');

const mockInitializeModels = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockTranscribeFile = jest.fn();
const mockWakeWord = jest.fn();
const mockPermission = jest.fn();
const mockHeadset = jest.fn();
const mockRecoverInterruptedRecordings = jest.fn();

jest.mock('../../modules/AudioEngine/AudioEngineImpl', () => ({
  AudioEngineImpl: jest.fn().mockImplementation(() => ({
    initializeModels: mockInitializeModels,
    recoverInterruptedRecordings: mockRecoverInterruptedRecordings,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    transcribeFile: mockTranscribeFile,
    startWakeWordDetection: mockWakeWord,
    stopWakeWordDetection: mockWakeWord,
  })),
}));
jest.mock('../../shared/utils/permissions', () => ({
  requestAudioPermissions: mockPermission,
  requestLockScreenCapturePermissions: mockPermission,
}));
jest.mock('../../modules/HeadsetTrigger', () => ({
  setHeadsetTriggerEnabled: mockHeadset,
  setLockScreenHeadsetCaptureEnabled: mockHeadset,
}));
jest.mock('../../modules/SynthesisEngine/SynthesisService', () => ({
  SynthesisService: {
    configure: jest.fn(),
    initialize: jest.fn(async () => ({ available: true })),
    getLiteRtReadiness: jest.fn(() => ({ available: true })),
  },
}));
jest.mock('../../modules/ContextManager', () => ({
  ContextManager: { readContext: jest.fn(async () => []), getInboxThoughts: jest.fn(() => []) },
}));

const { useAppStore } = require('../store') as typeof import('../store');

describe('platform release runtime boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState(useAppStore.getInitialState(), true);
    mockInitializeModels.mockResolvedValue({ transcriptionReady: false, wakeWordReady: false, missingModels: [], errors: [] });
    mockRecoverInterruptedRecordings.mockResolvedValue(0);
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
  });

  it('enables on-demand mobile voice capture while deferring other voice integrations', () => {
    expect(ACTUAL_RELEASE_CAPABILITIES.voiceCapture).toBe(Platform.OS === 'android' || Platform.OS === 'ios');
    expect(ACTUAL_RELEASE_CAPABILITIES.headsetTrigger).toBe(false);
    expect(ACTUAL_RELEASE_CAPABILITIES.voiceImport).toBe(false);
    expect(ACTUAL_RELEASE_CAPABILITIES.assistantCapture).toBe(false);
    expect(ACTUAL_RELEASE_CAPABILITIES.wakeWord).toBe(false);
    expect(useAppStore.getInitialState().pushToRecordEnabled).toBe(ACTUAL_RELEASE_CAPABILITIES.voiceCapture);
  });

  it('initializes available voice support when eager audio is requested', async () => {
    // The mocked ready runtime needs a matching installed-model fixture.
    const models = jest.spyOn(ModelManager, 'resolveModelViews').mockResolvedValue(
      ModelManager.getSynthesisModels().map(model => ({ ...model, installed: true, verified: true })),
    );
    (NativeModules.LiteRtModule.getDeviceReadiness as jest.Mock).mockResolvedValueOnce({
      checkAvailable: true,
      isSimulator: true,
      totalMemoryBytes: 6 * 1024 ** 3,
      availableMemoryBytes: 2 * 1024 ** 3,
      lowMemory: false,
      thermalState: 'nominal',
      osVersion: '16',
      apiLevel: 36,
    });
    await useAppStore.getState().initializeEngine({ eagerAudio: true, eagerSynthesis: true });
    expect(mockInitializeModels).toHaveBeenCalledTimes(ACTUAL_RELEASE_CAPABILITIES.voiceCapture ? 1 : 0);
    expect(mockPermission).not.toHaveBeenCalled();
    expect(useAppStore.getState().status).toBe(ACTUAL_RELEASE_CAPABILITIES.voiceCapture ? 'Audio Unavailable' : 'Ready for local capture');
    models.mockRestore();
  });

  it('keeps deferred wake-word and headset paths disabled', async () => {
    const state = useAppStore.getState();
    state.setCaptureSetting('wakeWordEnabled', true);
    state.setCaptureSetting('lockScreenHeadsetTriggerEnabled', true);
    await state.setAppLifecycleState('background');
    await state.setAppLifecycleState('active');
    expect(useAppStore.getState()).toMatchObject({
      wakeWordEnabled: false, lockScreenHeadsetTriggerEnabled: false,
    });
    for (const action of [mockStartRecording, mockStopRecording, mockTranscribeFile, mockWakeWord, mockPermission, mockHeadset]) {
      expect(action).not.toHaveBeenCalled();
    }
  });

  it('rejects voice import before transcription or queueing', async () => {
    await expect(useAppStore.getState().analyzeImportDraft({ sourceKind: 'voice', voiceFile: '/tmp/note.wav' }))
      .rejects.toThrow('Voice import is planned for a future release');
    await expect(useAppStore.getState().queueImportedThought({
      sourceKind: 'voice', transcript: 'Existing voice transcript', refinedText: 'Existing voice transcript',
      suggestedTopic: 'Inbox', tags: [], source: 'raw-fallback', selectedTopic: null,
      mergeCandidate: false, requiresApproval: false, voiceFile: '/tmp/note.wav',
    }))
      .rejects.toThrow('Voice import is planned for a future release');
    expect(mockTranscribeFile).not.toHaveBeenCalled();
  });
});
