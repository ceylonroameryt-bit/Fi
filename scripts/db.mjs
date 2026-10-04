/**
 * Local development PostgreSQL server.
 *
 * Runs a real PostgreSQL instance from the `embedded-postgres` npm package so the
 * project can be developed without Docker or a system-wide PostgreSQL install.
 * If you already run PostgreSQL elsewhere, skip this script and point
 * DATABASE_URL / DATABASE_URL_TEST at your own server instead.
 *
 * Creates two databases: `ledgerline` (development) and `ledgerline_test` (e2e tests).
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = resolve(root, '.data', 'postgres');
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
const user = process.env.LOCAL_PG_USER ?? 'ledgerline';
const password = process.env.LOCAL_PG_PASSWORD ?? 'ledgerline_dev_password';

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => undefined,
  onError: (message) => console.error('[postgres]', String(message).trim()),
});

async function main() {
  const fresh = !existsSync(resolve(databaseDir, 'PG_VERSION'));
  if (fresh) {
    console.log(`[db] initialising cluster in ${databaseDir}`);
    await pg.initialise();
  }
  await pg.start();
  for (const name of ['ledgerline', 'ledgerline_test']) {
    try {
      await pg.createDatabase(name);
      console.log(`[db] created database ${name}`);
    } catch {
      // Database already exists.
    }
  }
  console.log(`[db] PostgreSQL ready on postgresql://${user}:***@localhost:${port}/ledgerline`);
  console.log('[db] press Ctrl+C to stop');

  const shutdown = async () => {
    console.log('[db] stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('[db] failed to start', error);
  try {
    await pg.stop();
  } catch {
    // ignore
  }
  process.exit(1);
});
