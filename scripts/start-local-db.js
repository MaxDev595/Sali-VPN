const path = require('node:path');
const { existsSync } = require('node:fs');

async function main() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = path.join(process.env.TEMP || process.env.TMP || __dirname, 'sali-vpn-postgres');
  const database = new EmbeddedPostgres({ databaseDir, user: 'sali', password: 'sali_password', port: 55432, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'] });
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await database.initialise();
  await database.start();
  await database.createDatabase('sali').catch((error) => { if (!String(error).includes('already exists')) throw error; });
  console.log('Local PostgreSQL is listening on 127.0.0.1:55432');
  const stop = async () => { await database.stop().catch(() => {}); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  await new Promise(() => {});
}
main().catch((error) => { console.error(error); process.exit(1); });
