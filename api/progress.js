import { sql, getSession, readJson } from './_lib.mjs';

export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT progress FROM users WHERE id = ${s.id} LIMIT 1`;
      return res.status(200).json({ progress: rows[0]?.progress || {} });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const { progress } = readJson(req);
      if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) {
        return res.status(400).json({ error: 'Invalid progress payload' });
      }
      // guard against runaway payloads
      const json = JSON.stringify(progress);
      if (json.length > 200000) return res.status(413).json({ error: 'Progress too large' });
      await sql`UPDATE users SET progress = ${json}::jsonb, updated_at = now() WHERE id = ${s.id}`;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('progress error', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
