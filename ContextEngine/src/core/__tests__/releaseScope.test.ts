import RNFS from 'react-native-fs';
import { NativeModules, Platform } from 'react-native';
const { RELEASE_CAPABILITIES: ACTUAL_RELEASE_CAPABILITIES } = jest.requireActual('../releaseCapabilities') as typeof import('../releaseCapabilities');

const mockInitializeModels = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockTranscribeFile = jest.fn();
const mockWakeWord = jest.fn();
const mockPermission = jest.fn();
const mockHeadset = jest.fn();

jest.mock('../../modules/AudioEngine/AudioEngineImpl', () => ({
  AudioEngineImpl: jest.fn().mockImplementation(() => ({
    initializeModels: mockInitializeModels,
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
jest.mock('../../modules/HeadsetTrigger', () => ({ setLockScreenHeadsetCaptureEnabled: mockHeadset }));
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
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
  });

  it('enables on-demand Android voice capture while deferring headset triggers', () => {
    expect(ACTUAL_RELEASE_CAPABILITIES.voiceCapture).toBe(Platform.OS === 'android');
    expect(ACTUAL_RELEASE_CAPABILITIES.headsetTrigger).toBe(false);
    expect(ACTUAL_RELEASE_CAPABILITIES.voiceImport).toBe(false);
    expect(ACTUAL_RELEASE_CAPABILITIES.assistantCapture).toBe(false);
    expect(ACTUAL_RELEASE_CAPABILITIES.wakeWord).toBe(false);
    expect(useAppStore.getInitialState().pushToRecordEnabled).toBe(false);
  });

  it('initializes synthesis without Whisper even when a caller requests eager audio', async () => {
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
    expect(mockInitializeModels).not.toHaveBeenCalled();
    expect(mockPermission).not.toHaveBeenCalled();
    expect(useAppStore.getState().status).toBe('Ready for local capture');
  });

  it('blocks direct recording, wake-word, headset and transcription actions', async () => {
    const state = useAppStore.getState();
    state.setCaptureSetting('pushToRecordEnabled', true);
    state.setCaptureSetting('wakeWordEnabled', true);
    state.setCaptureSetting('lockScreenHeadsetTriggerEnabled', true);
    await state.startCapture();
    await state.stopCapture();
    await state.runTranscriptionProbe();
    await state.setAppLifecycleState('background');
    await state.setAppLifecycleState('active');
    expect(useAppStore.getState()).toMatchObject({
      pushToRecordEnabled: false, wakeWordEnabled: false, lockScreenHeadsetTriggerEnabled: false,
    });
    for (const action of [mockInitializeModels, mockStartRecording, mockStopRecording, mockTranscribeFile, mockWakeWord, mockPermission, mockHeadset]) {
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
