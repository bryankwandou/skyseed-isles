// "lantai tembus dan properti palsu" — the floor you fall through and the props that are
// not really there. Both are one question: does the world push back? This test walks the
// child into a tree and drops them onto a pillar, and checks the world stopped them.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 720 },
  userDataDir: OUT + 'edge-solid-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (n, c, d) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); if (!c) fails.push(n); };
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 90)); });
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('skyseed_save_v1', JSON.stringify({ sparks: 50, seeds: 10, energy: 5, unlocked: ['jump'] }));
});
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 2000));

// Physics runs on the frame clock, and the frame delta is clamped to 50 ms so a stall
// cannot fling the child across the map. On this software renderer that means simulated
// time crawls: two seconds of waiting can be a tenth of a second of falling. So drop to
// the lightest preset for speed, and wait on the world settling rather than on a stopwatch.
await p.evaluate(() => window.__sky.setGfx('setQuality', 'potato'));
await new Promise(r => setTimeout(r, 600));

const state = () => p.evaluate(() => window.__sky.state());
// poll until the chosen value stops changing, or give up
const settle = async (pick, tries = 60, eps = 0.02) => {
  let last = null, stable = 0;
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 250));
    const v = pick(await state());
    if (last !== null && Math.abs(v - last) < eps) { if (++stable >= 3) return v; }
    else stable = 0;
    last = v;
  }
  return last;
};
const solidCount = await p.evaluate(() => window.__sky.solids());
ok('the world has solid props at all', solidCount > 0, solidCount + ' colliders');

// ---------- a tree is not a ghost ----------
// stand the child a short way from a trunk, facing it, then walk straight in
const place = want => p.evaluate(w => window.__sky.atSolid(w, 3), want);
// hold forward until the child stops making progress, then let go
const walkIn = async (target) => {
  await p.keyboard.down('KeyW');
  await settle(st => Math.hypot(st.player[0] - target.x, st.player[2] - target.z), 40, 0.03);
  await p.keyboard.up('KeyW');
  await new Promise(r => setTimeout(r, 250));
};

const tree = await place('block');
if (!tree) {
  ok('a blocking prop exists to test', false);
} else {
  await new Promise(r => setTimeout(r, 300));
  await walkIn(tree);
  const s = await state();
  const gap = Math.hypot(s.player[0] - tree.x, s.player[2] - tree.z);
  // started 3 units clear of the trunk surface; a run that never closed that distance is
  // walking the wrong way, not being blocked, and must not read as a pass
  ok('the child actually walked at the tree', gap < 3.0, 'gap=' + gap.toFixed(2) + ' (started 3.5)');
  ok('walking into a tree stops you outside it', gap > tree.r - 0.05,
    'gap=' + gap.toFixed(2) + ' trunk r=' + tree.r);
  ok('you did not end up inside the trunk', gap > 0.4, 'gap=' + gap.toFixed(2));

  // And prove the collider is what did it, by switching it off and walking the same line.
  // The measure is the CLOSEST the child got, not where they ended up: walking through a
  // tree means coming out the far side, so the final distance grows again.
  await p.evaluate(() => window.__sky.setNoclip(true));
  await p.evaluate(w => window.__sky.atSolid(w, 3), 'block');
  await new Promise(r => setTimeout(r, 300));
  await p.keyboard.down('KeyW');
  let closest = Infinity;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    const st = await state();
    closest = Math.min(closest, Math.hypot(st.player[0] - tree.x, st.player[2] - tree.z));
  }
  await p.keyboard.up('KeyW');
  ok('with collision off the child walks through it', closest < tree.r,
    'closest=' + closest.toFixed(2) + ' trunk r=' + tree.r + ' (blocked run stopped at ' + gap.toFixed(2) + ')');
  await p.evaluate(() => window.__sky.setNoclip(false));
}

// ---------- a pillar is a platform, not a hologram ----------
const pillar = await place('stand');
if (!pillar) {
  ok('a standable prop exists to test', false);
} else {
  // drop the child straight down from well above the cap
  await p.evaluate(pl => window.__sky.dropAt(pl.x, pl.z, pl.top + 6), pillar);
  const restY = await settle(st => st.player[1]);
  ok('you land on the pillar cap, not through it', Math.abs(restY - pillar.top) < 0.3,
    'y=' + restY.toFixed(2) + ' cap=' + pillar.top);
  ok('and you are standing still on it', Math.abs(restY - pillar.islandY) > 0.5,
    'cap ' + pillar.top + ' vs island floor ' + pillar.islandY);

  // a fast fall must not step over the cap between two frames
  await p.evaluate(pl => window.__sky.dropAt(pl.x, pl.z, pl.top + 40), pillar);
  const fastY = await settle(st => st.player[1], 120);
  ok('a long fall still lands on the cap, not through it',
    Math.abs(fastY - pillar.top) < 0.3, 'y=' + fastY.toFixed(2) + ' cap=' + pillar.top);

  // standing next to a pillar must not snap you on top of it
  await p.evaluate(pl => window.__sky.dropAt(pl.x + pl.r + 1.2, pl.z, pl.islandY + 0.05), pillar);
  const besideY = await settle(st => st.player[1]);
  ok('standing beside a pillar leaves you on the ground',
    Math.abs(besideY - pillar.islandY) < 0.4, 'y=' + besideY.toFixed(2));
}

// ---------- the island floor itself holds ----------
await p.evaluate(() => window.__sky.clearGround());
const restedY = await settle(st => st.player[1]);
await new Promise(r => setTimeout(r, 2500));
const afterSit = await state();
const floorHeld = { before: restedY, after: afterSit.player[1], ground: afterSit.ground };
ok('standing still does not sink through the island',
  Math.abs(floorHeld.after - floorHeld.before) < 0.05,
  floorHeld.before + ' -> ' + floorHeld.after);
ok('feet rest exactly on the reported ground',
  Math.abs(floorHeld.after - floorHeld.ground) < 0.05,
  'y=' + floorHeld.after + ' ground=' + floorHeld.ground);

console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('SOLIDS TEST:', fails.length === 0 && errs.length === 0 ? 'PASS' : 'FAIL ' + fails.join(', '));
await b.close();
