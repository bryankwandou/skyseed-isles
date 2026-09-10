// In-game purchase, settled in the game's own ledger and receipted on Solana devnet.
//
// "WAJIB SUDAH BISA IN GAME PURCHASE DENGAN SOLANA DEVNET TANPA UANG ASLI" — devnet, no
// real money. Both halves are load-bearing: see the long note in _solana.mjs for why the
// cluster is pinned and why a custodial treasury key is acceptable here and only here.
//
// The authority on what a child owns is this server, not the chain. Seeds are earned by
// playing, the price check happens here against the stored progress, and the balance moves
// in the database inside the same request. The chain gets a receipt afterwards. That order
// matters: if the RPC is slow or down, a child still gets the hat they earned, and the
// receipt is simply missing. A design where the chain is in the critical path would mean
// twelve children unable to spend their Seeds because devnet is having an afternoon.
import { sql, getSession, readJson } from './_lib.mjs';
import { treasury, writeReceipt, explorerTx, CLUSTER } from './_solana.mjs';

// Prices live on the server. The client shows them, but a client that says a hat costs 0
// must not be believed -- these twelve accounts belong to children who will absolutely try.
// These ids and prices mirror SHOP_SKINS / REFILL_COST in play/game.js, and shop.test.mjs
// asserts the two lists agree: a server catalogue that has quietly drifted from the shop the
// child is looking at is worse than no server catalogue, because it rejects honest buys.
const ENERGY_MAX = 5;
const CATALOG = {
  refill:  { price: 12, kind: 'energy', name: 'Refill 1 energy' },
  aurora:  { price: 30, kind: 'skin',   name: 'Aurora Skin' },
  lantern: { price: 45, kind: 'skin',   name: 'Lantern Skin' },
  comet:   { price: 60, kind: 'skin',   name: 'Comet Skin' }
};

export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: 'Not logged in' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { item } = readJson(req);
  const entry = CATALOG[item];
  if (!entry) return res.status(400).json({ error: 'No such item' });

  try {
    const rows = await sql`SELECT progress FROM users WHERE id = ${s.id} LIMIT 1`;
    const progress = rows[0]?.progress || {};
    const seeds = Number(progress.seeds || 0);

    if (entry.kind === 'skin' && (progress.skins || []).includes(item)) {
      return res.status(409).json({ error: 'Already owned' });
    }
    if (seeds < entry.price) {
      return res.status(402).json({ error: 'Not enough Seeds', seeds, price: entry.price });
    }

    const next = { ...progress, seeds: seeds - entry.price };
    if (entry.kind === 'skin') next.skins = [...(progress.skins || []), item];
    else next.energy = Math.min(ENERGY_MAX, Number(progress.energy ?? ENERGY_MAX) + 1);

    await sql`UPDATE users SET progress = ${JSON.stringify(next)}::jsonb, updated_at = now()
              WHERE id = ${s.id}`;

    // The purchase is already final. Everything below is the receipt, and every failure in
    // it is reported as a missing receipt rather than a failed purchase.
    let receipt = null;
    const payer = treasury();
    if (payer) {
      try {
        const note = `skyseed:buy:${item}:${s.u}:${new Date().toISOString()}`;
        const sig = await writeReceipt(payer, note);
        receipt = { signature: sig, explorer: explorerTx(sig), cluster: CLUSTER };
        await sql`UPDATE users SET progress = ${JSON.stringify({
          ...next,
          receipts: [...(next.receipts || []), { item, sig, at: Date.now() }].slice(-50)
        })}::jsonb WHERE id = ${s.id}`;
      } catch (e) {
        console.error('devnet receipt failed (purchase stands):', e.message);
      }
    }

    return res.status(200).json({
      ok: true, item, price: entry.price, seeds: next.seeds,
      skins: next.skins || [], energy: next.energy,
      receipt,
      // say plainly why there is no receipt, so a missing link is never a mystery
      receiptNote: payer ? undefined : 'Devnet receipts are off: SOLANA_TREASURY_KEY is not set.'
    });
  } catch (e) {
    console.error('buy error', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
