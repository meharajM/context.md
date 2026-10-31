#!/usr/bin/env node

const crypto = require('crypto');
const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');

// Explicit inputs keep signing keys, local environment, captures and build outputs out.
const INPUTS = [
  'App.tsx', 'index.js', 'app.json', 'package.json', 'package-lock.json',
  'babel.config.js', 'metro.config.js', 'react-native.config.js', 'tsconfig.json',
  'src', 'android/app/src/main', 'android/app/build.gradle',
  'android/app/proguard-rules.pro', 'android/build.gradle', 'android/settings.gradle',
  'android/gradle.properties', 'android/gradle/wrapper/gradle-wrapper.properties',
  'scripts',
];

function sourceFingerprint(root) {
  const files = [];
  function collect(relative) {
    if (/^(?:\.env(?:\.|$)|.*\.(?:jks|keystore|p12|p8|pem|key)$)/.test(path.basename(relative))) return;
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Provenance input must not be a symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) collect(`${relative}/${name}`);
    } else if (!relative.endsWith('.md') && !relative.includes('/__tests__/') && !relative.endsWith('.test.js')) {
      files.push(relative);
    }
  }
  INPUTS.forEach(collect);
  const hash = crypto.createHash('sha256');
  for (const relative of files.sort()) {
    const fileHash = crypto.createHash('sha256');
    const fd = fs.openSync(path.join(root, relative), 'r');
    const chunk = Buffer.alloc(1024 * 1024);
    try {
      let size;
      while ((size = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) fileHash.update(chunk.subarray(0, size));
    } finally {
      fs.closeSync(fd);
    }
    hash.update(`${relative}\0${fileHash.digest('hex')}\n`);
  }
  return { schemaVersion: 1, algorithm: 'sha256', sourceFingerprint: hash.digest('hex'), fileCount: files.length };
}

function matchesProvenance(actual, expected) {
  return actual?.schemaVersion === expected.schemaVersion && actual?.algorithm === expected.algorithm &&
    actual?.sourceFingerprint === expected.sourceFingerprint && actual?.fileCount === expected.fileCount;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const output = process.argv[2];
  if (!output) throw new Error('Provide the generated release-provenance.json output path.');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(sourceFingerprint(root))}\n`);
}

module.exports = { sourceFingerprint, matchesProvenance };
