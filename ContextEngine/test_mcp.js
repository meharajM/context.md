const { spawn } = require('child_process');

async function listDevices() {
  const mcp = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest', '--stdio']);
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'mobile_list_available_devices',
      arguments: {}
    }
  };

  mcp.stdin.write(JSON.stringify(request) + '\n');

  mcp.stdout.on('data', (data) => {
    console.log('Response:', data.toString());
    mcp.kill();
  });

  mcp.stderr.on('data', (data) => {
    // console.error('Error:', data.toString());
  });
}

listDevices();
