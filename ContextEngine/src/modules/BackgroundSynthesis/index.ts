import { NativeModules, Platform } from 'react-native';

interface BackgroundSynthesisNativeModule {
  scheduleQueuedSynthesis(): Promise<boolean>;
  reportQueuedSynthesisResult(retry: boolean): Promise<boolean>;
}

const nativeModule = NativeModules.BackgroundSynthesisModule as BackgroundSynthesisNativeModule | undefined;

export async function scheduleQueuedSynthesis(): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.scheduleQueuedSynthesis) {
    return false;
  }

  try {
    return await nativeModule.scheduleQueuedSynthesis();
  } catch (error) {
    console.warn('Could not schedule idle synthesis:', error);
    return false;
  }
}

export async function reportQueuedSynthesisResult(retry: boolean): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.reportQueuedSynthesisResult) {
    return false;
  }

  try {
    return await nativeModule.reportQueuedSynthesisResult(retry);
  } catch (error) {
    console.warn('Could not report idle synthesis completion:', error);
    return false;
  }
}
