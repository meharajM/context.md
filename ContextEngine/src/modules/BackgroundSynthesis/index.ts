import { NativeModules, Platform } from 'react-native';

interface BackgroundSynthesisNativeModule {
  scheduleQueuedSynthesis(): Promise<boolean>;
  scheduleModelDownloads(modelId: string, downloadWhisperModel: boolean): Promise<boolean>;
  scheduleUserInitiatedModelDownload(modelId: string, downloadWhisperModel: boolean, estimatedBytes: number): Promise<boolean>;
  reportQueuedSynthesisResult(retry: boolean, workId: string): Promise<boolean>;
}

interface IOSBackgroundSynthesisNativeModule {
  scheduleQueuedSynthesis(): Promise<boolean>;
  takePendingBackgroundSynthesisRequest(): Promise<boolean>;
  reportQueuedSynthesisResult(retry: boolean): Promise<boolean>;
}

const nativeModule = NativeModules.BackgroundSynthesisModule as BackgroundSynthesisNativeModule | undefined;
const iosNativeModule = NativeModules.EventEmitter as IOSBackgroundSynthesisNativeModule | undefined;

export async function scheduleQueuedSynthesis(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && nativeModule?.scheduleQueuedSynthesis) {
      return await nativeModule.scheduleQueuedSynthesis();
    }
    if (Platform.OS === 'ios' && iosNativeModule?.scheduleQueuedSynthesis) {
      return await iosNativeModule.scheduleQueuedSynthesis();
    }
    return false;
  } catch (error) {
    console.warn('Could not schedule idle synthesis:', error);
    return false;
  }
}

export async function scheduleModelDownloads(modelId: string | null, downloadWhisperModel: boolean): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.scheduleModelDownloads) return false;

  try {
    return await nativeModule.scheduleModelDownloads(modelId ?? '', downloadWhisperModel);
  } catch (error) {
    console.warn('Could not schedule model download continuation:', error);
    return false;
  }
}

export async function scheduleUserInitiatedModelDownload(
  modelId: string | null,
  downloadWhisperModel: boolean,
  estimatedBytes: number,
): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeModule?.scheduleUserInitiatedModelDownload) return false;

  try {
    return await nativeModule.scheduleUserInitiatedModelDownload(modelId ?? '', downloadWhisperModel, estimatedBytes);
  } catch (error) {
    console.warn('Could not schedule the user-initiated model download:', error);
    return false;
  }
}

export async function takePendingBackgroundSynthesisRequest(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !iosNativeModule?.takePendingBackgroundSynthesisRequest) return false;

  try {
    return await iosNativeModule.takePendingBackgroundSynthesisRequest();
  } catch (error) {
    console.warn('Could not read the pending iOS background synthesis request:', error);
    return false;
  }
}

export async function reportQueuedSynthesisResult(retry: boolean, workId?: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && nativeModule?.reportQueuedSynthesisResult) {
      if (!workId) return false;
      return await nativeModule.reportQueuedSynthesisResult(retry, workId);
    }
    if (Platform.OS === 'ios' && iosNativeModule?.reportQueuedSynthesisResult) {
      return await iosNativeModule.reportQueuedSynthesisResult(retry);
    }
    return false;
  } catch (error) {
    console.warn('Could not report idle synthesis completion:', error);
    return false;
  }
}
