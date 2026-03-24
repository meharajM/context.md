const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function topTest() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  
  console.log('Clicking input...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 100, y: 200 });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Typing...');
  await callMcp('mobile_type_keys', { device, text: "Top test success", submit: false });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Clicking Save...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 330, y: 260 });
  await new Promise(r => setTimeout(r, 5000));
}

topTest();
