import { sql, getSession } from './_lib.mjs';

export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });
  try {
    const rows = await sql`SELECT username, is_admin, progress FROM users WHERE id = ${s.id} LIMIT 1`;
    if (!rows[0]) return res.status(401).json({ error: 'Not logged in' });
    return res.status(200).json({ username: rows[0].username, isAdmin: rows[0].is_admin, progress: rows[0].progress });
  } catch (e) {
    console.error('me error', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
