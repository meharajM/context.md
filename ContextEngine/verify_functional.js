const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function verifyFunctional() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  
  // 1. Click Input area (above keyboard)
  console.log('Clicking input...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 200, y: 550 });
  await new Promise(r => setTimeout(r, 1000));

  // 2. Type text
  console.log('Typing text...');
  await callMcp('mobile_type_keys', { device, text: "Verification successful", submit: false });
  await new Promise(r => setTimeout(r, 1000));

  // 3. Click Save button (Right side, above keyboard)
  console.log('Clicking Save...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 330, y: 550 });
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Verification check:');
}

verifyFunctional();
