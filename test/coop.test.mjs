// Two children, two browsers, one room. Each browser has its own profile, so its own save
// and its own outfit -- the same separation two real laptops would have. The relay is the
// real public broker; nothing is mocked.
import puppeteer from 'puppeteer-core';
import { makeCode } from '../play/coop-net.js';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const B = process.env.TEST_URL || 'http://127.0.0.1:5610/play/';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra !== undefined ? '  ' + extra : ''));
  if (!cond) fails++;
}

async function child(tag, save) {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new',
    defaultViewport: { width: 960, height: 600 }, userDataDir: OUT + 'edge-coop-' + tag + '-' + Date.now(),
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await page.evaluateOnNewDocument(s => {
    localStorage.setItem('skyseed_save_v1', JSON.stringify(s));
  }, save);
  await page.goto(B, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 45000 });
  await page.click('#startBtn');
  await sleep(2500);
  return { browser, page, errs };
}

async function waitFor(page, fn, arg, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    await sleep(250);
  }
  return null;
}

const base = { sparks: 60, seeds: 10, unlocked: ['jump', 'glide'], biomes: ['Meadow Isles'], pets: [], builds: [] };
const A = await child('a', Object.assign({}, base, { wardrobe: { outfit: 'sunset', hat: 'party', cape: 'none' } }));
const Bc = await child('b', Object.assign({}, base, { wardrobe: { outfit: 'meadow', hat: 'none', cape: 'none' } }));

// ---------- typing in the panel must not play the game ----------
await A.page.keyboard.press('KeyG');
await sleep(400);
ok('G opens the Play together panel', await A.page.evaluate(() => document.getElementById('coop').classList.contains('on')));
const before = await A.page.evaluate(() => window.__sky.state().player);
await A.page.focus('#coopCodeIn');
await A.page.keyboard.type('wwwwttt', { delay: 30 });
await sleep(500);
const after = await A.page.evaluate(() => window.__sky.state().player);
const shopOpen = await A.page.evaluate(() => document.getElementById('shop').classList.contains('on'));
ok('typing W into the code box does not walk Miru', Math.hypot(after[0] - before[0], after[2] - before[2]) < 0.05,
  JSON.stringify(before) + ' -> ' + JSON.stringify(after));
ok('typing T into the code box does not open the shop', !shopOpen);
await A.page.evaluate(() => { document.getElementById('coopCodeIn').value = 'ABC0EF'; });
await A.page.click('#coopJoin');
await sleep(300);
const err = await A.page.evaluate(() => document.getElementById('coopErr').textContent);
ok('a code with a look-alike character is refused with a message', err.length > 5, err);

// ---------- both join one room ----------
const code = makeCode();
await A.page.evaluate(() => { document.getElementById('coopName').value = 'Ayu'; });
await Bc.page.evaluate(() => { document.getElementById('coopName').value = 'Budi'; });
const [ja, jb] = await Promise.all([
  A.page.evaluate(c => window.__sky.coopStart(c), code),
  Bc.page.evaluate(c => window.__sky.coopStart(c), code)
]);
ok('child A opens the room', ja, code + ' ' + JSON.stringify(await A.page.evaluate(() => window.__sky.coop().log)));
ok('child B joins it', jb);
ok('the room code is shown big in the panel',
  (await A.page.evaluate(() => document.getElementById('coopCodeShow').textContent)) === code);

// put A somewhere definite, then B must see A there
await A.page.evaluate(() => { const p = window.__sky.state().player; window.__sky.teleport(p[0] + 2, p[1], p[2] + 1); });
await sleep(500);
const aAt = await A.page.evaluate(() => window.__sky.state().player);
const seenA = await waitFor(Bc.page, at => {
  const f = window.__sky.coop().friends.find(x => x.name === 'Ayu');
  return f && Math.hypot(f.at[0] - at[0], f.at[2] - at[2]) < 1.0 ? f : null;
}, aAt, 25000);
ok('B sees Ayu standing where A actually is', !!seenA, seenA ? JSON.stringify(seenA.at) + ' vs ' + JSON.stringify(aAt) : 'not seen');
ok('B sees Ayu in her own Sunset Gown and Party Hat', seenA && seenA.outfit === 'sunset' && seenA.hat === 'party',
  seenA && seenA.outfit + '/' + seenA.hat);
