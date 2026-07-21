// Google sign-in (OAuth 2.0 authorization-code flow).
// Stays disabled until GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set in the environment.
// GET /api/google            -> redirect to Google's consent screen
// GET /api/google?code=...   -> Google redirects back here; we create/find the user and sign them in
import { sql, bcrypt, signToken, setSession } from './_lib.mjs';
import crypto from 'node:crypto';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function redirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/google`;
}

// turn an email into a valid, unique-ish username
function usernameFromEmail(email) {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 14) || 'player';
  return base.length >= 3 ? base : base + 'sky';
}

export default async function handler(req, res) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google sign-in is not set up yet.', configured: false });
  }

  const url = new URL(req.url, 'https://x');
  const code = url.searchParams.get('code');

  // Step 1 — send the child to Google
  if (!code) {
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id', CLIENT_ID);
    auth.searchParams.set('redirect_uri', redirectUri(req));
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', 'openid email');
    auth.searchParams.set('prompt', 'select_account');
    res.setHeader('Location', auth.toString());
    return res.status(302).end();
  }

  // Step 2 — exchange the code for an id_token and sign in
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri(req), grant_type: 'authorization_code'
      })
    });
    const tok = await tokenRes.json();
    if (!tok.id_token) return res.status(401).json({ error: 'Google sign-in failed.' });

    // verify the token with Google rather than trusting the payload
    const infoRes = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok.id_token));
    const info = await infoRes.json();
    if (!infoRes.ok || info.aud !== CLIENT_ID || !info.email || info.email_verified !== 'true') {
      return res.status(401).json({ error: 'Google sign-in could not be verified.' });
    }

    const email = String(info.email).toLowerCase();
    let user = (await sql`SELECT id, username, is_admin FROM users WHERE email = ${email} LIMIT 1`)[0];

    if (!user) {
      // first time: make an account with a random password (they'll use Google from now on)
      let username = usernameFromEmail(email);
      const taken = (await sql`SELECT 1 FROM users WHERE username = ${username} LIMIT 1`)[0];
      if (taken) username = (username + '_' + crypto.randomInt(100, 999)).slice(0, 20);
      const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      user = (await sql`
        INSERT INTO users (username, email, password_hash)
        VALUES (${username}, ${email}, ${hash})
        RETURNING id, username, is_admin`)[0];
    }

    setSession(res, signToken(user));
    res.setHeader('Location', '/play/index.html');
    return res.status(302).end();
  } catch (e) {
    console.error('google auth error', e);
    return res.status(500).json({ error: 'Something went wrong signing in with Google.' });
  }
}
