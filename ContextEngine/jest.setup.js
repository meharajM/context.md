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

// Mock EventEmitter for react-native-fs
NativeModules.RNFS = {};

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  DocumentDirectoryPath: '/mock/path',
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
