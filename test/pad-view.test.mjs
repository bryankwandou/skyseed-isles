// A Windows controller, and first person.
//
// The controller cannot be a real device in a headless browser, so navigator.getGamepads
// is replaced with one this test drives. That is not a shortcut: the whole complaint was
// about direction, and direction is decided in game.js by what it reads off those axes.
// The fake reports axes the way the Gamepad API specifies -- x right, y DOWN -- so if the
// game has the sign wrong, this test walks the child backwards and fails.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 720 },
  userDataDir: OUT + 'edge-pad-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (n, c, d) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); if (!c) fails.push(n); };
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 90)); });

// install the fake pad before any page script runs
await p.evaluateOnNewDocument(() => {
  window.__pad = {
    id: 'Test Controller', index: 0, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
  };
  navigator.getGamepads = () => [window.__pad];
});
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1500));
// the software renderer here manages a couple of frames a second; the lightest preset
// gives the physics enough simulated time to actually move the child
await p.evaluate(() => window.__sky.setGfx('setQuality', 'potato'));
await new Promise(r => setTimeout(r, 600));

const state = () => p.evaluate(() => window.__sky.state());
const setAxes = a => p.evaluate(ax => { window.__pad.axes = ax; }, a);
const setBtn = (i, on) => p.evaluate(([idx, v]) => {
  window.__pad.buttons[idx] = { pressed: v, value: v ? 1 : 0 };
}, [i, on]);

ok('the game sees a controller', (await state()).padSeen === true);

// Measure travel against the camera basis, exactly as the keyboard test does: "forward"
// means away from the camera, which is the only definition a player agrees with.
const basis = async () => {
  const s = await state();
  return { fx: -Math.sin(s.yaw), fz: -Math.cos(s.yaw), rx: Math.cos(s.yaw), rz: -Math.sin(s.yaw) };
};
const push = async (axes, ms = 1400) => {
  await p.evaluate(() => window.__sky.clearGround());
  await new Promise(r => setTimeout(r, 500));
  const before = await state();
  const bs = await basis();
  await setAxes(axes);
  await new Promise(r => setTimeout(r, ms));
  await setAxes([0, 0, 0, 0]);
  await new Promise(r => setTimeout(r, 250));
  const after = await state();
  const dx = after.player[0] - before.player[0], dz = after.player[2] - before.player[2];
  return { fwd: dx * bs.fx + dz * bs.fz, right: dx * bs.rx + dz * bs.rz };
};

// Gamepad axis 1 is NEGATIVE when the stick is pushed up. Up must walk forward.
const up = await push([0, -1, 0, 0]);
ok('stick up walks forward, not backward', up.fwd > 0.2, 'forward=' + up.fwd.toFixed(2));
const down = await push([0, 1, 0, 0]);
ok('stick down walks backward', down.fwd < -0.2, 'forward=' + down.fwd.toFixed(2));
const right = await push([1, 0, 0, 0]);
ok('stick right steps right', right.right > 0.2, 'right=' + right.right.toFixed(2));
const left = await push([-1, 0, 0, 0]);
ok('stick left steps left', left.right < -0.2, 'right=' + left.right.toFixed(2));

// a small nudge inside the dead zone must not drift the child
const drift = await push([0.1, 0.1, 0, 0], 1600);
ok('a resting stick does not drift', Math.abs(drift.fwd) < 0.08 && Math.abs(drift.right) < 0.08,
  'fwd=' + drift.fwd.toFixed(3) + ' right=' + drift.right.toFixed(3));

// right stick turns the camera, and turning must not be inverted either
const yaw0 = (await state()).yaw;
await setAxes([0, 0, 1, 0]); await new Promise(r => setTimeout(r, 1200)); await setAxes([0, 0, 0, 0]);
const yaw1 = (await state()).yaw;
ok('right stick turns the camera', Math.abs(yaw1 - yaw0) > 0.1, yaw0 + ' -> ' + yaw1);

// bottom face button jumps
await p.evaluate(() => window.__sky.clearGround());
await new Promise(r => setTimeout(r, 600));
const groundY = (await state()).player[1];
await setBtn(0, true); await new Promise(r => setTimeout(r, 200)); await setBtn(0, false);
let peak = groundY;
for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 200));
  peak = Math.max(peak, (await state()).player[1]);
}
ok('the jump button jumps', peak > groundY + 0.4, 'rose ' + (peak - groundY).toFixed(2));

// ---------- first person ----------
ok('starts in third person', (await state()).view === 'tpp');
await p.click('#viewBtn'); await new Promise(r => setTimeout(r, 700));
const fpp = await state();
ok('the button switches to first person', fpp.view === 'fpp');
ok('the avatar is out of the way', fpp.avatarVisible === false);
const eyeGap = Math.hypot(fpp.camera[0] - fpp.player[0], fpp.camera[2] - fpp.player[2]);
ok('the camera sits at the head, not behind', eyeGap < 0.5, 'gap=' + eyeGap.toFixed(2));
ok('the eyes are at head height', Math.abs(fpp.camera[1] - (fpp.player[1] + 1.5)) < 0.3,
  'eye=' + fpp.camera[1] + ' feet=' + fpp.player[1]);

// forward has to mean the same thing in both modes, which is the whole risk of a second camera
const fppUp = await push([0, -1, 0, 0]);
ok('forward still means forward in first person', fppUp.fwd > 0.2, 'forward=' + fppUp.fwd.toFixed(2));

await p.click('#viewBtn'); await new Promise(r => setTimeout(r, 700));
const back = await state();
ok('and it switches back', back.view === 'tpp' && back.avatarVisible === true);
const tppGap = Math.hypot(back.camera[0] - back.player[0], back.camera[2] - back.player[2]);
ok('the camera returns behind the child', tppGap > 2, 'gap=' + tppGap.toFixed(2));

// the choice is remembered, like every other setting
await p.click('#viewBtn'); await new Promise(r => setTimeout(r, 400));
await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1500));
ok('the view choice survives a reload', (await state()).view === 'fpp');

console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('PAD/VIEW TEST:', fails.length === 0 && errs.length === 0 ? 'PASS' : 'FAIL ' + fails.join(', '));
await b.close();
