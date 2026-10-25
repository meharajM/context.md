#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const downloaderPath = path.join(
  root,
  'node_modules',
  'react-native-fs',
  'android',
  'src',
  'main',
  'java',
  'com',
  'rnfs',
  'Downloader.java',
);
const timeoutMarker = 'Context Engine preserves configured timeouts after download redirects';
const headersMarker = 'Context Engine forwards request headers after download redirects';

if (!fs.existsSync(downloaderPath)) {
  process.exit(0);
}

const source = fs.readFileSync(downloaderPath, 'utf8');
if (source.includes(timeoutMarker) && source.includes(headersMarker)) {
  process.exit(0);
}

const original = [
  '        connection = (HttpURLConnection) new URL(redirectURL).openConnection();',
  '        connection.setConnectTimeout(5000);',
  '        connection.connect();',
].join('\n');

const timeoutOnly = [
  '        connection = (HttpURLConnection) new URL(redirectURL).openConnection();',
  `        // ${timeoutMarker}.`,
  '        connection.setConnectTimeout(param.connectionTimeout);',
  '        connection.setReadTimeout(param.readTimeout);',
  '        connection.connect();',
].join('\n');

const replacement = [
  '        connection = (HttpURLConnection) new URL(redirectURL).openConnection();',
  `        // ${timeoutMarker}.`,
  '        connection.setConnectTimeout(param.connectionTimeout);',
  '        connection.setReadTimeout(param.readTimeout);',
  `        // ${headersMarker}.`,
  '        iterator = param.headers.keySetIterator();',
  '        while (iterator.hasNextKey()) {',
  '          String key = iterator.nextKey();',
  '          String value = param.headers.getString(key);',
  '          connection.setRequestProperty(key, value);',
  '        }',
  '        connection.connect();',
].join('\n');

if (source.includes(timeoutOnly)) {
  fs.writeFileSync(downloaderPath, source.replace(timeoutOnly, replacement), 'utf8');
  console.log('Preserved react-native-fs timeouts and request headers after Android download redirects.');
  process.exit(0);
}

if (!source.includes(original)) {
  throw new Error(
    'react-native-fs Android redirect code changed; audit redirect timeout handling before updating the patch.',
  );
}

fs.writeFileSync(downloaderPath, source.replace(original, replacement), 'utf8');
console.log('Preserved react-native-fs timeouts and request headers after Android download redirects.');