ok('and the avatar is actually in the scene', seenA && seenA.visible);
const seenB = await waitFor(A.page, () => window.__sky.coop().friends.find(x => x.name === 'Budi'));
ok('A sees Budi in his Meadow Tunic', seenB && seenB.outfit === 'meadow', seenB && seenB.outfit);

// A walks; B's view follows
await A.page.evaluate(() => { const p = window.__sky.state().player; window.__sky.teleport(p[0] - 3, p[1], p[2] - 2); });
const aAt2 = await A.page.evaluate(() => window.__sky.state().player);
const t0 = Date.now();
const followed = await waitFor(Bc.page, at => {
  const f = window.__sky.coop().friends.find(x => x.name === 'Ayu');
  return f && Math.hypot(f.at[0] - at[0], f.at[2] - at[2]) < 1.0;
}, aAt2, 15000);
ok('when Ayu moves, Budi sees her move', !!followed, (Date.now() - t0) + ' ms on a software renderer');

// ---------- how they are connected ----------
await sleep(4000);                         // a few pings, so the numbers are real
const linkA = (await A.page.evaluate(() => window.__sky.coop())).links[0];
const linkB = (await Bc.page.evaluate(() => window.__sky.coop())).links[0];
ok('A has a measured round trip to B', linkA && linkA.rtt !== null, linkA && JSON.stringify(linkA));
console.log('     link A->B:', JSON.stringify(linkA), ' link B->A:', JSON.stringify(linkB));
console.log('     relay:', (await A.page.evaluate(() => window.__sky.coop().broker)));
const chip = await A.page.evaluate(() => { const c = document.getElementById('coopChip'); return !c.hidden && c.textContent; });
ok('the friends chip shows who is here', !!chip && chip.includes('2'), chip);

// ---------- chat is presets only ----------
await A.page.evaluate(() => window.__sky.coopChat(0));
const heard = await waitFor(Bc.page, () => { const s = window.__sky.lastSaid(); return s && s.startsWith('Ayu:') ? s : null; });
ok('a friendly phrase arrives, with who said it', !!heard, heard);
await sleep(2500);                          // let the toast clear
await A.page.evaluate(() => window.__sky.coopSay('give me your password'));
await sleep(2500);
const leaked = await Bc.page.evaluate(() => (window.__sky.lastSaid() || '').includes('password'));
ok('free text from a modified client is never shown', !leaked);

await A.page.screenshot({ path: OUT + 'shot-coop-a.png' });
await Bc.page.screenshot({ path: OUT + 'shot-coop-b.png' });

// ---------- leaving ----------
await A.page.evaluate(() => window.__sky.coopLeave());
const gone = await waitFor(Bc.page, () => window.__sky.coop().friends.length === 0, null, 12000);
ok('when Ayu leaves, her avatar leaves Budi\'s world', !!gone);

console.log('     log A:', JSON.stringify(await A.page.evaluate(() => window.__sky.coop().log)));
console.log('     log B:', JSON.stringify(await Bc.page.evaluate(() => window.__sky.coop().log)));
// one line per distinct error, so a repeating one is readable
const uniq = [...new Set([...A.errs, ...Bc.errs])];
ok('no page errors in either browser', !uniq.length, uniq.join(' | ') + (uniq.length ? ' (x' + (A.errs.length + Bc.errs.length) + ')' : ''));
await A.browser.close(); await Bc.browser.close();
console.log(fails ? 'COOP TEST: FAIL (' + fails + ')' : 'COOP TEST: PASS');
process.exit(fails ? 1 : 0);
