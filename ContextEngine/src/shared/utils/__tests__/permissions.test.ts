import { PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';

import {
  requestAudioPermissions,
  requestLockScreenCapturePermissions,
  requestRecordingNotificationPermission,
} from '../permissions';

describe('requestRecordingNotificationPermission', () => {
  const originalPlatform = Platform.OS;
  const originalVersion = Platform.Version;
  let checkPermission: jest.SpyInstance;
  let requestPermission: jest.SpyInstance;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: 34 });
    (RNFS.exists as jest.Mock).mockReset();
    (RNFS.writeFile as jest.Mock).mockReset();
    checkPermission = jest.spyOn(PermissionsAndroid, 'check');
    requestPermission = jest.spyOn(PermissionsAndroid, 'request');
  });

  afterEach(() => {
    checkPermission.mockRestore();
    requestPermission.mockRestore();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: originalVersion });
  });

  it('requests notification access for the recording Stop action when missing', async () => {
    checkPermission.mockResolvedValue(false);
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    await expect(requestRecordingNotificationPermission()).resolves.toBe(true);
    expect(requestPermission).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      expect.objectContaining({ message: expect.stringContaining('Stop action') }),
    );
  });

  it('does not prompt again when notification access is already granted', async () => {
    checkPermission.mockResolvedValue(true);

    await expect(requestRecordingNotificationPermission()).resolves.toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('reports denial without changing microphone permission', async () => {
    checkPermission.mockResolvedValue(false);
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(requestRecordingNotificationPermission()).resolves.toBe(false);
  });

  it('does not ask again after the user has declined notification access', async () => {
    checkPermission.mockResolvedValue(false);
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(requestRecordingNotificationPermission()).resolves.toBe(false);
    await expect(requestRecordingNotificationPermission()).resolves.toBe(false);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('requestLockScreenCapturePermissions', () => {
  const originalPlatform = Platform.OS;
  const originalVersion = Platform.Version;
  let requestPermission: jest.SpyInstance;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: 34 });
    requestPermission = jest.spyOn(PermissionsAndroid, 'request');
  });

  afterEach(() => {
    requestPermission.mockRestore();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: originalVersion });
  });

  it('requires both microphone and notification permission on Android 13+', async () => {
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    await expect(requestLockScreenCapturePermissions()).resolves.toBe(true);
    expect(requestPermission).toHaveBeenNthCalledWith(
      1,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      expect.any(Object),
    );
    expect(requestPermission).toHaveBeenNthCalledWith(
      2,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      expect.objectContaining({
        message: expect.stringContaining('headset microphone'),
      }),
    );
    expect(requestPermission).toHaveBeenNthCalledWith(
      3,
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      expect.objectContaining({
        message: expect.stringContaining('keep the headset recording control available'),
      }),
    );
  });

  it('does not arm the feature when notification permission is denied', async () => {
    requestPermission.mockImplementation(async permission =>
      permission === PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        ? PermissionsAndroid.RESULTS.GRANTED
        : PermissionsAndroid.RESULTS.DENIED,
    );

    await expect(requestLockScreenCapturePermissions()).resolves.toBe(false);
  });

  it('keeps phone-microphone capture available when Bluetooth access is denied', async () => {
    requestPermission.mockImplementation(async permission =>
      permission === PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        ? PermissionsAndroid.RESULTS.DENIED
        : PermissionsAndroid.RESULTS.GRANTED,
    );

    await expect(requestAudioPermissions()).resolves.toBe(true);
  });
});
