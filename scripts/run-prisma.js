const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { config } = require('dotenv');

const rootDir = resolve(__dirname, '..');
const apiDir = resolve(rootDir, 'apps/api');
config({ path: resolve(rootDir, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing in the root .env file.');
  process.exit(1);
}

const prismaCli = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: apiDir,
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
