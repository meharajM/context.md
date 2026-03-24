const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function finalTest() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  
  // 1. Click Input (x:200, y:650 to be safe from keyboard)
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 200, y: 650 });
  
  // 2. Type with Submit
  console.log('Typing...');
  await callMcp('mobile_type_keys', { device, text: "Final verification thought", submit: true });
  await new Promise(r => setTimeout(r, 2000));
  
  // 3. Click Save (Try different coord)
  console.log('Saving...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 330, y: 730 });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('Done.');
}

finalTest();
