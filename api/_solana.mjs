// Devnet-only Solana helpers for the in-game shop.
//
// READ THIS BEFORE CHANGING THE CLUSTER.
// Every purchase here is signed server-side by a treasury key held in the environment.
// That is a custodial design, and it is only defensible because of two facts that hold
// together and must keep holding together:
//
//   1. The cluster is devnet. Devnet SOL is free and worthless.
//   2. SKY has zero monetary value by design (web3/skyhours-config.json says so, and the
//      mint has 0 decimals and no market).
//
// So the treasury key guards nothing. Twelve children with no wallets can make a real
// on-chain purchase and an auditor can click through to the explorer and see it, and the
// worst case if the key leaks is that somebody spends play money on a test network.
//
// Point this at mainnet and both facts stop holding at once: a leaked key would then be a
// real theft, and children would be spending real money. That is not a config change, it is
// a different product with different law attached (age-restricted purchasing, custody
// rules, refunds). CLUSTER is pinned below rather than read from the environment precisely
// so that nobody can make that change by editing a dashboard field.
//
// WHY THERE IS NO @solana/web3.js HERE.
// There was, for one deploy. It cannot load in Vercel's Node runtime: it pulls in
// rpc-websockets, whose CommonJS build require()s an ESM uuid, and the function dies at
// import with ERR_REQUIRE_ESM before any handler runs. A transaction that writes one memo
// needs an ed25519 signature, base58, and an HTTP POST -- so it is built here directly on
// @noble/curves and bs58. Fewer moving parts, a far smaller cold start, and nothing in the
// dependency tree that can decide to break the shop.
import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';

export const CLUSTER = 'devnet';                     // pinned on purpose — see above
export const RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
export const SKY_MINT = 'G4AD9pew62hL5N6sdAvV65mVj1pX52QeNDA3RH5JzB4R';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export function explorerTx(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
}

// The treasury key is optional. Without it the shop still works — purchases settle in the
// game's own ledger exactly as they always have — and the on-chain receipt is simply not
// offered. This mirrors how Google sign-in behaves in this codebase: the feature announces
// itself as unavailable rather than the page breaking, so a missing secret degrades one
// feature instead of taking down the shop for twelve children.
export function treasury() {
  const raw = process.env.SOLANA_TREASURY_KEY;
  if (!raw) return null;
  try {
    const t = raw.trim();
    // accept the three shapes a devnet key is usually pasted in: a JSON array from
    // solana-keygen, base58 from a wallet export, or base64
    let bytes;
    if (t.startsWith('[')) bytes = Uint8Array.from(JSON.parse(t));
    else if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(t) && t.length > 80) bytes = bs58.decode(t);
    else bytes = Uint8Array.from(Buffer.from(t, 'base64'));
    // a Solana secret key is the 32-byte seed followed by the 32-byte public key
    if (bytes.length !== 64) throw new Error('bad secret key size: ' + bytes.length);
    const secret = bytes.slice(0, 32);
    const publicKey = ed25519.getPublicKey(secret);
    if (bs58.encode(publicKey) !== bs58.encode(bytes.slice(32))) {
      throw new Error('secret key does not match its public key');
    }
    return { secret, publicKey, address: bs58.encode(publicKey) };
  } catch (e) {
    console.error('SOLANA_TREASURY_KEY is set but could not be used:', e.message);
    return null;
  }
}

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(method + ': ' + (j.error.message || JSON.stringify(j.error)));
  return j.result;
}

// Solana's compact-u16: the length prefix used for every array in a transaction.
function compactU16(n) {
  const out = [];
  for (;;) {
    if (n < 0x80) { out.push(n); break; }
    out.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return out;
}

// A legacy transaction message: header, account keys, blockhash, instructions.
// The memo program takes no accounts, so the only key that matters is the fee payer.
function buildMessage(payerPubkey, blockhash, memo) {
  const parts = [];
  parts.push(1, 0, 1);                                   // 1 signer, 0 readonly-signed, 1 readonly-unsigned
  parts.push(...compactU16(2));                          // account keys: payer, memo program
  parts.push(...payerPubkey);
  parts.push(...bs58.decode(MEMO_PROGRAM));
  parts.push(...bs58.decode(blockhash));
  parts.push(...compactU16(1));                          // one instruction
  parts.push(1);                                         // program id index -> the memo program
  parts.push(...compactU16(0));                          // no accounts
  const data = Buffer.from(memo, 'utf8');
  parts.push(...compactU16(data.length));
  parts.push(...data);
  return Uint8Array.from(parts);
}

// A purchase receipt is a memo transaction: the smallest on-chain fact that says "this
// account bought this item at this time", costs one signature, and needs no token accounts
// to exist first. It is a receipt, not a transfer of value, which is the honest description
// of what an in-game purchase of a hat with earned Seeds actually is.
export async function writeReceipt(payer, note) {
  const { blockhash } = (await rpc('getLatestBlockhash', [{ commitment: 'finalized' }])).value;
  const message = buildMessage(payer.publicKey, blockhash, note);
  const signature = ed25519.sign(message, payer.secret);
  const tx = Uint8Array.from([...compactU16(1), ...signature, ...message]);
  const sig = await rpc('sendTransaction', [
    Buffer.from(tx).toString('base64'),
    { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }
  ]);
  return sig;
}

// Exported for the test: it builds the same bytes without sending them, so the shape of a
// receipt can be checked on a machine with no funded key.
export function buildReceiptTx(payer, blockhash, note) {
  const message = buildMessage(payer.publicKey, blockhash, note);
  const signature = ed25519.sign(message, payer.secret);
  return {
    message,
    signature,
    valid: ed25519.verify(signature, message, payer.publicKey),
    raw: Uint8Array.from([...compactU16(1), ...signature, ...message])
  };
}
