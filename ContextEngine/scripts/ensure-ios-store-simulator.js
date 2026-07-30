const { execFileSync } = require('child_process');

const target = process.argv[2];
const targets = {
  iphone: {
    name: 'ContextEngine Store iPhone 16 Pro Max',
    type: 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max',
  },
  ipad: {
    name: 'ContextEngine Store iPad Pro 13',
    type: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M4-8GB',
  },
};
const requested = targets[target];

if (!requested) {
  console.error(`Usage: node scripts/ensure-ios-store-simulator.js ${Object.keys(targets).join('|')}`);
  process.exit(2);
}

function simctlJson(...args) {
  return JSON.parse(execFileSync('xcrun', ['simctl', 'list', ...args, '--json'], { encoding: 'utf8' }));
}

const devices = simctlJson('devices', 'available').devices;
const existing = Object.values(devices)
  .flat()
  .find(device => device.isAvailable && device.deviceTypeIdentifier === requested.type);

if (existing) {
  console.log(`${target} store simulator ready: ${existing.name} (${existing.udid})`);
  process.exit(0);
}

const runtimes = simctlJson('runtimes').runtimes
  .filter(runtime => runtime.isAvailable && runtime.platform === 'iOS')
  .sort((left, right) =>
    right.version.localeCompare(left.version, undefined, { numeric: true, sensitivity: 'base' }),
  );
const runtime = runtimes[0];

if (!runtime) {
  console.error('No available iOS Simulator runtime was found.');
  process.exit(1);
}

const udid = execFileSync(
  'xcrun',
  ['simctl', 'create', requested.name, requested.type, runtime.identifier],
  { encoding: 'utf8' },
).trim();
console.log(`${target} store simulator created on iOS ${runtime.version}: ${udid}`);
