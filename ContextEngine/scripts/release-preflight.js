#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sourceFingerprint, matchesProvenance } = require('./release-provenance');
const { parseManifest, metadataMatches } = require('./release-artifact-checks');

const platformArgument = process.argv.find(argument => argument.startsWith('--platform='));
const platform = platformArgument?.slice('--platform='.length) ?? 'all';
if (!['all', 'android'].includes(platform)) {
  console.error(`Unsupported preflight platform "${platform}"; use all or android.`);
  process.exit(2);
}

const includeIos = platform === 'all';
const root = path.resolve(__dirname, '..');
const results = [];

const add = (level, name, detail) => results.push({ level, name, detail });
const exists = relativePath => fs.existsSync(path.join(root, relativePath));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const run = (command, args) =>
  spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
  });

const pngSize = relativePath => {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const readPlist = relativePath => {
  const result = run('plutil', ['-convert', 'json', '-o', '-', relativePath]);
  if (result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
};

const checkDisk = () => {
  const outputPaths = includeIos ? ['build', 'android/app/build'] : ['android/app/build'];
  const volumes = outputPaths.map(relativePath =>
    fs.statfsSync(exists(relativePath) ? path.join(root, relativePath) : root),
  );
  const freeGb = Math.min(...volumes.map(stats => (stats.bavail * stats.bsize) / 1024 ** 3));
  const detail = `${freeGb.toFixed(1)} GB free on the release output volume with least space; at least 20 GB is required for reliable archives and symbols`;
  add(freeGb >= 20 ? 'PASS' : 'FAIL', 'Local disk', detail);
};

const checkXcode = () => {
  if (process.platform !== 'darwin') {
    add('FAIL', 'Xcode toolchain', 'release preflight must run on macOS');
    return;
  }
  const result = run('xcodebuild', ['-version']);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const match = output.match(/Xcode\s+(\d+)(?:\.(\d+))?/);
  if (!match) {
    add('FAIL', 'Xcode toolchain', output || 'xcodebuild is unavailable');
    return;
  }
  const major = Number(match[1]);
  add(
    major >= 26 ? 'PASS' : 'FAIL',
    'Xcode toolchain',
    `${match[0]} detected; current App Store submissions require Xcode 26+`,
  );
};

const checkAppleDistributionIdentity = () => {
  if (process.platform !== 'darwin') {
    add('FAIL', 'Apple Distribution identity', 'requires macOS Keychain');
    return;
  }
  const result = run('security', ['find-identity', '-v', '-p', 'codesigning']);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  add(
    output.includes('Apple Distribution:') ? 'PASS' : 'FAIL',
    'Apple Distribution identity',
    output.includes('Apple Distribution:')
      ? 'an Apple Distribution signing identity is available'
      : 'no Apple Distribution signing identity is available',
  );
};

const checkAndroidSigning = () => {
  const names = [
    'CONTEXTENGINE_UPLOAD_STORE_FILE',
    'CONTEXTENGINE_UPLOAD_STORE_PASSWORD',
    'CONTEXTENGINE_UPLOAD_KEY_ALIAS',
    'CONTEXTENGINE_UPLOAD_KEY_PASSWORD',
  ];
  const missing = names.filter(name => !process.env[name]);
  const configuredStoreFile = process.env.CONTEXTENGINE_UPLOAD_STORE_FILE;
  const storeFileMissing = Boolean(configuredStoreFile) && !fs.existsSync(configuredStoreFile);
  add(
    missing.length === 0 && !storeFileMissing ? 'PASS' : 'FAIL',
    'Play upload signing',
    missing.length === 0 && !storeFileMissing
      ? 'all required signing inputs are present'
      : [
        missing.length > 0 ? `missing environment variables: ${missing.join(', ')}` : null,
        storeFileMissing ? `upload keystore not found: ${configuredStoreFile}` : null,
      ].filter(Boolean).join('; '),
  );
};

const checkPinnedDependencies = () => {
  const buildGradle = read('android/app/build.gradle')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const dynamic = buildGradle.match(/(?:latest\.release|:[^"'\n]*\+|SNAPSHOT)/g) ?? [];
  add(
    dynamic.length === 0 ? 'PASS' : 'FAIL',
    'Android dependency pinning',
    dynamic.length === 0
      ? 'no dynamic release dependency was found in android/app/build.gradle'
      : `dynamic dependency selectors found: ${dynamic.join(', ')}`,
  );
};

const checkAndroidApiAndVersion = () => {
  const rootGradle = read('android/build.gradle');
  const appGradle = read('android/app/build.gradle');
  const compileSdk = Number(rootGradle.match(/compileSdkVersion\s*=\s*(\d+)/)?.[1]);
  const targetSdk = Number(rootGradle.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]);
  const kotlinVersion = rootGradle.match(/kotlinVersion\s*=\s*["']([^"']+)["']/)?.[1];
  const settingsGradle = read('android/settings.gradle');
  const r8Version = settingsGradle.match(/com\.android\.tools:r8:([^"')]+)/)?.[1];
  const versionCode = Number(appGradle.match(/versionCode\s+(\d+)/)?.[1]);
  const versionName = appGradle.match(/versionName\s+["']([^"']+)["']/)?.[1];
  const valid = compileSdk >= 36 && targetSdk >= 36 && kotlinVersion === '2.3.0' &&
    r8Version === '8.13.19' && versionCode === 8 && versionName === '1.0.7';

  add(
    valid ? 'PASS' : 'FAIL',
    'Android API and version metadata',
    `compile SDK ${compileSdk || 'missing'}, target SDK ${targetSdk || 'missing'}, Kotlin ${kotlinVersion || 'missing'}, R8 ${r8Version || 'missing'}, version ${versionName || 'missing'} (${versionCode || 'missing'}); Play requires API 36 for submissions from 31 August 2026`,
  );
};

const hasUserStartedMicrophoneService = manifest =>
  (manifest.match(/<service\b[\s\S]*?>/g) ?? []).some(element =>
    /android:name=["'][^"']*ActiveRecordingService["']/.test(element) &&
    /android:foregroundServiceType=["'][^"']*microphone["']/.test(element),
  );

const checkAndroidPermissionSurface = () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const permissionElements = manifest.match(/<uses-permission\b[\s\S]*?\/>/g) ?? [];
  const activePermissions = permissionElements
    .filter(element => !/tools:node=["']remove["']/.test(element))
    .map(element => element.match(/android:name=["']([^"']+)["']/)?.[1])
    .filter(Boolean);
  const expectedSourcePermissions = [
    'android.permission.INTERNET',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.RECORD_AUDIO',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.RUN_USER_INITIATED_JOBS',
    'android.permission.BLUETOOTH_CONNECT',
  ];
  const sourcePermissionsMatch = activePermissions.length === expectedSourcePermissions.length &&
    expectedSourcePermissions.every(permission => activePermissions.includes(permission));
  const stripsLegacyStorage = ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'].every(permission =>
    new RegExp(`android\\.permission\\.${permission}[\\s\\S]*?tools:node=["']remove["']`).test(manifest),
  );
  const mergedReleasePaths = [
    'android/app/build/intermediates/packaged_manifests/release/processReleaseManifestForPackage/AndroidManifest.xml',
    'android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml',
    'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
  ];
  const mergedReleasePath = mergedReleasePaths.find(exists);
  const mergedManifest = mergedReleasePath ? read(mergedReleasePath) : '';
  const mergedSystemPermissions = (mergedManifest.match(/<uses-permission\b[\s\S]*?\/>/g) ?? [])
    .map(element => element.match(/android:name=["'](android\.permission\.[^"']+)["']/)?.[1])
    .filter(Boolean);
  const expectedMergedSystemPermissions = [
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.INTERNET',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECORD_AUDIO',
    'android.permission.RUN_USER_INITIATED_JOBS',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.WAKE_LOCK',
  ];
  const mergedSystemPermissionsMatch = mergedSystemPermissions.length === expectedMergedSystemPermissions.length &&
    expectedMergedSystemPermissions.every(permission => mergedSystemPermissions.includes(permission));
  const receiverPermission = 'com.meharaj.contextengine.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION';
  const scopedReceiverPermissionPresent = mergedManifest.includes(`android:name="${receiverPermission}"`) &&
    mergedManifest.includes('android:protectionLevel="signature"');
  const optionalMicrophone = /android:name=["']android\.hardware\.microphone["'][\s\S]*?android:required=["']false["']/.test(manifest);
  const valid = sourcePermissionsMatch && stripsLegacyStorage && Boolean(mergedReleasePath) &&
    mergedSystemPermissionsMatch && scopedReceiverPermissionPresent &&
    optionalMicrophone && hasUserStartedMicrophoneService(mergedManifest);

  add(
    valid ? 'PASS' : 'FAIL',
    'Android permission surface',
    valid
      ? 'source declares user-started microphone and data-sync foreground services for capture and model downloads; legacy storage permissions are absent'
      : `source permissions: ${activePermissions.join(', ') || 'none'}; merged release manifest: ${mergedReleasePath ? mergedSystemPermissions.join(', ') : 'not built'}; expected permissions include microphone/data-sync foreground services and notifications; legacy storage permissions must be absent`,
  );
};

const checkAndroidReleaseArtifacts = () => {
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  const buildToolsVersion = read('android/build.gradle').match(/buildToolsVersion\s*=\s*["']([^"']+)["']/)?.[1];
  const apk = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
  const aab = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
  const apkanalyzer = sdkRoot && path.join(sdkRoot, 'cmdline-tools/latest/bin/apkanalyzer');
  const apksigner = sdkRoot && buildToolsVersion && path.join(sdkRoot, 'build-tools', buildToolsVersion, 'apksigner');
  const bundletool = process.env.CONTEXTENGINE_BUNDLETOOL_JAR;
  const missing = [
    ['release APK', apk], ['release AAB', aab], ['apkanalyzer', apkanalyzer],
    ['apksigner', apksigner], ['CONTEXTENGINE_BUNDLETOOL_JAR', bundletool],
  ].filter(([, location]) => !location || !fs.existsSync(location)).map(([name]) => name);
  if (missing.length) {
    add('FAIL', 'Android release artifacts', `missing: ${missing.join(', ')}`);
    return;
  }

  const failures = [];
  const expected = {
    packageId: 'com.meharaj.contextengine', versionCode: 8, versionName: '1.0.7', minSdk: 24, targetSdk: 36,
  };
  const apkManifest = run(apkanalyzer, ['manifest', 'print', apk]);
  const aabManifest = run('java', ['-jar', bundletool, 'dump', 'manifest', `--bundle=${aab}`, '--module=base']);
  for (const [name, result] of [['APK', apkManifest], ['AAB', aabManifest]]) {
    if (result.status !== 0 || !metadataMatches(parseManifest(result.stdout || ''), expected)) {
      failures.push(`${name} package/version/API/permission mismatch (expected ${expected.packageId} 1.0.7/8, API 24/36)`);
    }
  }

  const apkSignature = run(apksigner, ['verify', '--print-certs', apk]);
  const aabSignature = run('jarsigner', ['-J-Duser.language=en', '-verify', aab]);
  const aabCertificate = run('keytool', ['-J-Duser.language=en', '-printcert', '-jarfile', aab]);
  const apkDigest = apkSignature.stdout?.match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]+)/i)?.[1]?.toLowerCase();
  const aabDigest = aabCertificate.stdout?.match(/SHA256:\s*([A-F0-9:]+)/i)?.[1]?.replace(/:/g, '').toLowerCase();
  const uploadCertificate = process.env.CONTEXTENGINE_UPLOAD_STORE_FILE && process.env.CONTEXTENGINE_UPLOAD_KEY_ALIAS
    ? run('keytool', ['-J-Duser.language=en', '-list', '-v',
      '-keystore', process.env.CONTEXTENGINE_UPLOAD_STORE_FILE,
      '-alias', process.env.CONTEXTENGINE_UPLOAD_KEY_ALIAS,
      '-storepass:env', 'CONTEXTENGINE_UPLOAD_STORE_PASSWORD'])
    : { status: 1, stdout: '' };
  const uploadDigest = uploadCertificate.stdout?.match(/SHA256:\s*([A-F0-9:]+)/i)?.[1]?.replace(/:/g, '').toLowerCase();
  if (apkSignature.status !== 0 || aabSignature.status !== 0 ||
      !/jar verified\./i.test(aabSignature.stdout || '') || /unsigned entries/i.test(aabSignature.stdout || '') ||
      aabCertificate.status !== 0 || uploadCertificate.status !== 0 || !apkDigest || !aabDigest ||
      apkDigest !== aabDigest || apkDigest !== uploadDigest || /CN=Android Debug/i.test(apkSignature.stdout || '')) {
    failures.push('APK/AAB signatures must verify and match configured upload certificate');
  }

  const config = run('java', ['-jar', bundletool, 'dump', 'config', `--bundle=${aab}`]);
  if (config.status !== 0 || !/PAGE_ALIGNMENT_16K/.test(config.stdout || '')) {
    failures.push('AAB must request PAGE_ALIGNMENT_16K');
  }
  for (const [name, artifact] of [['APK', apk], ['AAB', aab]]) {
    const alignment = run(process.execPath, ['scripts/check-android-16k.js', artifact]);
    if (alignment.status !== 0) failures.push(`${name} 16 KB ELF/ZIP check failed`);
  }

  const expectedProvenance = sourceFingerprint(root);
  for (const [name, artifact, entry] of [
    ['APK', apk, 'assets/release-provenance.json'],
    ['AAB', aab, 'base/assets/release-provenance.json'],
  ]) {
    const extracted = run('unzip', ['-p', artifact, entry]);
    try {
      if (extracted.status !== 0 || !matchesProvenance(JSON.parse(extracted.stdout), expectedProvenance)) {
        failures.push(`${name} source fingerprint stale or absent; rebuild from stable current source`);
      }
    } catch {
      failures.push(`${name} source fingerprint unreadable; rebuild from current source`);
    }
  }
  add(
    failures.length ? 'FAIL' : 'PASS',
    'Android release artifacts',
    failures.length ? failures.join('; ') :
      `APK/AAB package, 1.0.7/8, API, microphone/notification permissions, upload signatures, 16 KB compatibility and current source fingerprint verified (${expectedProvenance.sourceFingerprint})`,
  );
};

const checkAndroidVoiceCapabilityScope = () => {
  const capabilities = read('src/core/releaseCapabilities.ts');
  const emitter = read('android/app/src/main/java/com/meharaj/contextengine/EventEmitter.kt');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const enabledOnlyOnAndroid = [
    /voiceCapture:\s*Platform\.OS\s*===\s*['"]android['"]/.test(capabilities),
    /headsetTrigger:\s*false/.test(capabilities),
    /voiceImport:\s*false/.test(capabilities),
    /assistantCapture:\s*false/.test(capabilities),
    /wakeWord:\s*false/.test(capabilities),
    /VOICE_INTEGRATIONS_RELEASED\s*=\s*true/.test(emitter),
    /HEADSET_TRIGGER_RELEASED\s*=\s*false/.test(emitter),
    /LOCK_SCREEN_CAPTURE_RELEASED\s*=\s*false/.test(emitter),
    /ASSISTANT_CAPTURE_RELEASED\s*=\s*false/.test(emitter),
    /FOREGROUND_SERVICE_MICROPHONE/.test(manifest) &&
      hasUserStartedMicrophoneService(manifest) &&
      !/LockScreenCaptureService|HeadsetMediaButtonReceiver/.test(manifest),
  ].every(Boolean);

  add(
    enabledOnlyOnAndroid ? 'PASS' : 'FAIL',
    'Android voice feature scope',
    enabledOnlyOnAndroid
      ? 'Android allows user-initiated recording only; headset triggers/background microphone, import, wake word, and assistant capture stay gated'
      : 'user-started microphone recording must use its foreground service; headset triggers, lock-screen capture, import, wake word, and assistant capture must stay gated',
  );
};

const checkAndroidBackupBoundary = () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const rules = read('android/app/src/main/res/xml/data_extraction_rules.xml');
  const domains = [
    'root',
    'file',
    'database',
    'sharedpref',
    'external',
    'device_root',
    'device_file',
    'device_database',
    'device_sharedpref',
  ];
  const section = name => rules.match(new RegExp(`<${name}\\b[\\s\\S]*?<\\/${name}>`))?.[0] ?? '';
  const excludesAll = sectionName => {
    const contents = section(sectionName);
    return domains.every(domain =>
      new RegExp(`<exclude\\s+domain=["']${domain}["']\\s+path=["']\\.["']\\s*\\/>`).test(contents),
    );
  };
  const backupDisabled = /android:allowBackup=["']false["']/.test(manifest) &&
    /android:fullBackupContent=["']false["']/.test(manifest) &&
    /android:dataExtractionRules=["']@xml\/data_extraction_rules["']/.test(manifest);
  const valid = backupDisabled && excludesAll('cloud-backup') && excludesAll('device-transfer');

  add(
    valid ? 'PASS' : 'FAIL',
    'Android local-data boundary',
    valid
      ? 'backup is disabled and every credential/device-protected storage domain is excluded from cloud and device transfer'
      : 'backup flags or all-domain cloud/device-transfer exclusions are incomplete',
  );
};

const checkIosPrivacyManifest = () => {
  const privacy = readPlist('ios/ContextEngine/PrivacyInfo.xcprivacy');
  const reasons = new Map(
    (privacy?.NSPrivacyAccessedAPITypes ?? []).map(entry => [
      entry.NSPrivacyAccessedAPIType,
      entry.NSPrivacyAccessedAPITypeReasons ?? [],
    ]),
  );
  const expected = [
    ['NSPrivacyAccessedAPICategoryUserDefaults', 'CA92.1'],
    ['NSPrivacyAccessedAPICategoryFileTimestamp', 'C617.1'],
    ['NSPrivacyAccessedAPICategorySystemBootTime', '35F9.1'],
  ];
  const rnfsManagerPath = path.join(root, 'node_modules', 'react-native-fs', 'RNFSManager.m');
  const rnfsPatched = fs.existsSync(rnfsManagerPath) &&
    fs.readFileSync(rnfsManagerPath, 'utf8').includes(
      'Context Engine intentionally omits the unused RNFS.getFSInfo native export',
    );
  const valid = privacy?.NSPrivacyTracking === false &&
    Array.isArray(privacy?.NSPrivacyTrackingDomains) &&
    Array.isArray(privacy?.NSPrivacyCollectedDataTypes) &&
    privacy.NSPrivacyCollectedDataTypes.length === 0 &&
    expected.every(([category, reason]) => reasons.get(category)?.includes(reason)) &&
    rnfsPatched;

  add(
    valid ? 'PASS' : 'FAIL',
    'iOS privacy manifest',
    valid
      ? 'tracking/data collection are empty, required-reason API declarations are present, and the unused RNFS disk-capacity API is absent'
      : 'privacy keys/reasons are incomplete or the post-install RNFS required-reason patch has not run',
  );
};

const checkIosMetadataAndCapabilities = () => {
  const info = readPlist('ios/ContextEngine/Info.plist');
  const project = read('ios/ContextEngine.xcodeproj/project.pbxproj');
  const versions = [...project.matchAll(/MARKETING_VERSION\s*=\s*([^;]+);/g)].map(match => match[1].trim());
  const builds = [...project.matchAll(/CURRENT_PROJECT_VERSION\s*=\s*([^;]+);/g)].map(match => match[1].trim());
  const microphonePurpose = info?.NSMicrophoneUsageDescription;
  const backgroundModes = info?.UIBackgroundModes;
  const userStartedVoiceDisclosure = typeof microphonePurpose === 'string' &&
    /tap Record/i.test(microphonePurpose) && /on this device/i.test(microphonePurpose);
  const backgroundModesValid = Array.isArray(backgroundModes) &&
    backgroundModes.length === 2 && backgroundModes.includes('audio') && backgroundModes.includes('processing');
  const valid = info?.CFBundleDisplayName === 'Thought Notes' &&
    info?.ITSAppUsesNonExemptEncryption === false &&
    userStartedVoiceDisclosure &&
    backgroundModesValid &&
    versions.length >= 2 && new Set(versions).size === 1 &&
    builds.length >= 2 && new Set(builds).size === 1;

  add(
    valid ? 'PASS' : 'FAIL',
    'iOS version and capability metadata',
    valid
      ? `version ${versions[0]} (${builds[0]}), user-started microphone disclosure, audio/processing background modes, export-compliance key set`
      : 'Debug/Release version metadata, user-started microphone disclosure, audio/processing background modes, or export compliance is incomplete',
  );
};

const checkPrivacyPolicy = () => {
  const relativePath = 'docs/privacy-policy.md';
  if (!exists(relativePath)) {
    add('FAIL', 'Privacy policy', `${relativePath} is missing`);
    return;
  }
  const policy = read(relativePath);
  const hasPlaceholder = /\[[A-Z][A-Z\s/-]+REQUIRED[^\]]*\]/.test(policy) ||
    /Publisher Draft|Confirm that the release and contact details match/i.test(policy);
  add(
    hasPlaceholder ? 'FAIL' : 'PASS',
    'Privacy policy',
    hasPlaceholder
      ? 'policy remains a publisher draft or has unresolved publisher/contact/URL details; finalize before submission'
      : 'local policy has no draft marker or unresolved publisher placeholders',
  );
};

const checkPublishedPrivacyPolicy = () => {
  const configuredUrl = process.env.CONTEXTENGINE_PRIVACY_POLICY_URL;
  if (!configuredUrl) {
    add('FAIL', 'Published privacy policy', 'CONTEXTENGINE_PRIVACY_POLICY_URL is missing');
    return;
  }
  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    add('FAIL', 'Published privacy policy', 'configured policy URL is invalid');
    return;
  }
  if (url.protocol !== 'https:') {
    add('FAIL', 'Published privacy policy', 'configured policy URL must use HTTPS');
    return;
  }

  const localPolicy = read('docs/privacy-policy.md');
  const expectedDate = localPolicy.match(/^Effective date:\s*(\d{4}-\d{2}-\d{2})/m)?.[1];
  const fetched = run('curl', [
    '--fail', '--location', '--silent', '--show-error', '--max-time', '12',
    '--proto', '=https', '--proto-redir', '=https', url.href,
  ]);
  const publicCopy = fetched.stdout ?? '';
  const hasDraftContent = /\[(?:PUBLISHER|SUPPORT|HTTPS URL)[^\]]*REQUIRED[^\]]*\]|Publisher Draft|\[REQUIRED\]/i.test(publicCopy);
  const current = Boolean(expectedDate) && publicCopy.includes(expectedDate) &&
    publicCopy.includes('Thought Notes Privacy Policy') && !hasDraftContent;
  add(
    fetched.status === 0 && current ? 'PASS' : 'FAIL',
    'Published privacy policy',
    fetched.status !== 0
      ? 'configured HTTPS policy URL could not be fetched'
      : current
        ? `public URL serves the current ${expectedDate} policy without draft placeholders`
        : 'public URL is stale or still serves draft placeholders; publish the local policy and verify it again',
  );
};

const checkStoreSubmissionPackage = () => {
  const relativePath = 'docs/store-submission-package.md';
  if (!exists(relativePath)) {
    add('FAIL', 'Store submission package', `${relativePath} is missing`);
    return;
  }
  const packageDoc = read(relativePath);
  const requiredPlaceholders = [
    '- Public developer name: **[REQUIRED]**',
    '- Support email: **[REQUIRED]**',
    '- Support URL: **[REQUIRED]**',
    '- Public privacy-policy URL: **[REQUIRED]**',
    '- Availability/regions: **[REQUIRED]**',
    '- Target audience and minimum intended age: **[REQUIRED]**',
  ].filter(token => packageDoc.includes(token));
  add(
    requiredPlaceholders.length === 0 ? 'PASS' : 'FAIL',
    'Store submission package',
    requiredPlaceholders.length === 0
      ? 'required publisher and submission fields are populated'
      : `required fields still need values: ${requiredPlaceholders.join(', ')}`,
  );
};

const checkPng = (name, relativePath, width, height) => {
  if (!exists(relativePath)) {
    add('FAIL', name, `${relativePath} is missing`);
    return;
  }
  const size = pngSize(relativePath);
  const valid = size?.width === width && size?.height === height;
  add(
    valid ? 'PASS' : 'FAIL',
    name,
    size
      ? `${relativePath} is ${size.width}x${size.height}; expected ${width}x${height}`
      : `${relativePath} is not a readable PNG`,
  );
};

const checkScreenshotDirectories = () => {
  const inspect = relativePath => {
    const result = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', relativePath]);
    const output = result.stdout ?? '';
    return {
      width: Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]),
      height: Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]),
      hasAlpha: output.match(/hasAlpha:\s*(\w+)/)?.[1] === 'yes',
    };
  };
  const filesFor = (directory, prefix) => {
    const absolutePath = path.join(root, directory);
    return exists(directory)
      ? fs.readdirSync(absolutePath)
        .filter(file => file.startsWith(prefix) && /\.(?:png|jpe?g)$/i.test(file))
        .map(file => path.join(directory, file))
      : [];
  };

  if (includeIos) {
    const iphone = filesFor('ios/store-assets/screenshots', 'iphone-');
    const ipad = filesFor('ios/store-assets/screenshots', 'ipad-');
    const validAppleSet = (files, width, height) => files.length >= 1 && files.length <= 10 &&
      files.every(file => {
        const image = inspect(file);
        return image.width === width && image.height === height && !image.hasAlpha;
      });
    const appleValid = validAppleSet(iphone, 1320, 2868) && validAppleSet(ipad, 2064, 2752);
    add(
      appleValid ? 'PASS' : 'FAIL',
      'App Store screenshots',
      `${iphone.length} iPhone 1320x2868 and ${ipad.length} iPad 2064x2752 alpha-free image(s) found`,
    );
  }

  const expectedPlayScreenshots = [
    'phone-01-organized-topic-home.jpg',
    'phone-02-topic-details.jpg',
  ];
  const play = filesFor('android/store-assets/screenshots', 'phone-');
  const expectedFilesPresent = expectedPlayScreenshots.every(file =>
    exists(path.join('android/store-assets/screenshots', file)),
  );
  const playDimensionsValid = play.length === expectedPlayScreenshots.length && play.every(file => {
    const image = inspect(file);
    const shortest = Math.min(image.width, image.height);
    const longest = Math.max(image.width, image.height);
    return shortest >= 320 && longest <= 3840 && longest <= shortest * 2 && !image.hasAlpha;
  });
  let screenshotTextValid = false;
  let screenshotText = [];
  let screenshotOcrFailed = false;
  if (expectedFilesPresent && playDimensionsValid) {
    const ocr = run('swift', ['scripts/recognize-screenshot-text.swift', ...play]);
    screenshotOcrFailed = ocr.status !== 0;
    try {
      screenshotText = ocr.status === 0 ? JSON.parse(ocr.stdout.trim()) : [];
    } catch {
      screenshotText = [];
    }
    screenshotTextValid = screenshotText.length === play.length && screenshotText.every(text =>
      /thought\s+notes/i.test(text) && !/context\s+engine|local\s+memory\s+engine/i.test(text),
    );
  }
  const brandedScreenshotPresent = screenshotText.some(text => /thought\s+notes/i.test(text));
  const legacyBrandingAbsent = screenshotText.every(text => !/context\s+engine|local\s+memory\s+engine/i.test(text));
  screenshotTextValid = screenshotText.length === play.length && brandedScreenshotPresent && legacyBrandingAbsent;
  const playValid = expectedFilesPresent && playDimensionsValid && screenshotTextValid;
  add(
    playValid ? 'PASS' : 'FAIL',
    'Play screenshots',
    playValid
      ? 'two named, alpha-free ready-to-use phone screens meet Play dimensions, show Thought Notes branding, and contain no legacy branding'
      : !expectedFilesPresent || play.length !== expectedPlayScreenshots.length
        ? `expected ${expectedPlayScreenshots.length} named listing screens; found ${play.length}`
        : !playDimensionsValid
          ? 'one or more Play images violate dimension, aspect-ratio, or transparency requirements'
        : screenshotOcrFailed
            ? 'built-in Vision OCR could not read the Play screenshots'
            : 'Play screenshots must include Thought Notes branding and contain no legacy Context Engine branding',
  );
};

