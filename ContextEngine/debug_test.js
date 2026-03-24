const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function debugApp() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  
  // 1. Click Input
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 200, y: 700 });
  await new Promise(r => setTimeout(r, 1000));
  
  // 2. Type
  await callMcp('mobile_type_keys', { device, text: "Automated test thought", submit: false });
  await new Promise(r => setTimeout(r, 2000));
  
  // 3. Screenshot
  await callMcp('mobile_save_screenshot', { device, saveTo: '/Users/meharaj/context.md/ContextEngine/debug_input.png' });
  
  // 4. Click Save
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 330, y: 760 });
  await new Promise(r => setTimeout(r, 5000));
  
  // 5. Final Screenshot
  await callMcp('mobile_save_screenshot', { device, saveTo: '/Users/meharaj/context.md/ContextEngine/debug_final.png' });
}

debugApp();
