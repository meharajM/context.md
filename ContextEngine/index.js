/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import RNFS from 'react-native-fs';

// File logger setup
const logFilePath = `${RNFS.DocumentDirectoryPath}/app_debug_logs.txt`;

// Clean log file on boot
RNFS.writeFile(logFilePath, `--- APP LOG STARTED at ${new Date().toISOString()} ---\n`, 'utf8').catch(err => {
  originalConsole.error('Failed to init log file:', err);
});

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

function writeLogToFile(level, args) {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
  }).join(' ');
  
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  
  RNFS.appendFile(logFilePath, logLine, 'utf8').catch(() => {});
}

console.log = (...args) => {
  originalConsole.log(...args);
  writeLogToFile('LOG', args);
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  writeLogToFile('WARN', args);
};

console.error = (...args) => {
  originalConsole.error(...args);
  writeLogToFile('ERROR', args);
};

console.log('File logging active at:', logFilePath);

AppRegistry.registerComponent(appName, () => App);
