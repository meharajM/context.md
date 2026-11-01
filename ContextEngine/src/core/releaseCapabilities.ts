import { Platform } from 'react-native';

// Both mobile platforms support on-demand voice capture; other voice integrations remain deferred.
export const RELEASE_CAPABILITIES = {
  voiceCapture: Platform.OS === 'android' || Platform.OS === 'ios',
  voiceImport: false,
  assistantCapture: false,
  headsetTrigger: false,
  wakeWord: false,
};
