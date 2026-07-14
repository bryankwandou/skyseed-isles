import { clearSession } from './_lib.mjs';

export default async function handler(req, res) {
  clearSession(res);
  return res.status(200).json({ ok: true });
}
