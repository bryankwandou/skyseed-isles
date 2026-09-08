// Two QA complaints in one file:
//   "kontroller tidak ada animasi sama sekali" — a press has to visibly move the button.
//   "key binding belum terbaca" — the keys have to be re-bindable and the new key has to
//   actually drive the character, not just save into a settings blob.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  defaultViewport: { width: 820, height: 420, hasTouch: true, isMobile: true },
  userDataDir: OUT + 'edge-feel-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (n, c, d) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); if (!c) fails.push(n); };
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 90)); });
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1800));

// ---------- press animation ----------
// Measured off the composited transform, so a rule that never reaches the element fails.
// Transitions are suppressed for the measurement itself: this headless run draws about a
// frame a second, and sampling mid-transition would measure the test machine rather than
// the CSS. Suppressing them asks the only question worth asking -- what does this state
// settle to -- and answers it in one style recalc regardless of frame rate.
const settledScale = (sel, cls) => p.evaluate(([s, c]) => {
  const el = document.querySelector(s);
  const prev = el.style.transition;
  el.style.transition = 'none';
  if (c) el.classList.add(c);
  void el.offsetWidth;
  const v = +new DOMMatrix(getComputedStyle(el).transform).a.toFixed(3);
  if (c) el.classList.remove(c);
  el.style.transition = prev;
  return v;
}, [sel, cls || '']);
const scaleOf = sel => settledScale(sel, null);

// Two separate questions, because the software renderer here crawls at about a frame a
// second and sampling mid-transition would be measuring the test machine, not the CSS:
//   1. does a press put the element into its pressed state?
//   2. does that state actually look different once it has settled?
const restJump = await scaleOf('#jumpBtn');
await p.evaluate(() => {
  const el = document.getElementById('jumpBtn');
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 1, pointerType: 'touch',
    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
  }));
});
ok('a press marks JUMP as pressed',
  await p.evaluate(() => document.getElementById('jumpBtn').classList.contains('pressed')));
ok('JUMP grows a ring element', await p.evaluate(() => !!document.querySelector('#jumpBtn .ring')));
const heldJump = await settledScale('#jumpBtn', 'pressed');
ok('the pressed state visibly shrinks JUMP', heldJump < restJump - 0.05, restJump + ' -> ' + heldJump);
// and the shrink is the pressed state and nothing else: once the class is gone the
// button's resting size is exactly what it was before the press
await p.evaluate(() => {
  const el = document.getElementById('jumpBtn');
  clearTimeout(el._flashT);
  el.classList.remove('pressed');
});
ok('JUMP springs back', Math.abs(await scaleOf('#jumpBtn') - restJump) < 0.02);

// the stick has to look grabbed, not just steer
await p.evaluate(() => {
  const el = document.getElementById('stick');
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 2, pointerType: 'touch',
    clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.2
  }));
});
await new Promise(r => setTimeout(r, 80));
const grabbed = await p.evaluate(() => ({
  stick: document.getElementById('stick').classList.contains('pressed'),
  knob: document.getElementById('knob').classList.contains('pressed'),
  knobScale: +new DOMMatrix(getComputedStyle(document.getElementById('knob')).transform).a.toFixed(3)
}));
ok('stick looks grabbed', grabbed.stick && grabbed.knob && grabbed.knobScale > 1.02, JSON.stringify(grabbed));
await p.evaluate(() => document.getElementById('stick').dispatchEvent(
  new PointerEvent('pointerup', { bubbles: true, pointerId: 2, pointerType: 'touch' })));
await new Promise(r => setTimeout(r, 150));
ok('stick lets go', await p.evaluate(() => !document.getElementById('stick').classList.contains('pressed')));

// a side HUD button acknowledges too
const restPause = await scaleOf('#pauseBtn');
await p.evaluate(() => document.getElementById('pauseBtn').dispatchEvent(
  new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, pointerType: 'touch' })));
ok('a tap marks the HUD button',
  await p.evaluate(() => document.getElementById('pauseBtn').classList.contains('hudTap')));
const heldPause = await settledScale('#pauseBtn', 'hudTap');
ok('the HUD tap state visibly shrinks it', heldPause < restPause - 0.05, restPause + ' -> ' + heldPause);
await p.evaluate(() => {
  const el = document.getElementById('pauseBtn');
  clearTimeout(el._tapT);
  el.classList.remove('hudTap');
});
ok('the HUD button springs back', Math.abs(await scaleOf('#pauseBtn') - restPause) < 0.02);

// ---------- key rebinding ----------
await p.evaluate(() => { const m = document.getElementById('pauseMenu'); if (m) m.classList.add('on'); });
const rows = await p.evaluate(() => document.querySelectorAll('#bindList .bindRow').length);
ok('every action is listed to rebind', rows >= 16, rows + ' rows');
const capLabel = await p.evaluate(() => document.getElementById('bind_forward').textContent);
ok('keys read as letters, not KeyW', capLabel === 'W', JSON.stringify(capLabel));

// hit target: a seven-year-old taps these
const capBox = await p.evaluate(() => {
  const r = document.getElementById('bind_forward').getBoundingClientRect();
  return { w: r.width, h: r.height };
});
ok('rebind buttons are tappable', capBox.h >= 40 && capBox.w >= 60, JSON.stringify(capBox));

// rebind forward from W to I, through the real panel
await p.click('#bind_forward');
ok('panel waits for a key', await p.evaluate(() => document.getElementById('bind_forward').classList.contains('listening')));
await p.keyboard.press('KeyI');
await new Promise(r => setTimeout(r, 150));
const bound = await p.evaluate(() => window.__sky.binds());
ok('forward is now I', bound.forward === 'KeyI', JSON.stringify(bound.forward));
ok('cap shows the new key', await p.evaluate(() => document.getElementById('bind_forward').textContent) === 'I');

// and the new key has to actually walk — this is the half that was missing
await p.evaluate(() => { document.getElementById('pauseMenu').classList.remove('on'); });
const move = async code => {
  await p.evaluate(() => window.__sky.clearGround());
  await new Promise(r => setTimeout(r, 400));
  const a = (await p.evaluate(() => window.__sky.state())).player;
  await p.keyboard.down(code); await new Promise(r => setTimeout(r, 700)); await p.keyboard.up(code);
  const c = (await p.evaluate(() => window.__sky.state())).player;
  return Math.hypot(c[0] - a[0], c[2] - a[2]);
};
const movedI = await move('KeyI');
ok('the rebound key walks', movedI > 0.15, 'moved ' + movedI.toFixed(2));
const movedW = await move('KeyW');
ok('the old key is released', movedW < 0.1, 'moved ' + movedW.toFixed(2));
const movedArrow = await move('ArrowUp');
ok('arrow keys keep working', movedArrow > 0.15, 'moved ' + movedArrow.toFixed(2));

// reset puts everything back
await p.evaluate(() => { document.getElementById('pauseMenu').classList.add('on'); document.getElementById('bindReset').click(); });
await new Promise(r => setTimeout(r, 200));
ok('reset restores W', (await p.evaluate(() => window.__sky.binds())).forward === 'KeyW');

// and a rebind survives a reload
await p.click('#bind_punch'); await p.keyboard.press('KeyG');
await new Promise(r => setTimeout(r, 200));
await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1200));
ok('a rebind survives a reload', (await p.evaluate(() => window.__sky.binds())).punch === 'KeyG');

console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('FEEL TEST:', fails.length === 0 && errs.length === 0 ? 'PASS' : 'FAIL ' + fails.join(', '));
await b.close();
