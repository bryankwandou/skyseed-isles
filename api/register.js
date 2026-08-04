import { sql, bcrypt, signToken, setSession, readJson, USERNAME_RE, EMAIL_RE } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, email, password, confirm, acceptedTerms, acceptedPrivacy } = readJson(req);

  if (!USERNAME_RE.test(username || '')) return res.status(400).json({ error: 'Username must be 3–20 letters, numbers or underscores.' });
  // Email is OPTIONAL. Most children signing up for this do not have one, and demanding it
  // was the single thing most likely to stop a child finishing the form on their own. If
  // they leave it blank we mint the same placeholder the family dashboard already uses.
  // A blank email means no password recovery by email — the parent resets it instead.
  const hasEmail = (email || '').trim().length > 0;
  if (hasEmail && !EMAIL_RE.test(email.trim())) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if ((password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (password !== confirm) return res.status(400).json({ error: 'The two passwords do not match.' });
  if (!acceptedTerms || !acceptedPrivacy) return res.status(400).json({ error: 'Please accept the Terms and the Privacy agreement.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const mail = hasEmail ? email.trim().toLowerCase()
                          : username.toLowerCase() + '@child.skyseed.local';
    const rows = await sql`
      INSERT INTO users (username, email, password_hash)
      VALUES (${username}, ${mail}, ${hash})
      RETURNING id, username, is_admin, progress`;
    const user = rows[0];
    setSession(res, signToken(user));
    return res.status(200).json({ username: user.username, isAdmin: user.is_admin, progress: user.progress });
  } catch (e) {
    if (/duplicate|unique/i.test(String(e.message || ''))) {
      return res.status(409).json({ error: 'That username or email is already taken.' });
    }
    console.error('register error', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
