import { Platform } from 'react-native';

// Android exposes the implemented media-button trigger; other voice integrations remain deferred.
export const RELEASE_CAPABILITIES = {
  voiceCapture: Platform.OS === 'android' || Platform.OS === 'ios',
  voiceImport: false,
  assistantCapture: false,
  headsetTrigger: Platform.OS === 'android',
  wakeWord: false,
};
