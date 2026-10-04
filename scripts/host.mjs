/**
 * Ledgerline Production Host Runner
 * 
 * Runs database, migrations, API, and Next.js Web in production mode.
 * Accessible locally and over the local area network.
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      ...options,
    });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${cmd} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('       LEDGERLINE PRODUCTION HOSTING RUNNER           ');
  console.log('======================================================\n');

  console.log('[host] 1/3 Checking Database & Migrations...');
  try {
    await run('npm', ['run', 'prisma:deploy', '--workspace', 'apps/api']);
  } catch {
    console.log('[host] Note: using active database connection');
  }

  console.log('\n[host] 2/3 Building Production Bundles...');
  await run('npm', ['run', 'build']);

  console.log('\n[host] 3/3 Launching Production Services...');
  console.log('\n------------------------------------------------------');
  console.log('  Web Dashboard:  http://localhost:3000');
  console.log('  API Endpoint:   http://localhost:4000/api/v1');
  console.log('  API Health:     http://localhost:4000/api/v1/health');
  console.log('------------------------------------------------------\n');

  const concurrently = spawn(
    'npx',
    [
      'concurrently',
      '-k',
      '-n',
      'api,web',
      '-c',
      'cyan,green',
      '"npm run start --workspace apps/api"',
      '"npm run start --workspace apps/web"',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    }
  );

  const shutdown = () => {
    console.log('\n[host] Shutting down services...');
    concurrently.kill('SIGINT');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[host] Failed to host Ledgerline:', err);
  process.exit(1);
});
