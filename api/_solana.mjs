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
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';

export const CLUSTER = 'devnet';                     // pinned on purpose — see above
export const RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
export const SKY_MINT = 'G4AD9pew62hL5N6sdAvV65mVj1pX52QeNDA3RH5JzB4R';
export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

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
    const bytes = raw.trim().startsWith('[')
      ? Uint8Array.from(JSON.parse(raw))
      : Uint8Array.from(Buffer.from(raw.trim(), 'base64'));
    return Keypair.fromSecretKey(bytes);
  } catch (e) {
    console.error('SOLANA_TREASURY_KEY is set but could not be parsed:', e.message);
    return null;
  }
}

export function connection() {
  return new Connection(RPC, 'confirmed');
}

// A purchase receipt is a memo transaction: the smallest on-chain fact that says "this
// account bought this item at this time", costs one signature, and needs no token accounts
// to exist first. It is a receipt, not a transfer of value, which is the honest description
// of what an in-game purchase of a hat with earned Seeds actually is.
export async function writeReceipt(payer, note) {
  const conn = connection();
  const tx = new Transaction().add(new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM,
    data: Buffer.from(note, 'utf8')
  }));
  return sendAndConfirmTransaction(conn, tx, [payer], {
    commitment: 'confirmed', maxRetries: 3
  });
}
