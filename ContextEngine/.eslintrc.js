module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['e2e/**', 'node_modules/**'],
  overrides: [
    {
      files: ['jest.setup.js', '**/__tests__/**/*.[jt]s?(x)'],
      env: {
        jest: true,
      },
    },
    {
      files: ['test_logic.ts'],
      env: {
        node: true,
        jest: true,
      },
    },
  ],
};
