/**
 * Local development database.
 *
 * Drives the PostgreSQL binaries that ship with the `embedded-postgres` dev
 * dependency, so the app runs on a machine with no PostgreSQL installed. Same
 * engine and same Prisma provider as production — nothing about the schema
 * changes.
 *
 *   npm run db:start    start it (detached) and exit
 *   npm run db:stop     stop it
 *   npm run db:status   check whether it is actually answering queries
 *
 * Two things this script deliberately does not do:
 *
 *   1. It does not keep a parent Node process alive to hold the server open.
 *      pg_ctl launches postgres as an independent service that survives this
 *      script exiting. The alternative — postgres as a child of a long-running
 *      Node process — leaves an orphan whenever that parent is killed, and the
 *      orphan can keep the port bound while answering nothing. A socket that
 *      completes a TCP handshake but never answers a query looks exactly like a
 *      mysterious application bug.
 *
 *   2. It does not shell out to psql / createdb / pg_isready. This distribution
 *      ships only initdb, pg_ctl and postgres, so readiness and database
 *      creation go through the `pg` driver instead.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.pgdata');
const logFile = join(dataDir, 'server.log');
const port = Number(process.env.DEV_DB_PORT ?? 5432);
const database = 'rejoice';

const binDir = join(root, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
const exe = (name) => join(binDir, process.platform === 'win32' ? `${name}.exe` : name);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Does the server actually answer a query? A bound port is not enough. */
async function isUp() {
  const client = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function ensureDatabase() {
  const client = new pg.Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (rowCount === 0) {
      // CREATE DATABASE cannot be parameterised; the name is a constant here.
      await client.query(`CREATE DATABASE "${database}"`);
      console.log(`Created database "${database}".`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

if (!existsSync(binDir)) {
  console.error('PostgreSQL binaries are missing. Run `npm install` first.');
  process.exit(1);
}

const command = process.argv.includes('--stop')
  ? 'stop'
  : process.argv.includes('--status')
    ? 'status'
    : 'start';

if (command === 'status') {
  const up = await isUp();
  console.log(up ? `PostgreSQL is answering on port ${port}.` : 'PostgreSQL is not running.');
  process.exit(up ? 0 : 1);
}

if (command === 'stop') {
  const res = spawnSync(exe('pg_ctl'), ['-D', dataDir, '-m', 'fast', 'stop'], {
    encoding: 'utf8',
  });
  console.log(res.status === 0 ? 'Database stopped.' : 'Database was not running.');
  rmSync(join(dataDir, 'postmaster.pid'), { force: true });
  process.exit(0);
}

/* ---- start ---- */

if (await isUp()) {
  console.log(`PostgreSQL already running on port ${port}.`);
  process.exit(0);
}

// A pid file left by a crashed server blocks startup. Nothing is answering on
// the port at this point, so it is safe to clear.
rmSync(join(dataDir, 'postmaster.pid'), { force: true });

if (!existsSync(dataDir)) {
  console.log('Initialising a new cluster in .pgdata …');
  mkdirSync(dataDir, { recursive: true });

  const pwFile = join(root, '.pgpass.tmp');
  writeFileSync(pwFile, 'postgres');
  try {
    /*
     * UTF-8 is forced. On Windows initdb otherwise inherits the system locale
     * (typically English_United States.1252) and creates a WIN1252 cluster,
     * which then rejects the first emoji in a YouTube title.
     */
    const init = spawnSync(
      exe('initdb'),
      ['-D', dataDir, '-U', 'postgres', '--pwfile', pwFile, '--encoding=UTF8', '--locale=C'],
      { encoding: 'utf8' },
    );
    if (init.status !== 0) {
      console.error(init.stderr || init.stdout);
      process.exit(1);
    }
  } finally {
    rmSync(pwFile, { force: true });
  }
}

/*
 * stdio must be ignored, not inherited. postgres holds inherited handles open
 * for its whole lifetime, so spawnSync would block until the server shut down —
 * the command appears to hang forever even though the database started fine.
 */
const start = spawnSync(
  exe('pg_ctl'),
  ['-D', dataDir, '-l', logFile, '-o', `-p ${port}`, 'start'],
  { stdio: 'ignore' },
);

if (start.status !== 0) {
  console.error(`pg_ctl exited with ${start.status}. See ${logFile}.`);
  process.exit(1);
}

let ready = false;
for (let i = 0; i < 30; i++) {
  if (await isUp()) {
    ready = true;
    break;
  }
  await sleep(500);
}

if (!ready) {
  console.error(`PostgreSQL did not answer within 15s. See ${logFile}.`);
  process.exit(1);
}

await ensureDatabase();

console.log(`PostgreSQL running on port ${port}.`);
console.log(
  `DATABASE_URL="postgresql://postgres:postgres@localhost:${port}/${database}?schema=public"`,
);
console.log('\nRunning detached — this terminal is free. Stop it with: npm run db:stop');
