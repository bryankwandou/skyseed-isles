import { sql, getSession } from './_lib.mjs';

// Family board — what every child in the family has been up to, plus one shared goal.
// Any signed-in child may read it, so it deliberately returns nothing private: no email,
// no id, no last-played time. Just a name and the same counts the child already sees on
// their own HUD.
const GOAL = 5000; // family sparks target — a number twelve children can reach together

export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rows = await sql`
      SELECT username,
             COALESCE((progress->>'sparks')::int, 0)             AS sparks,
             COALESCE(jsonb_array_length(progress->'pets'), 0)    AS buddies,
             COALESCE(jsonb_array_length(progress->'builds'), 0)  AS builds,
             COALESCE(jsonb_array_length(progress->'badges'), 0)  AS badges
      FROM users WHERE is_admin = FALSE
      ORDER BY sparks DESC, username ASC LIMIT 50`;
    const total = rows.reduce((n, r) => n + r.sparks, 0);
    return res.status(200).json({ players: rows, total, goal: GOAL, me: s.u });
  } catch (e) {
    console.error('board error', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
