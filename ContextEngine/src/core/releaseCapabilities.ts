import { Platform } from 'react-native';

// Android v1 includes on-demand voice capture; other voice integrations remain deferred.
export const RELEASE_CAPABILITIES = {
  voiceCapture: Platform.OS === 'android',
  voiceImport: false,
  assistantCapture: false,
  headsetTrigger: false,
  wakeWord: false,
};
