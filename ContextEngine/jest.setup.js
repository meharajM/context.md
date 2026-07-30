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

NativeModules.EventEmitter = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

// Mock EventEmitter for react-native-fs
NativeModules.RNFS = {};

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  moveFile: jest.fn(),
  stat: jest.fn(),
  hash: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  readDir: jest.fn().mockResolvedValue([]),
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
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () =>
  jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
  })),
);

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
  './node_modules/whisper.rn/lib/module/index',
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
