const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function testApp() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  
  console.log('--- Typing thought ---');
  // Click on the area where the input usually is (bottom of screen)
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 200, y: 700 });
  await callMcp('mobile_type_keys', { device, text: "This is an automated project thought", submit: false });
  
  console.log('--- Clicking Save ---');
  // Click Save button (right side of footer)
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 330, y: 760 });
  
  console.log('--- Verifying result ---');
  setTimeout(async () => {
    const elements = await callMcp('mobile_list_elements_on_screen', { device });
    console.log(elements);
  }, 5000);
}

testApp();
