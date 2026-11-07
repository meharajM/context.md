const REQUIRED_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.INTERNET',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECORD_AUDIO',
];

function parseManifest(xml) {
  const tag = name => xml.match(new RegExp(`<${name}\\b[^>]*>`))?.[0] || '';
  const attribute = (element, name) => element.match(new RegExp(`\\b${name}=["']([^"']+)["']`))?.[1];
  return {
    packageId: attribute(tag('manifest'), 'package'),
    versionCode: Number(attribute(tag('manifest'), 'android:versionCode')),
    versionName: attribute(tag('manifest'), 'android:versionName'),
    minSdk: Number(attribute(tag('uses-sdk'), 'android:minSdkVersion')),
    targetSdk: Number(attribute(tag('uses-sdk'), 'android:targetSdkVersion')),
    permissions: [...xml.matchAll(/<uses-permission\b[^>]*android:name=["']([^"']+)["']/g)].map(match => match[1]),
  };
}

function metadataMatches(actual, expected) {
  return ['packageId', 'versionCode', 'versionName', 'minSdk', 'targetSdk'].every(key => actual[key] === expected[key]) &&
    REQUIRED_PERMISSIONS.every(permission => actual.permissions.includes(permission)) &&
    !actual.permissions.some(permission => /android\.permission\.(?:READ|WRITE)_EXTERNAL_STORAGE/.test(permission));
}

module.exports = { parseManifest, metadataMatches, REQUIRED_PERMISSIONS };
