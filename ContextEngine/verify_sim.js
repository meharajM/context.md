const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function verifySimulator() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  
  console.log('Finding elements...');
  const elementsRaw = await callMcp('mobile_list_elements_on_screen', { device });
  console.log(elementsRaw);
  
  // Try to click the input field (at y=700)
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 200, y: 700 });
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Typing...');
  await callMcp('mobile_type_keys', { device, text: "Automated simulator test", submit: true });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Save (at y=760)
  console.log('Saving...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 330, y: 760 });
  await new Promise(r => setTimeout(r, 3000));
}

verifySimulator();
