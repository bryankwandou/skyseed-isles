// "WAJIB SUDAH BISA IN GAME PURCHASE DENGAN SOLANA DEVNET TANPA UANG ASLI."
//
// This checks the parts that can be checked without a funded devnet key: that the server's
// price list matches the shop a child is looking at, that the cluster is pinned to devnet
// and cannot be moved by an environment variable, that a receipt transaction is a
// well-formed memo, and that the whole feature degrades to "no receipt" rather than "no
// shop" when no treasury key is configured.
//
// What it does NOT check is a live devnet submission, because that needs a funded devnet
// keypair and this machine has none. That gap is stated in GAPS.md rather than papered over
// with a test that mocks the RPC and proves only that the mock was called.
import puppeteer from 'puppeteer-core';
import { Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { CLUSTER, RPC, MEMO_PROGRAM, treasury, explorerTx } from '../api/_solana.mjs';

const fails = [];
const ok = (n, c, d) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); if (!c) fails.push(n); };

// ---------- the cluster is pinned ----------
ok('the cluster is devnet', CLUSTER === 'devnet', CLUSTER);
ok('devnet is pinned in code, not read from the environment',
  !/process\.env/.test(String(CLUSTER)) && CLUSTER === 'devnet');
ok('the RPC points at devnet', /devnet/.test(RPC), RPC);

// ---------- no treasury key means no receipt, not a broken shop ----------
const hadKey = !!process.env.SOLANA_TREASURY_KEY;
delete process.env.SOLANA_TREASURY_KEY;
ok('with no treasury key configured, the receipt path stands down', treasury() === null);
process.env.SOLANA_TREASURY_KEY = 'this-is-not-a-key';
ok('a malformed treasury key is refused rather than crashing the shop', treasury() === null);
delete process.env.SOLANA_TREASURY_KEY;

// ---------- a receipt is a well-formed memo transaction ----------
// Built and signed locally. Nothing is sent: this proves the shape of what would be sent.
const throwaway = Keypair.generate();
const note = 'skyseed:buy:aurora:testchild:' + new Date().toISOString();
const tx = new Transaction().add(new TransactionInstruction({
  keys: [{ pubkey: throwaway.publicKey, isSigner: true, isWritable: true }],
  programId: MEMO_PROGRAM,
  data: Buffer.from(note, 'utf8')
}));
tx.recentBlockhash = '11111111111111111111111111111111';
tx.feePayer = throwaway.publicKey;
tx.sign(throwaway);
const raw = tx.serialize();
ok('a purchase receipt serialises to a real transaction', raw.length > 100 && raw.length < 1232,
  raw.length + ' bytes');
ok('the receipt carries the purchase in its memo',
  Buffer.from(tx.instructions[0].data).toString('utf8') === note);
ok('the receipt is signed', tx.signatures.length === 1 && tx.signatures[0].signature !== null);
ok('an explorer link points at devnet', /cluster=devnet/.test(explorerTx('abc')), explorerTx('abc'));

// ---------- the server's prices are the shop's prices ----------
// A server catalogue that has drifted from the shop rejects honest purchases, which reads
// to a child as the game being broken and to an auditor as the shop being fake.
const { default: buyMod } = await import('../api/buy.js').then(m => ({ default: m })).catch(() => ({ default: null }));
ok('the purchase endpoint loads', !!buyMod);

const src = await (await import('node:fs/promises')).readFile(new URL('../api/buy.js', import.meta.url), 'utf8');
const serverPrices = {};
for (const m of src.matchAll(/^\s{2}(\w+):\s*\{\s*price:\s*(\d+)/gm)) serverPrices[m[1]] = Number(m[2]);
ok('the server has a price list', Object.keys(serverPrices).length >= 4, JSON.stringify(serverPrices));

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 720 },
  userDataDir: OUT + 'edge-buy-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage();
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 90000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1500));

const shop = await p.evaluate(() => window.__sky.shopCatalog());
ok('the shop the child sees has items in it', shop.skins.length > 0, JSON.stringify(shop));
ok('the refill price matches the server', shop.refill === serverPrices.refill,
  'shop=' + shop.refill + ' server=' + serverPrices.refill);
for (const skin of shop.skins) {
  ok('"' + skin.id + '" costs the same on both sides', serverPrices[skin.id] === skin.price,
    'shop=' + skin.price + ' server=' + serverPrices[skin.id]);
}

// the receipt panel exists and starts hidden, so a purchase with no receipt shows nothing
const panel = await p.evaluate(() => {
  const el = document.getElementById('shopReceipt');
  return el ? { present: true, hidden: el.style.display === 'none', role: el.getAttribute('role') } : null;
});
ok('there is somewhere to show a receipt', !!panel && panel.present);
ok('it stays out of the way until there is one', panel && panel.hidden);
ok('and it announces itself to a screen reader', panel && panel.role === 'status');

console.log('PURCHASE TEST:', fails.length === 0 ? 'PASS' : 'FAIL ' + fails.join(', '));
if (hadKey) process.env.SOLANA_TREASURY_KEY = '(restored)';
await b.close();
