import { NativeModules, Platform } from 'react-native';

type HeadsetTriggerNativeModule = {
  announceGuidance?: (text: string) => Promise<void> | void;
  setHeadsetTriggerEnabled?: (enabled: boolean) => Promise<void> | void;
  setLockScreenCaptureEnabled?: (enabled: boolean) => Promise<void> | void;
};

const isSupportedPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

const getNativeModule = (): HeadsetTriggerNativeModule | undefined =>
  isSupportedPlatform ? (NativeModules.EventEmitter as HeadsetTriggerNativeModule | undefined) : undefined;

export async function setHeadsetTriggerEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  const toggle = getNativeModule()?.setHeadsetTriggerEnabled;
  if (typeof toggle === 'function') await toggle(enabled);
}

export async function setLockScreenHeadsetCaptureEnabled(enabled: boolean): Promise<void> {
  const nativeModule = getNativeModule();
  const toggle = nativeModule?.setLockScreenCaptureEnabled;

  if (typeof toggle !== 'function') {
    return;
  }

  await toggle(enabled);
}
