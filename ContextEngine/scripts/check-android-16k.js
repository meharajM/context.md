#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const defaultCandidates = [
  'android/app/build/outputs/apk/release/app-release.apk',
  'android/app/build/outputs/apk/release/app-release-unsigned.apk',
];
const requestedPath = process.argv[2];
const relativeApk = requestedPath ?? defaultCandidates.find(candidate =>
  fs.existsSync(path.join(root, candidate)),
);

if (!relativeApk) {
  throw new Error('No release APK found. Build a release APK, then rerun this check.');
}

const apkPath = path.resolve(root, relativeApk);
const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!androidSdk) {
  throw new Error('ANDROID_HOME or ANDROID_SDK_ROOT is required.');
}

const buildTools = path.join(androidSdk, 'build-tools', '36.0.0');
const zipalign = path.join(buildTools, 'zipalign');
const ndkVersion = fs.readFileSync(path.join(root, 'android/build.gradle'), 'utf8')
  .match(/ndkVersion\s*=\s*["']([^"']+)["']/)?.[1];
const readelf = ndkVersion
  ? path.join(androidSdk, 'ndk', ndkVersion, 'toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-readelf')
  : '';

for (const [name, executable] of [['zipalign', zipalign], ['llvm-readelf', readelf]]) {
  if (!executable || !fs.existsSync(executable)) {
    throw new Error(`${name} is unavailable at the expected Android SDK/NDK path.`);
  }
}

const alignment = spawnSync(zipalign, ['-c', '-P', '16', '-v', '4', apkPath], {
  encoding: 'utf8',
});
if (alignment.status !== 0) {
  process.stderr.write(alignment.stdout ?? '');
  process.stderr.write(alignment.stderr ?? '');
  throw new Error('APK zip alignment is not compatible with 16 KB pages.');
}

const listing = spawnSync('unzip', ['-Z1', apkPath], { encoding: 'utf8' });
if (listing.status !== 0) {
  throw new Error(listing.stderr || 'Unable to inspect release APK.');
}

const nativeEntries = listing.stdout
  .split('\n')
  .filter(entry => /^lib\/arm64-v8a\/[^/]+\.so$/.test(entry));
if (nativeEntries.length === 0) {
  throw new Error('Release APK contains no arm64-v8a native libraries.');
}

const auditDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'contextengine-16k-'));
const failures = [];

try {
  for (const entry of nativeEntries) {
    const temporaryLibrary = path.join(auditDirectory, path.basename(entry));
    const output = fs.openSync(temporaryLibrary, 'w');
    const library = spawnSync('unzip', ['-p', apkPath, entry], {
      encoding: 'utf8',
      stdio: ['ignore', output, 'pipe'],
    });
    fs.closeSync(output);
    if (library.status !== 0) {
      failures.push(`${entry}: unable to extract`);
      continue;
    }

    const headers = spawnSync(readelf, ['-lW', temporaryLibrary], { encoding: 'utf8' });
    const loadAlignments = (headers.stdout ?? '')
      .split('\n')
      .filter(line => /^\s*LOAD\s/.test(line))
      .map(line => Number.parseInt(line.trim().split(/\s+/).at(-1), 16));

    if (headers.status !== 0 || loadAlignments.length === 0 ||
        loadAlignments.some(value => !Number.isFinite(value) || value < 0x4000)) {
      failures.push(`${entry}: LOAD alignment below 0x4000`);
    }
  }
} finally {
  fs.rmSync(auditDirectory, { recursive: true, force: true });
}

if (failures.length > 0) {
  throw new Error(`16 KB ELF validation failed:\n${failures.join('\n')}`);
}

console.log(
  `16 KB compatibility verified for ${nativeEntries.length} arm64-v8a libraries in ${path.relative(root, apkPath)}.`,
);
