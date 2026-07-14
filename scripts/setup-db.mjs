// One-off: create schema + seed the max-progress admin account.
// Reads all secrets from env. Never logs the password.
// Usage (PowerShell): $env:DATABASE_URL="..."; $env:ADMIN_PASSWORD="..."; npm run setup-db
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'nayrbryanGaming';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'nayrbryangaming3@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { console.error('Missing ADMIN_PASSWORD (set it only in env, never in a file)'); process.exit(1); }

// Everything the game currently has, fully unlocked — for QA before handing to kids.
const MAX_PROGRESS = {
  sparks: 999999,
  unlocked: ['jump', 'glide', 'triple', 'magnet', 'speed', 'trail', 'float'],
  biomes: ['Meadow Isles', 'Sunset Grove', 'Snow Isles', 'Starfall Isles', 'Candy Reef'],
  pets: [
    { level: 8, color: 0x7fe8c9, name: 'Boba' },
    { level: 8, color: 0xff9ec6, name: 'Mochi' },
    { level: 8, color: 0xffd98a, name: 'Pudding' },
    { level: 8, color: 0xa0c8ff, name: 'Kiwi' }
  ],
  builds: []
};

const sql = neon(DATABASE_URL);

async function run() {
  // schema (kept in sync with db/schema.sql)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
      progress      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`;
  console.log('schema ready');

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await sql`
    INSERT INTO users (username, email, password_hash, is_admin, progress)
    VALUES (${ADMIN_USERNAME}, ${ADMIN_EMAIL}, ${hash}, TRUE, ${JSON.stringify(MAX_PROGRESS)}::jsonb)
    ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          is_admin = TRUE,
          progress = EXCLUDED.progress,
          updated_at = now()`;
  console.log('admin account ready (username:', ADMIN_USERNAME + ', password not shown)');

  const count = await sql`SELECT count(*)::int AS n FROM users`;
  console.log('users in database:', count[0].n);
}

run().then(() => process.exit(0)).catch(e => { console.error('setup failed:', e.message); process.exit(1); });
