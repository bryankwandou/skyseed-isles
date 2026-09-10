// Shared helpers for the Skyseed Isles API (files prefixed with _ are not routes).
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Connect on first use, not at import. `neon()` throws when DATABASE_URL is unset, and at
// module scope that turns one missing environment variable into an route that cannot even be
// imported -- the whole file fails to load, so the handler never runs and never gets to
// report what is wrong. Lazily, the same mistake surfaces as a 500 on the one request that
// needed the database, with a message saying so.
let _sql = null;
export const sql = (strings, ...values) => {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql(strings, ...values);
};
export { bcrypt };

const SECRET = process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
const COOKIE = 'sky_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function signToken(user) {
  return jwt.sign({ id: user.id, u: user.username, a: !!user.is_admin }, SECRET, { expiresIn: '30d' });
}

export function setSession(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export function getSession(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sky_session=([^;]+)/);
  if (!m) return null;
  try { return jwt.verify(decodeURIComponent(m[1]), SECRET); } catch { return null; }
}
