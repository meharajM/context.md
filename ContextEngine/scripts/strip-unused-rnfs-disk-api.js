#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const managerPath = path.join(root, 'node_modules', 'react-native-fs', 'RNFSManager.m');
const marker = 'Context Engine intentionally omits the unused RNFS.getFSInfo native export';

if (!fs.existsSync(managerPath)) {
  process.exit(0);
}

const source = fs.readFileSync(managerPath, 'utf8');
if (source.includes(marker)) {
  process.exit(0);
}

const methodStart = source.indexOf('RCT_EXPORT_METHOD(getFSInfo:');
const nextSection = source.indexOf('// [PHAsset fetchAssetsWithALAssetURLs]', methodStart);

if (methodStart < 0 || nextSection < 0) {
  throw new Error(
    'react-native-fs RNFSManager.m changed; audit its getFSInfo implementation before updating the privacy patch.',
  );
}

const replacement = [
  `// ${marker}.`,
  '// The application never calls getFSInfo, and omitting it keeps disk-capacity',
  '// required-reason APIs out of the linked iOS executable.',
  '',
].join('\n');

const patched = `${source.slice(0, methodStart)}${replacement}${source.slice(nextSection)}`;
fs.writeFileSync(managerPath, patched, 'utf8');
console.log('Removed the unused react-native-fs iOS disk-capacity API surface.');
