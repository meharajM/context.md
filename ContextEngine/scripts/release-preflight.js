#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  const stats = fs.statfsSync(root);
  const freeGb = (stats.bavail * stats.bsize) / 1024 ** 3;
  const detail = `${freeGb.toFixed(1)} GB free; at least 20 GB is required for reliable archives and symbols`;
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
    r8Version === '8.13.19' && versionCode > 0 && Boolean(versionName);

  add(
    valid ? 'PASS' : 'FAIL',
    'Android API and version metadata',
    `compile SDK ${compileSdk || 'missing'}, target SDK ${targetSdk || 'missing'}, Kotlin ${kotlinVersion || 'missing'}, R8 ${r8Version || 'missing'}, version ${versionName || 'missing'} (${versionCode || 'missing'}); Play requires API 36 for submissions from 31 August 2026`,
  );
};

const checkAndroidPermissionSurface = () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const permissionElements = manifest.match(/<uses-permission\b[\s\S]*?\/>/g) ?? [];
  const activePermissions = permissionElements
    .filter(element => !/tools:node=["']remove["']/.test(element))
    .map(element => element.match(/android:name=["']([^"']+)["']/)?.[1])
    .filter(Boolean);
  const expected = ['android.permission.INTERNET', 'android.permission.RECORD_AUDIO'];
  const expectedOnly = activePermissions.length === expected.length &&
    expected.every(permission => activePermissions.includes(permission));
  const stripsLegacyStorage = ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'].every(permission =>
    new RegExp(`android\\.permission\\.${permission}[\\s\\S]*?tools:node=["']remove["']`).test(manifest),
  );
  const mergedReleasePath = 'android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml';
  const mergedSystemPermissions = exists(mergedReleasePath)
    ? (read(mergedReleasePath).match(/<uses-permission\b[\s\S]*?\/>/g) ?? [])
      .map(element => element.match(/android:name=["'](android\.permission\.[^"']+)["']/)?.[1])
      .filter(Boolean)
    : expected;
  const mergedExpectedOnly = mergedSystemPermissions.length === expected.length &&
    expected.every(permission => mergedSystemPermissions.includes(permission));
  const optionalMicrophone = /android:name=["']android\.hardware\.microphone["'][\s\S]*?android:required=["']false["']/.test(manifest);
  const valid = expectedOnly && stripsLegacyStorage && mergedExpectedOnly && optionalMicrophone;

  add(
    valid ? 'PASS' : 'FAIL',
    'Android permission surface',
    valid
      ? 'only Internet and microphone permissions remain active; legacy storage permissions are removed and microphone hardware is optional'
      : `active permissions: ${activePermissions.join(', ') || 'none'}; legacy storage removal and optional microphone declarations are required`,
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
  const microphoneDescription = info?.NSMicrophoneUsageDescription ?? '';
  const valid = info?.CFBundleDisplayName === 'Context Engine' &&
    info?.ITSAppUsesNonExemptEncryption === false &&
    !info?.UIBackgroundModes &&
    microphoneDescription.length >= 20 &&
    versions.length >= 2 && new Set(versions).size === 1 &&
    builds.length >= 2 && new Set(builds).size === 1;

  add(
    valid ? 'PASS' : 'FAIL',
    'iOS version and capability metadata',
    valid
      ? `version ${versions[0]} (${builds[0]}), microphone purpose string present, no background modes, export-compliance key set`
      : 'Debug/Release version metadata, microphone purpose, export compliance, or capability minimization is incomplete',
  );
};

const checkPrivacyPolicy = () => {
  const relativePath = 'docs/privacy-policy.md';
  if (!exists(relativePath)) {
    add('FAIL', 'Privacy policy', `${relativePath} is missing`);
    return;
  }
  const policy = read(relativePath);
  const hasPlaceholder = /\[[A-Z][A-Z\s/-]+REQUIRED[^\]]*\]/.test(policy);
  add(
    hasPlaceholder ? 'FAIL' : 'PASS',
    'Privacy policy',
    hasPlaceholder
      ? 'publisher/contact/URL placeholders remain; fill .env.release.local and run npm run release:apply-metadata'
      : 'no required publisher placeholder remains in the policy draft',
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
    '- Publisher/developer legal name: **[REQUIRED]**',
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

  const play = filesFor('android/store-assets/screenshots', 'phone-');
  const playValid = play.length >= 2 && play.length <= 8 && play.every(file => {
    const image = inspect(file);
    const shortest = Math.min(image.width, image.height);
    const longest = Math.max(image.width, image.height);
    return shortest >= 320 && longest <= 3840 && longest <= shortest * 2 && !image.hasAlpha;
  });
  add(
    playValid ? 'PASS' : 'FAIL',
    'Play screenshots',
    `${play.length} alpha-free phone image(s) satisfy the 320-3840 px and 2:1 limits`,
  );
};

const checkDisplayName = () => {
  const result = run('plutil', ['-extract', 'CFBundleDisplayName', 'raw', 'ios/ContextEngine/Info.plist']);
  const name = result.status === 0 ? result.stdout.trim() : '';
  add(
    name === 'Context Engine' ? 'PASS' : 'FAIL',
    'iOS display name',
    name ? `current value is "${name}"; expected "Context Engine"` : 'unable to read CFBundleDisplayName',
  );
};

checkDisk();
checkXcode();
checkAppleDistributionIdentity();
checkAndroidSigning();
checkPinnedDependencies();
checkAndroidApiAndVersion();
checkAndroidPermissionSurface();
checkAndroidBackupBoundary();
checkIosPrivacyManifest();
checkIosMetadataAndCapabilities();
checkPrivacyPolicy();
checkStoreSubmissionPackage();
checkPng('Play icon', 'android/store-assets/play-store-icon-512.png', 512, 512);
checkPng('Play feature graphic', 'android/store-assets/feature-graphic-1024x500.png', 1024, 500);
checkScreenshotDirectories();
checkDisplayName();

for (const result of results) {
  console.log(`[${result.level}] ${result.name}: ${result.detail}`);
}

const failures = results.filter(result => result.level === 'FAIL').length;
console.log(`\nRelease preflight: ${results.length - failures}/${results.length} checks passed.`);
process.exit(failures === 0 ? 0 : 1);
