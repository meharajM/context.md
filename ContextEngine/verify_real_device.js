const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function verifyRealDevice() {
  const device = "C0C9ED91-1D91-5FAA-9CB0-4963A929B21D";
  
  console.log('--- Real Device Screen Elements ---');
  const elements = await callMcp('mobile_list_elements_on_screen', { device });
  console.log(elements);

  console.log('--- Taking Screenshot ---');
  const screenshot = await callMcp('mobile_save_screenshot', { device, saveTo: '/Users/meharaj/context.md/ContextEngine/real_device_snapshot.png' });
  console.log(screenshot);
}

verifyRealDevice();
