// Recovery hatch for the parent account — there is no email flow by design,
// so this is how you get back in if the parent password is forgotten.
// It requires database access, which only the parent has.
//
// Usage (PowerShell), from the project folder:
//   $env:DATABASE_URL="<from .env.local>"; $env:NEW_PASSWORD="your-new-password"; node scripts/reset-parent-password.mjs
//
// Optional: $env:PARENT_USERNAME="nayrbryanGaming" (defaults to that)
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;
const NEW_PASSWORD = process.env.NEW_PASSWORD;
const USERNAME = process.env.PARENT_USERNAME || 'nayrbryanGaming';

if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }
if (!NEW_PASSWORD || NEW_PASSWORD.length < 8) {
  console.error('Set NEW_PASSWORD to at least 8 characters (env only — never in a file).');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const user = (await sql`SELECT id, is_admin FROM users WHERE username = ${USERNAME} LIMIT 1`)[0];
if (!user) { console.error(`No account named "${USERNAME}".`); process.exit(1); }

const hash = await bcrypt.hash(NEW_PASSWORD, 10);
await sql`UPDATE users SET password_hash = ${hash}, is_admin = TRUE, updated_at = now() WHERE id = ${user.id}`;

console.log(`Password reset for "${USERNAME}" (parent access restored). Password not shown.`);
process.exit(0);
