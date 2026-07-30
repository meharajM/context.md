#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const whisperPackagePath = path.join(root, 'node_modules', 'whisper.rn', 'package.json');

if (!fs.existsSync(whisperPackagePath)) {
  process.exit(0);
}

const packageJson = JSON.parse(fs.readFileSync(whisperPackagePath, 'utf8'));
const codegenConfig = packageJson.codegenConfig;

if (!codegenConfig || codegenConfig.type === 'modules') {
  process.exit(0);
}

packageJson.codegenConfig = {
  ...codegenConfig,
  type: 'modules',
};

fs.writeFileSync(whisperPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log('Patched whisper.rn codegen config for iOS build compatibility.');
