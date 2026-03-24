const { spawn } = require('child_process');

async function callMcp(method, args) {
  return new Promise((resolve) => {
    const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: args } };
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdout.on('data', (data) => { resolve(data.toString()); mcp.kill(); });
  });
}

async function runAiTest() {
  const device = "8925E43D-367D-4333-998D-741240F3425F";
  console.log('Clicking Test AI Engine Button...');
  await callMcp('mobile_click_on_screen_at_coordinates', { device, x: 200, y: 150 });
  await new Promise(r => setTimeout(r, 10000)); // Give it 10s to transcribe
  console.log('Transcription should be done.');
}

runAiTest();