const checkDisplayName = () => {
  const result = run('plutil', ['-extract', 'CFBundleDisplayName', 'raw', 'ios/ContextEngine/Info.plist']);
  const name = result.status === 0 ? result.stdout.trim() : '';
  add(
    name === 'Thought Notes' ? 'PASS' : 'FAIL',
    'iOS display name',
    name ? `current value is "${name}"; expected "Thought Notes"` : 'unable to read CFBundleDisplayName',
  );
};

checkDisk();
if (includeIos) {
  checkXcode();
  checkAppleDistributionIdentity();
}
checkAndroidSigning();
checkPinnedDependencies();
checkAndroidApiAndVersion();
checkAndroidPermissionSurface();
checkAndroidReleaseArtifacts();
checkAndroidVoiceCapabilityScope();
checkAndroidBackupBoundary();
if (includeIos) {
  checkIosPrivacyManifest();
  checkIosMetadataAndCapabilities();
}
checkPrivacyPolicy();
checkPublishedPrivacyPolicy();
checkStoreSubmissionPackage();
checkPng('Play icon', 'android/store-assets/play-store-icon-512.png', 512, 512);
checkPng('Play feature graphic', 'android/store-assets/feature-graphic-1024x500.png', 1024, 500);
checkScreenshotDirectories();
if (includeIos) checkDisplayName();

for (const result of results) {
  console.log(`[${result.level}] ${result.name}: ${result.detail}`);
}

const failures = results.filter(result => result.level === 'FAIL').length;
const label = platform === 'all' ? 'Release preflight' : `${platform[0].toUpperCase()}${platform.slice(1)} release preflight`;
console.log(`\n${label}: ${results.length - failures}/${results.length} checks passed.`);
process.exit(failures === 0 ? 0 : 1);
