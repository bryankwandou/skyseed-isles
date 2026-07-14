import { sql, bcrypt, signToken, setSession, readJson } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = readJson(req);
  if (!username || !password) return res.status(400).json({ error: 'Enter your username and password.' });

  try {
    const rows = await sql`
      SELECT id, username, password_hash, is_admin, progress
      FROM users
      WHERE username = ${username} OR email = ${String(username).toLowerCase()}
      LIMIT 1`;
    const user = rows[0];
    const ok = user && await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Wrong username or password.' });
    setSession(res, signToken(user));
    return res.status(200).json({ username: user.username, isAdmin: user.is_admin, progress: user.progress });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
