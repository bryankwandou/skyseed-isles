import { sql, bcrypt, signToken, setSession, readJson } from './_lib.mjs';

// Simple in-memory throttle. Serverless instances are short-lived, so this is a speed bump
// against online guessing rather than a hard guarantee — good enough for a family game,
// and it costs nothing. A shared store would be needed for a real lockout.
const attempts = new Map(); // key -> { n, until }
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 8;

function throttleKey(req, username) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  return ip + '|' + String(username || '').toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = readJson(req);
  if (!username || !password) return res.status(400).json({ error: 'Enter your username and password.' });

  const key = throttleKey(req, username);
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.until > now && rec.n >= MAX_TRIES) {
    const mins = Math.ceil((rec.until - now) / 60000);
    return res.status(429).json({ error: `Too many tries. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.` });
  }

  try {
    const rows = await sql`
      SELECT id, username, password_hash, is_admin, progress
      FROM users
      WHERE username = ${username} OR email = ${String(username).toLowerCase()}
      LIMIT 1`;
    const user = rows[0];
    const ok = user && await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const cur = (rec && rec.until > now) ? rec : { n: 0, until: now + WINDOW_MS };
      cur.n++; attempts.set(key, cur);
      return res.status(401).json({ error: 'Wrong username or password.' });
    }
    attempts.delete(key); // a good login clears the counter
    setSession(res, signToken(user));
    return res.status(200).json({ username: user.username, isAdmin: user.is_admin, progress: user.progress });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
