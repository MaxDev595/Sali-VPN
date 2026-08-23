const { spawn } = require('node:child_process');

// Run both Telegram bots locally. The main bot uses API_URL from the root .env,
// so the API itself does not need to be running on this computer.
const services = ['dev:bot', 'dev:support-bot'];
const children = services.map((script) => {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm.cmd run ${script}`]
    : ['run', script];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, TELEGRAM_MODE: 'polling' },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${script} stopped with code ${code}`);
      stopAll();
      process.exitCode = code;
    }
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.once('SIGINT', stopAll);
process.once('SIGTERM', stopAll);
