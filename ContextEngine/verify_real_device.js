const { spawn } = require('child_process');

process.env.MOBILECLI_PATH = process.env.MOBILECLI_PATH || '/opt/homebrew/bin/mobilecli';

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function listDevices() {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mobile_list_available_devices', arguments: {} },
    };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function verifyRealDevice() {
  const devicesRaw = await listDevices();
  const parsed = JSON.parse(devicesRaw);
  const devicesPayload = JSON.parse(parsed?.result?.content?.[0]?.text || '{}');
  const devices = Array.isArray(devicesPayload?.devices) ? devicesPayload.devices : [];
  const realIos = devices.find((d) => d.platform === 'ios' && d.type === 'real' && d.state === 'online');
  if (!realIos) {
    console.log('No online iOS real device found.');
    return;
  }
  const device = realIos.id;
  
  console.log('--- Real Device Screen Elements ---');
  const elements = await callMcp('mobile_list_elements_on_screen', { device });
  console.log(elements);

  console.log('--- Taking Screenshot ---');
  const screenshot = await callMcp('mobile_save_screenshot', { device, saveTo: '/Users/meharaj/context.md/ContextEngine/real_device_snapshot.png' });
  console.log(screenshot);
}

verifyRealDevice();
