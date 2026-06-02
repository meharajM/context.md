module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/__tests__/mocks/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-fs|react-native-permissions|whisper.rn|react-native-sherpa-onnx|@fugood)/)',
  ],
  moduleNameMapper: {
    '\\.(wav|mp3|m4a|png|jpg|jpeg)$': '<rootDir>/__tests__/mocks/fileMock.js',
  },
};
