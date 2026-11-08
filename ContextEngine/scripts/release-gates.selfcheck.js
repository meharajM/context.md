const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sourceFingerprint, matchesProvenance } = require('./release-provenance');
const { parseManifest, metadataMatches, REQUIRED_PERMISSIONS } = require('./release-artifact-checks');
const { androidAppId, MAIN_ACTIVITY } = require('../e2e/appTarget');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thought-notes-release-check-'));
try {
  fs.mkdirSync(path.join(root, 'src'));
  const source = path.join(root, 'src', 'capture.ts');
  fs.writeFileSync(source, 'export const original = true;\n');
  fs.writeFileSync(path.join(root, '.env.release.local'), 'SECRET=never-embed-this\n');
  const original = sourceFingerprint(root);
  fs.utimesSync(source, 1, 1);
  assert.deepEqual(sourceFingerprint(root), original, 'timestamps must not affect provenance');
  fs.writeFileSync(path.join(root, '.env.release.local'), 'SECRET=another-secret\n');
  fs.writeFileSync(path.join(root, 'src', '.env.local'), 'SECRET=inside-source\n');
  fs.writeFileSync(path.join(root, 'src', 'signing.keystore'), 'secret-key-bytes');
  assert.deepEqual(sourceFingerprint(root), original, 'release secrets must not affect provenance');
  fs.writeFileSync(source, 'export const original = false;\n');
  fs.utimesSync(source, 1, 1);
  assert.notEqual(sourceFingerprint(root).sourceFingerprint, original.sourceFingerprint, 'content changes must invalidate provenance even with old timestamps');
  fs.writeFileSync(path.join(root, 'src', 'new.ts'), 'export {};\n');
  assert.equal(sourceFingerprint(root).fileCount, 2, 'untracked new app source must be included');
  assert(matchesProvenance(original, original));
  assert(!matchesProvenance({ ...original, schemaVersion: 2 }, original));
  assert(!matchesProvenance(sourceFingerprint(root), original));
  assert(!matchesProvenance(null, original));
  fs.symlinkSync(source, path.join(root, 'src', 'unsafe.ts'));
  assert.throws(() => sourceFingerprint(root), /symlink/);

  const expected = { packageId: 'com.meharaj.contextengine', versionCode: 6, versionName: '1.0.5', minSdk: 24, targetSdk: 36 };
  const xml = `<manifest package="${expected.packageId}" android:versionCode="6" android:versionName="1.0.5"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/>${REQUIRED_PERMISSIONS.map(permission => `<uses-permission android:name="${permission}"/>`).join('')}</manifest>`;
  const metadata = parseManifest(xml);
  assert(metadataMatches(metadata, expected), 'microphone/data-sync FGS, user-initiated job, and notification permissions are required');
  for (const mismatch of [
    { versionCode: 3 }, { versionName: '1.0.2' }, { packageId: `${expected.packageId}.e2e` },
    { permissions: metadata.permissions.filter(permission => !permission.endsWith('POST_NOTIFICATIONS')) },
    { permissions: [...metadata.permissions, 'android.permission.READ_EXTERNAL_STORAGE'] },
  ]) assert(!metadataMatches({ ...metadata, ...mismatch }, expected));
  assert(!metadataMatches(parseManifest('broken'), expected));

  assert.equal(androidAppId({}), 'com.meharaj.contextengine.e2e');
  assert.equal(MAIN_ACTIVITY, 'com.meharaj.contextengine.MainActivity');
  assert.throws(() => androidAppId({ CONTEXTENGINE_E2E_APP_ID: 'com.meharaj.contextengine', CONTEXTENGINE_PRESERVE_APP_DATA: '1' }), /refusing/);
  assert.throws(() => androidAppId({ CONTEXTENGINE_E2E_APP_ID: 'com.meharaj.contextengine' }), /refusing/);
  assert.throws(() => androidAppId({ CONTEXTENGINE_E2E_APP_ID: 'com.other.app' }), /refusing/);
  console.log('Release gates self-check passed: content provenance, metadata parity, permission contract, isolated QA target.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
