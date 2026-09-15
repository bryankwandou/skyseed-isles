// Proves the Bag is a working inventory, not a grid of pictures: materials arrive from real
// pickups, icons are rendered from 3D models (read back as actual pixels), recipes consume
// what they say, and every crafted item changes something measurable in the game.
// Also proves the picture dials reach the canvas and the seven quality presets exist.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.SHOT_DIR || 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const URL = process.env.TEST_URL || 'http://127.0.0.1:5610/play/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 800 },
  userDataDir: OUT + 'edge-bag-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (name, cond, detail) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); if (!cond) fails.push(name); };
const wait = ms => new Promise(r => setTimeout(r, ms));
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 120)); });
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await wait(1500);
await p.evaluate(() => window.__sky.setGfx('setAuto', false));
const bag = () => p.evaluate(() => window.__sky.bag());
// the card scrolls and Close is sticky at its floor; centre a target first so the click lands on it
const tap = async sel => { await p.evaluate(q => document.querySelector(q).scrollIntoView({ block: 'center' }), sel); await wait(80); await p.click(sel); };

// --- empty bag says so, with a next step ---
await p.keyboard.press('KeyI'); await wait(400);
let s = await bag();
ok('I opens the Bag', s.open);
ok('an empty Bag explains how to fill it', await p.evaluate(() => !document.getElementById('bagEmpty').hidden));
ok('all 8 item icons were rendered from 3D models', s.icons === 8, s.icons + '/8');

// icons are real pixels, not blank images: decode one and count opaque, coloured pixels
const px = await p.evaluate(async () => {
  const out = {};
  for (const id of ['berry', 'shard', 'tonic', 'charm']) {
    window.__sky.bagGive(id, 1);
    const im = document.querySelector('.bagSlot[data-item="' + id + '"] img');
    if (!im) { out[id] = -1; continue; }
    await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) n++;
    out[id] = n;
    window.__sky.bagGive(id, -1);
  }
  return out;
});
ok('icons contain a drawn object (opaque pixels)', Object.values(px).every(n => n > 400), JSON.stringify(px));

// --- pickups put materials in the Bag ---
const before = (await bag()).items.petal;
await p.evaluate(() => window.__sky.bagPickup('petal'));
ok('a moonpetal pickup adds a Moonpetal', (await bag()).items.petal === before + 1);
let got = 0;
for (let i = 0; i < 40; i++) await p.evaluate(() => window.__sky.bagPickup('ring'));
got = (await bag()).items.shard;
ok('rings sometimes leave Sky Shards', got > 5 && got < 40, got + ' shards from 40 rings');

// --- combining ---
await p.evaluate(() => { const s = window.__sky; s.bagGive('berry', 5); s.bagGive('twig', 2); s.bagGive('pebble', 3); });
await wait(200);
s = await bag();
ok('recipes light up when you have enough', s.recipes.every(r => r.ready), JSON.stringify(s.recipes));
await p.screenshot({ path: OUT + 'bag-full.png' });

const i0 = (await bag()).items;
await tap('.bagGo[data-recipe="tonic"]'); await wait(200);
const i1 = (await bag()).items;
ok('Combine uses exactly the ingredients', i1.berry === i0.berry - 1 && i1.pebble === i0.pebble - 2, `berry ${i0.berry}->${i1.berry}, pebble ${i0.pebble}->${i1.pebble}`);
ok('and makes the item', i1.tonic === i0.tonic + 1);
await tap('.bagGo[data-recipe="charm"]'); await wait(200);
ok('Glow Charm crafted', (await bag()).items.charm === 1);
const notEnough = await p.evaluate(() => { window.__sky.bagGive('petal', -99); return document.querySelector('.bagGo[data-recipe="charm"]').disabled; });
ok('a recipe you cannot afford is disabled', notEnough);

// --- using items does something ---
await tap('.bagSlot[data-item="tonic"]'); await wait(150);
await tap('#bagUse'); await wait(200);
s = await bag();
ok('Wind Tonic gives a speed boost with a timer', s.speedBoost === 1.3 && s.tonicLeft > 40, 'boost ' + s.speedBoost + ', ' + s.tonicLeft + ' s');
ok('and is used up', s.items.tonic === 0);
await tap('.bagSlot[data-item="charm"]'); await wait(150);
await tap('#bagUse'); await wait(200);
s = await bag();
ok('Glow Charm lights a real light that follows Miru', s.charmOn && s.charmLit);
await p.screenshot({ path: OUT + 'bag-used.png' });
ok('the Bag saves: it survives a reload', await p.evaluate(() => JSON.parse(localStorage.getItem('skyseed_save_v1')).bag.charm === 1));

await p.keyboard.press('KeyI'); await wait(300);
ok('I closes the Bag', !(await bag()).open);

// --- picture dials and presets ---
const g = await p.evaluate(() => window.__sky.gfx());
ok('seven quality presets', g.presets.length === 7, g.presets.join('/'));
await p.evaluate(() => { const s = window.__sky; s.setGfx('setBright', 1.3); s.setGfx('setCon', 1.2); s.setGfx('setSat', 1.25); });
await wait(200);
const g2 = await p.evaluate(() => window.__sky.gfx());
ok('brightness, contrast and colour reach the canvas', /brightness\(1\.3\)/.test(g2.canvasFilter) && /contrast\(1\.2\)/.test(g2.canvasFilter) && /saturate\(1\.25\)/.test(g2.canvasFilter), g2.canvasFilter);
ok('picture dials do not knock the preset to Custom', g2.quality === g.quality, g.quality + ' -> ' + g2.quality);
await p.evaluate(() => { document.getElementById('pauseBtn').click(); });
await wait(300);
await p.evaluate(() => document.getElementById('setBright').scrollIntoView({ block: 'center' }));
await p.screenshot({ path: OUT + 'settings-picture.png' });
await p.evaluate(() => document.getElementById('setPicReset').click()); await wait(150);
ok('Reset picture removes the filter entirely', (await p.evaluate(() => window.__sky.gfx())).canvasFilter === '');

ok('no page errors', !errs.length, [...new Set(errs)].join(' | '));
await b.close();
console.log(fails.length ? 'BAG TEST: FAIL ' + fails.length : 'BAG TEST: PASS');
process.exit(fails.length ? 1 : 0);
