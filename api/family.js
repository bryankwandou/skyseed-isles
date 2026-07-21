import { sql, getSession, readJson } from './_lib.mjs';

// Parent dashboard API — admin only.
export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });

  try {
    // verify admin against the database (never trust the token alone)
    const me = (await sql`SELECT id, is_admin FROM users WHERE id = ${s.id} LIMIT 1`)[0];
    if (!me || !me.is_admin) return res.status(403).json({ error: 'Parents only' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, username, is_admin, created_at, updated_at,
               COALESCE((progress->>'sparks')::int, 0)                    AS sparks,
               COALESCE(jsonb_array_length(progress->'pets'), 0)          AS buddies,
               COALESCE(jsonb_array_length(progress->'builds'), 0)        AS builds,
               COALESCE(jsonb_array_length(progress->'biomes'), 0)        AS biomes,
               COALESCE((progress->'quest'->>'i')::int, 0)                AS quests,
               COALESCE((progress->>'bops')::int, 0)                      AS bops
        FROM users ORDER BY is_admin DESC, username ASC`;
      return res.status(200).json({ users: rows });
    }

    if (req.method === 'DELETE') {
      const { id } = readJson(req);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
      if (id === me.id) return res.status(400).json({ error: 'You cannot delete your own parent account.' });
      const target = (await sql`SELECT is_admin FROM users WHERE id = ${id} LIMIT 1`)[0];
      if (!target) return res.status(404).json({ error: 'Account not found' });
      if (target.is_admin) return res.status(400).json({ error: 'Cannot delete another parent account.' });
      await sql`DELETE FROM users WHERE id = ${id} AND is_admin = FALSE`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('family error', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
