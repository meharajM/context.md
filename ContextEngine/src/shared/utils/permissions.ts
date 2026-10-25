import { PermissionsAndroid, Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';

/**
 * Permission Utilities
 */

export const requestAudioPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Allow voice notes',
          message: 'Thought Notes uses the microphone only when you start recording. Your voice is turned into text on this phone.',
          buttonNeutral: 'Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;

      if (Number(Platform.Version) >= 31) {
        try {
          const headsetPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            {
              title: 'Allow headset microphone',
              message: 'Allow access to connected Bluetooth devices so voice notes can use your headset microphone. If you skip this, recording uses this phone’s microphone.',
              buttonNeutral: 'Later',
              buttonNegative: 'Use phone microphone',
              buttonPositive: 'Allow',
            },
          );
          if (headsetPermission !== PermissionsAndroid.RESULTS.GRANTED) {
            console.info('Bluetooth headset microphone permission was denied; recording will use the phone microphone.');
          }
        } catch (error) {
          console.warn('Bluetooth headset microphone permission request failed:', error);
        }
      }

      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  } else if (Platform.OS === 'ios') {
    try {
      const status = await check(PERMISSIONS.IOS.MICROPHONE);
      if (status === RESULTS.GRANTED) return true;
      
      const result = await request(PERMISSIONS.IOS.MICROPHONE);
      return result === RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

export const requestRecordingNotificationPermission = async (): Promise<boolean> => {
  if (!(Platform.OS === 'android' && Number(Platform.Version) >= 33)) {
    return true;
  }

  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) {
      return true;
    }
    const requestMarker = `${RNFS.DocumentDirectoryPath}/active-recording-notification-permission-requested`;
    if (await RNFS.exists(requestMarker)) return false;

    let result: string;
    try {
      result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Show recording controls',
          message: 'Allow a notification with a Stop action while a voice note records in the background.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Continue without it',
          buttonPositive: 'Allow',
        },
      );
    } finally {
      await RNFS.writeFile(requestMarker, 'requested', 'utf8').catch(error => {
        console.warn('Could not save the recording notification permission choice:', error);
      });
    }
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Recording notification permission request failed:', error);
    return false;
  }
};

export const requestLockScreenCapturePermissions = async (): Promise<boolean> => {
  if (!(Platform.OS === 'android' && Number(Platform.Version) >= 33)) {
    return requestAudioPermissions();
  }

  if (!(await requestAudioPermissions())) {
    return false;
  }

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'Allow headset recording while locked',
        message: 'Allow a notification to keep the headset recording control available while your phone is locked.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('Notification permission request failed:', error);
    return false;
  }
};

/**
 * String Utilities
 */

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};
