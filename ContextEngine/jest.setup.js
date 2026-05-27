import { NativeModules } from 'react-native';

// Mock NativeModules
NativeModules.RNFSManager = {
  RNFSFileTypeRegular: 'RNFSFileTypeRegular',
  RNFSFileTypeDirectory: 'RNFSFileTypeDirectory',
};

NativeModules.RNPermissions = {
  request: jest.fn(),
  check: jest.fn(),
};

NativeModules.LiteRtModule = {
  isAvailable: jest.fn(async () => false),
  loadModel: jest.fn(async config => ({ loaded: true, modelPath: config.modelPath, backend: config.backend })),
  synthesize: jest.fn(async input => ({
    topic: 'Inbox',
    refinedText: input.transcript,
    tags: ['litert'],
    source: 'litert',
  })),
  benchmark: jest.fn(async fixtures => ({ fixtures: fixtures.length })),
  release: jest.fn(async () => undefined),
};

// Mock EventEmitter for react-native-fs
NativeModules.RNFS = {};

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  moveFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve({ statusCode: 200 }),
  })),
  DocumentDirectoryPath: '/mock/path',
  CachesDirectoryPath: '/mock/cache',
  MainBundlePath: '/mock/bundle',
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  request: jest.fn(),
  check: jest.fn(),
  PERMISSIONS: {
    IOS: { MICROPHONE: 'ios.permission.MICROPHONE' },
    ANDROID: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' },
  },
  RESULTS: { GRANTED: 'granted' },
}));

// Mock NativeEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Mock Whisper and Sherpa
jest.mock('react-native-sherpa-onnx', () => ({
  createKeywordSpotter: jest.fn(),
}));

jest.mock(
  'whisper.rn',
  () => ({
    initWhisper: jest.fn(async () => ({
      transcribeRealtime: jest.fn(async () => ({
        stop: jest.fn(async () => ({ result: '' })),
      })),
    })),
    AudioSessionIos: {
      Category: {
        PlayAndRecord: 'PlayAndRecord',
      },
      CategoryOption: {
        MixWithOthers: 'MixWithOthers',
      },
      Mode: {
        Default: 'Default',
      },
    },
  }),
  { virtual: true },
);

jest.mock(
  'whisper.rn/src/index',
  () => ({
    initWhisper: jest.fn(async () => ({
      transcribeRealtime: jest.fn(async () => ({
        stop: jest.fn(async () => ({ result: '' })),
      })),
    })),
    AudioSessionIos: {
      Category: {
        PlayAndRecord: 'PlayAndRecord',
      },
      CategoryOption: {
        MixWithOthers: 'MixWithOthers',
      },
      Mode: {
        Default: 'Default',
      },
    },
  }),
  { virtual: true },
);

jest.mock('llama.rn', () => ({
  initLlama: jest.fn(async () => ({
    completion: jest.fn(async () => ({
      text: '{"topic":"Inbox","refinedText":"Mock thought","tags":["mock"]}',
    })),
    release: jest.fn(async () => undefined),
  })),
}));
