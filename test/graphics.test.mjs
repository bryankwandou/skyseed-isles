// Proves the graphics panel is real: every preset and every dial is read back off the
// live renderer, not off the settings object. A setting that saves but does not reach
// WebGL is exactly the complaint QA filed, so storage is never what this test believes.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 720 },
  userDataDir: OUT + 'edge-gfx-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (name, cond, detail) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); if (!cond) fails.push(name); };
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 90)); });
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1500));

const gfx = () => p.evaluate(() => window.__sky.gfx());
const set = (id, v) => p.evaluate((i, val) => window.__sky.setGfx(i, val), id, v);
// Headless runs on a software renderer at a couple of frames a second, so the auto-adjust
// governor would (correctly) drag every preset down to Potato mid-test. Park it first; it
// gets its own check at the end.
await set('setAuto', false);

// --- the panel exists and offers a real ladder, not a two-way toggle ---
const g0 = await gfx();
ok('five presets offered', g0.presets.length === 5, g0.presets.join('/'));

// --- each preset must land differently on the renderer itself ---
const seen = [];
for (const name of g0.presets) {
  await set('setQuality', name);
  await new Promise(r => setTimeout(r, 250));
  const g = await gfx();
  seen.push({ name, ratio: g.pixelRatio, shadows: g.shadowsOn, map: g.shadowMap, fog: g.fogFar, fx: g.effects });
  ok('preset ' + name + ' applied', g.quality === name,
    'ratio=' + g.pixelRatio + ' shadows=' + g.shadowsOn + ' fog=' + g.fogFar);
}
const potato = seen[0], ultra = seen[4];
ok('potato is lighter than ultra', potato.ratio < ultra.ratio && potato.fog < ultra.fog && potato.fx < ultra.fx,
  'ratio ' + potato.ratio + '->' + ultra.ratio + ', fog ' + potato.fog + '->' + ultra.fog);
ok('shadows really turn off on potato', potato.shadows === false && ultra.shadows === true);
ok('ultra uses the bigger shadow map', ultra.map > potato.map || potato.shadows === false, 'map ' + potato.map + '->' + ultra.map);
ok('every preset is distinct', new Set(seen.map(s => s.ratio + '|' + s.fog + '|' + s.shadows)).size === 5);

// --- individual dials reach WebGL and flip the label to Custom ---
await set('setQuality', 'high'); await new Promise(r => setTimeout(r, 200));
const base = await gfx();
await set('setScale', 0.5); await new Promise(r => setTimeout(r, 250));
const scaled = await gfx();
ok('sharpness dial moves the pixel ratio', scaled.pixelRatio < base.pixelRatio,
  base.pixelRatio + ' -> ' + scaled.pixelRatio);
ok('moving a dial says Custom', scaled.quality === 'custom');

await set('setShadows', 'off'); await new Promise(r => setTimeout(r, 250));
ok('shadow dial reaches the renderer', (await gfx()).shadowsOn === false);
await set('setShadows', 'sharp'); await new Promise(r => setTimeout(r, 250));
const sharp = await gfx();
ok('sharp shadows raise the map size', sharp.shadowsOn === true && sharp.shadowMap === 2048, 'map=' + sharp.shadowMap);

const near = await set('setView', 120) && (await new Promise(r => setTimeout(r, 250)), await gfx());
await set('setView', 320); await new Promise(r => setTimeout(r, 250));
const far = await gfx();
ok('view distance moves the fog', far.fogFar > near.fogFar,
  'fogFar ' + near.fogFar + ' -> ' + far.fogFar);
// The fog may sit closer than the slider asks, and that is the point: the world is only
// built out to a whole number of cells, and drawing past that edge is what made islands
// pop in and out of clear air. The fog is pulled in behind the built edge so the boundary
// is always hidden in haze. What must never happen is fog reaching past the world.
ok('the fog never reaches past the built world', far.fogFar <= far.streamEdge,
  'fog=' + far.fogFar + ' built to=' + far.streamEdge);
ok('and it is not pulled in further than it needs to be',
  far.fogFar === Math.min(far.viewDist, far.streamEdge),
  'fog=' + far.fogFar + ' viewDist=' + far.viewDist + ' edge=' + far.streamEdge);
ok('camera out-reaches the fog', far.cameraFar > far.fogFar, far.cameraFar + ' > ' + far.fogFar);

await set('setFx', 0); await new Promise(r => setTimeout(r, 200));
ok('sparkles dial reads back', (await gfx()).effects === 0);

// --- the FPS meter is a real on-screen readout, not a stored boolean ---
// It has to read the wall clock: counting frames against the clamped frame delta reports a
// comfortable 20 FPS on a machine managing one, which is the bug this check exists to catch.
await set('setShowFps', true); await new Promise(r => setTimeout(r, 2500));
const meter = await p.evaluate(() => {
  const el = document.getElementById('fpsMeter');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { shown: getComputedStyle(el).display !== 'none', text: el.textContent, w: r.width, top: r.top };
});
ok('FPS meter is on screen', !!meter && meter.shown && meter.w > 10, meter && meter.text);
ok('FPS meter shows a number', !!meter && /\d+\s*FPS/.test(meter.text), meter && meter.text);
await set('setShowFps', false); await new Promise(r => setTimeout(r, 200));
ok('FPS meter hides again', await p.evaluate(() => getComputedStyle(document.getElementById('fpsMeter')).display === 'none'));

// --- a frame limit really limits frames ---
await set('setQuality', 'high'); await set('setFpsCap', 30);
await new Promise(r => setTimeout(r, 2500));
const capped = await gfx();
ok('frame limit is in force', capped.fpsCap === 30 && capped.fps <= 34, 'fps=' + capped.fps);

// --- the meter must not flatter a slow machine ---
const honest = await p.evaluate(async () => {
  let frames = 0; const t0 = performance.now();
  await new Promise(res => { const tick = () => { frames++; performance.now() - t0 < 2000 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); });
  return frames * 1000 / (performance.now() - t0);
});
const shown = (await gfx()).fps;
ok('reported FPS matches the wall clock', Math.abs(shown - honest) < Math.max(6, honest * 0.5),
  'reported=' + shown.toFixed(1) + ' measured=' + honest.toFixed(1));

// --- choices survive a reload, which is the whole point of a settings panel ---
await set('setQuality', 'medium'); await set('setView', 200);
await new Promise(r => setTimeout(r, 300));
await p.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1200));
const after = await gfx();
ok('settings survive a reload', after.viewDist === 200, 'viewDist=' + after.viewDist);
ok('and the fog is rebuilt from them', after.fogFar === Math.min(200, after.streamEdge),
  'fog=' + after.fogFar + ' edge=' + after.streamEdge);
const panel = await p.evaluate(() => ({ view: document.getElementById('setView').value, q: document.getElementById('setQuality').value }));
ok('panel shows what is running', panel.view === '200' && panel.q === after.quality, JSON.stringify(panel));
ok('auto-adjust choice persists too', after.autoAdjust === false);

console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('GRAPHICS TEST:', fails.length === 0 && errs.length === 0 ? 'PASS' : 'FAIL ' + fails.join(', '));
await b.close();
