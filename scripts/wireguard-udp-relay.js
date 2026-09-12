const dgram = require('node:dgram');
const { execFileSync } = require('node:child_process');

const listenPort = Number(process.env.WG_RELAY_PORT || 51820);
const wslPort = Number(process.env.WG_WSL_PORT || 51820);
const wslAddress = process.env.WG_WSL_ADDRESS || execFileSync(
  'wsl.exe',
  ['-d', 'Ubuntu', '--', 'hostname', '-I'],
  { encoding: 'utf8' },
).trim().split(/\s+/)[0];

const socket = dgram.createSocket('udp4');
let client;

socket.on('message', (message, remote) => {
  const fromWsl = remote.address === wslAddress && remote.port === wslPort;
  if (fromWsl) {
    if (client) socket.send(message, client.port, client.address);
    return;
  }

  client = { address: remote.address, port: remote.port };
  socket.send(message, wslPort, wslAddress);
});

socket.on('error', (error) => {
  console.error(`WireGuard UDP relay failed: ${error.message}`);
  process.exitCode = 1;
});

socket.bind(listenPort, '0.0.0.0', () => {
  console.log(`WireGuard UDP relay listening on 0.0.0.0:${listenPort} -> ${wslAddress}:${wslPort}`);
});
