// "Tidak ada lagi template rumah rumahan yang tidak bisa dimasuki."
// A house that cannot be entered is scenery wearing a costume. This test finds a door,
// walks through it, and checks the child is somewhere new with solid walls around them --
// then comes back out to where they were standing.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 720 },
  userDataDir: OUT + 'edge-int-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (n, c, d) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); if (!c) fails.push(n); };
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 90)); });
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1800));
await p.evaluate(() => window.__sky.setGfx('setQuality', 'potato'));
await new Promise(r => setTimeout(r, 600));

const state = () => p.evaluate(() => window.__sky.state());
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

const doorCount = await p.evaluate(() => window.__sky.doors());
ok('the world actually has doors in it', doorCount > 0, doorCount + ' doors nearby');

// walk to a doorway and check the game offers the way in
const door = await p.evaluate(() => window.__sky.toDoor());
ok('a door can be reached', !!door, JSON.stringify(door));
await new Promise(r => setTimeout(r, 900));
const prompt = await p.evaluate(() => {
  const el = document.getElementById('houseEnter');
  return el ? { shown: el.style.display === 'block', text: el.textContent } : null;
});
ok('standing in the doorway offers a way in', !!prompt && prompt.shown, prompt && prompt.text);

const outside = await state();
ok('still outside before entering', outside.insideHouse === false);

// go in through the button a child would actually press
await p.evaluate(() => document.getElementById('houseEnter').click());
await new Promise(r => setTimeout(r, 1200));
const inside = await state();
ok('the house can be entered', inside.insideHouse === true);
ok('you are somewhere else now',
  Math.hypot(inside.player[0] - outside.player[0], inside.player[2] - outside.player[2]) > 100,
  'moved into the interior');
ok('there is floor under your feet', inside.ground > -Infinity, 'ground=' + inside.ground);

// the floor has to hold, or an interior is just a nicer way to fall out of the world
const restY = await settle(st => st.player[1]);
ok('you stand on the interior floor', Math.abs(restY - inside.ground) < 0.3,
  'y=' + restY + ' ground=' + inside.ground);

// the walls have to be real, or "inside" is a skybox
const walked = (await state()).player;
for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
  await p.keyboard.down(key);
  await new Promise(r => setTimeout(r, 1600));
  await p.keyboard.up(key);
}
await new Promise(r => setTimeout(r, 400));
const afterWalking = await state();
const fromCentre = Math.hypot(afterWalking.player[0] - 200000, afterWalking.player[2] - 200000);
// The nearest door is whatever the world generated -- often a cave mouth, not a cottage --
// and the rooms are different sizes. Ask the room how big it is rather than assuming 5.2.
const enteredSpec = await p.evaluate(k => window.__sky.interiorSpec(k), inside.insideKind);
ok('the walls keep you in the room', fromCentre <= enteredSpec.R,
  inside.insideKind + ': distance from room centre=' + fromCentre.toFixed(2) + ' wall=' + enteredSpec.R);
ok('you did not fall out of the world', afterWalking.player[1] > -5, 'y=' + afterWalking.player[1]);
ok('and you are still inside', afterWalking.insideHouse === true, 'walked from ' + JSON.stringify(walked));

// and back out again, to where you were standing
await p.evaluate(() => document.getElementById('houseLeave').click());
await new Promise(r => setTimeout(r, 1400));
const back = await state();
ok('you can leave again', back.insideHouse === false);
const backGap = Math.hypot(back.player[0] - outside.player[0], back.player[2] - outside.player[2]);
ok('you come out where you went in', backGap < 3, 'gap=' + backGap.toFixed(2));
ok('the world is still there when you come out', back.ground > -Infinity, 'ground=' + back.ground);
const leaveHidden = await p.evaluate(() => document.getElementById('houseLeave').style.display !== 'block');
ok('the way-out button goes away outside', leaveHidden);

// ---------- the other three rooms ----------
// "tidak ada mode dalam rumah, mode dalam gua, mode dalam gunung, mode dalam arena perang".
// Each of these has to be a real room: a floor that holds you up, walls that keep you in,
// and a way back out to exactly where you were standing.
const kinds = await p.evaluate(() => window.__sky.interiorKinds());
ok('all four interiors exist', ['house', 'cave', 'mountain', 'arena'].every(k => kinds.includes(k)),
  kinds.join(', '));

for (const kind of ['cave', 'mountain', 'arena']) {
  const spec = await p.evaluate(k => window.__sky.interiorSpec(k), kind);
  const before = await state();
  const entered = await p.evaluate(k => window.__sky.enterHouse(k), kind);
  await new Promise(r => setTimeout(r, 1200));
  const st = await state();
  ok(kind + ': you can go inside', entered === true && st.insideHouse === true,
    'kind=' + st.insideKind);
  ok(kind + ': the room is somewhere else',
    Math.hypot(st.player[0] - before.player[0], st.player[2] - before.player[2]) > 100);
  ok(kind + ': there is floor under your feet', st.ground > -Infinity, 'ground=' + st.ground);

  const rest = await settle(x => x.player[1]);
  ok(kind + ': you stand on the floor instead of falling', rest > -5 && Math.abs(rest - st.ground) < 0.4,
    'y=' + rest + ' ground=' + st.ground);

  // walk hard at every wall; a room you can leave by walking is not a room
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    await p.keyboard.down(key);
    await new Promise(r => setTimeout(r, 1500));
    await p.keyboard.up(key);
  }
  await new Promise(r => setTimeout(r, 400));
  const after = await state();
  const d = Math.hypot(after.player[0] - 200000, after.player[2] - 200000);
  ok(kind + ': the walls keep you in', d <= spec.R, 'distance=' + d.toFixed(2) + ' wall=' + spec.R);
  ok(kind + ': you did not fall out of the world', after.player[1] > -5, 'y=' + after.player[1]);

  // Walking at a wall on a renderer managing about one frame a second moves the child a few
  // centimetres, which proves nothing. Put them well outside the room instead and check the
  // next frame pulls them back in -- that is the wall doing its job, at a distance no amount
  // of slow simulation can fake.
  await p.evaluate(k => {
    const R = window.__sky.interiorSpec(k).R;
    window.__sky.dropAt(200000 + R + 6, 200000, 0.5);
  }, kind);
  const pushed = await settle(x => Math.hypot(x.player[0] - 200000, x.player[2] - 200000), 30, 0.05);
  ok(kind + ': dropped outside, the wall pulls you back in', pushed <= spec.R,
    'ended ' + pushed.toFixed(2) + ' from centre, wall at ' + spec.R);

  await p.evaluate(() => window.__sky.leaveHouse());
  await new Promise(r => setTimeout(r, 1300));
  const out = await state();
  ok(kind + ': and you can leave again', out.insideHouse === false && out.insideKind === null);
  ok(kind + ': you come out where you went in',
    Math.hypot(out.player[0] - before.player[0], out.player[2] - before.player[2]) < 3);
}

console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('INTERIOR TEST:', fails.length === 0 && errs.length === 0 ? 'PASS' : 'FAIL ' + fails.join(', '));
await b.close();
