const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function verifyAndroid() {
  const device = "emulator-5554";
  
  console.log('--- Android Screen Elements ---');
  const elements = await callMcp('mobile_list_elements_on_screen', { device });
  console.log(elements);

  console.log('--- Taking Screenshot ---');
  const screenshot = await callMcp('mobile_save_screenshot', { device, saveTo: '/Users/meharaj/context.md/ContextEngine/android_snapshot.png' });
  console.log(screenshot);
}

verifyAndroid();
