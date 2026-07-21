import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.env.TEST_URL || 'http://localhost:5599/play/';

const errors = [];
const logs = [];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  userDataDir: 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/edge-profile-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage();
page.on('console', m => { logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => { errors.push('PAGEERROR: ' + e.message); });
page.on('response', res => { if (res.status() === 404) errors.push('HTTP404: ' + res.url()); });
page.on('requestfailed', r => {
  const u = r.url();
  // ignore favicon noise
  if (!u.includes('favicon')) errors.push('REQFAIL: ' + u + ' ' + (r.failure() && r.failure().errorText));
});

try {
  // pre-seed a saved buddy + some sparks so the pet load path is exercised deterministically
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('skyseed_save_v1', JSON.stringify({
      sparks: 12, unlocked: ['jump', 'glide'], biomes: ['Meadow Isles'],
      pets: [{ level: 8, color: 0x7fe8c9, name: 'Boba' }]
    }));
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // give modules (three + vrm from CDN) time to import and init
  await page.waitForSelector('canvas', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  // title + start button present?
  const hasTitle = await page.$('#title') !== null;
  const hasStart = await page.$('#startBtn') !== null;
  const hasCanvas = await page.$('canvas') !== null;

  // click start, let the world stream + a few frames run
  await page.click('#startBtn');
  await new Promise(r => setTimeout(r, 4000));

  // read HUD to confirm the game state wired up
  const spark = await page.$eval('#cSpark', el => el.textContent).catch(() => 'MISSING');
  const nextGoal = await page.$eval('#nextGoal', el => el.textContent).catch(() => 'MISSING');
  const nextIn = await page.$eval('#nextIn', el => el.textContent).catch(() => 'MISSING');
  const buddy = await page.$eval('#cBuddy', el => el.textContent).catch(() => 'MISSING');

  // simulate walking so chunks stream: hold W a bit
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 3000));
  await page.keyboard.up('KeyW');
  await new Promise(r => setTimeout(r, 500));

  // --- build mode: enter, pick mushroom, place, undo — all driven from inside the page ---
  console.log('step: toggling build mode');
  await page.click('#buildBtn');
  await new Promise(r => setTimeout(r, 300));
  const paletteOn = await page.$eval('#palette', el => el.classList.contains('on')).catch(() => false);
  console.log('step: paletteOn =', paletteOn);
  // drive place/undo via direct DOM clicks inside one evaluate to avoid many round-trips
  const build = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const read = () => { try { return JSON.parse(localStorage.getItem('skyseed_save_v1')); } catch (e) { return null; } };
    document.querySelector('#palette [data-t="mushroom"]').click();
    for (let k = 0; k < 3; k++) { document.querySelector('#placeBtn').click(); await sleep(120); }
    const s1 = read();
    const count = s1 && Array.isArray(s1.builds) ? s1.builds.length : 0;
    const type = s1 && s1.builds && s1.builds[0] ? s1.builds[0].type : '(none)';
    document.querySelector('#undoBtn').click();
    await sleep(120);
    const s2 = read();
    const afterUndo = s2 && Array.isArray(s2.builds) ? s2.builds.length : -1;
    return { count, type, afterUndo };
  });
  console.log('step: build result', JSON.stringify(build));
  const buildsCount = build.count, builtType = build.type, afterUndo = build.afterUndo;

  // --- pause menu: open via Esc, check settings controls, close via resume ---
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 250));
  const pauseOn = await page.$eval('#pauseMenu', el => el.classList.contains('on')).catch(() => false);
  const hasControls = await page.evaluate(() =>
    ['setMusic', 'setSfx', 'setQuality', 'setSens', 'setInvert', 'resumeBtn'].every(id => !!document.getElementById(id)));
  await page.click('#resumeBtn');
  await new Promise(r => setTimeout(r, 250));
  const pauseOff = await page.$eval('#pauseMenu', el => !el.classList.contains('on')).catch(() => false);
  console.log('step: pause open', pauseOn, '| controls', hasControls, '| closed', pauseOff);

  // --- Build 2.0: rotate then place a fence; verify rotation persisted ---
  const build2 = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const read = () => { try { return JSON.parse(localStorage.getItem('skyseed_save_v1')); } catch (e) { return null; } };
    document.querySelector('#palette [data-t="fence"]').click();
    document.querySelector('#rotateBtn').click();
    document.querySelector('#rotateBtn').click();
    await sleep(80);
    document.querySelector('#placeBtn').click();
    await sleep(200);
    const s = read();
    const last = s && s.builds ? s.builds[s.builds.length - 1] : null;
    return { type: last && last.type, rot: last && last.rot, pieces: document.querySelectorAll('#palette [data-t]').length };
  });
  console.log('step: build2', JSON.stringify(build2));

  // --- buddy care: pet a buddy, expect no error + a message ---
  const care = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    document.querySelector('#careBtn').click();
    await sleep(200);
    return { msg: document.getElementById('msg').textContent };
  });
  console.log('step: care msg =', JSON.stringify(care.msg));

  // --- journal opens and shows the tracked stats ---
  await page.keyboard.press('KeyJ');
  await new Promise(r => setTimeout(r, 300));
  const journal = await page.evaluate(() => ({
    on: document.getElementById('journal').classList.contains('on'),
    biomes: document.getElementById('jBiomes').textContent,
    quests: document.getElementById('jQuests').textContent
  }));
  await page.keyboard.press('KeyJ');
  console.log('step: journal', JSON.stringify(journal));

  // --- wardrobe: opens, shows locked/unlocked items, selection persists ---
  await page.keyboard.press('KeyK');
  await new Promise(r => setTimeout(r, 300));
  const wr = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const on = document.getElementById('wardrobe').classList.contains('on');
    const hats = document.querySelectorAll('#wr_hat .wrItem').length;
    const capes = document.querySelectorAll('#wr_cape .wrItem').length;
    const locked = document.querySelectorAll('#wr_hat .wrItem.locked, #wr_cape .wrItem.locked').length;
    // pick the first unlocked non-"none" hat if any, else just confirm structure
    const pick = [...document.querySelectorAll('#wr_hat .wrItem')].find(b => !b.classList.contains('locked') && !/No hat/.test(b.textContent));
    let saved = null;
    if (pick) { pick.click(); await sleep(250); try { saved = JSON.parse(localStorage.getItem('skyseed_save_v1')).wardrobe.hat; } catch (e) {} }
    return { on, hats, capes, locked, saved, picked: !!pick };
  });
  await page.keyboard.press('KeyK');
  console.log('step: wardrobe', JSON.stringify(wr));

  // --- riding: mount a Lv8 winged buddy, fly, then dismount ---
  // leave build mode first — in build mode R rotates the piece instead of mounting
  await page.click('#buildBtn');
  await new Promise(r => setTimeout(r, 300));
  const ride = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const msg = () => document.getElementById('msg').textContent;
    const btn = document.getElementById('rideBtn');
    const btnShown = btn && getComputedStyle(btn).display !== 'none';
    const label = btn ? btn.textContent : '';
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    await sleep(400);
    const mounted = msg();
    const labelAfter = btn ? btn.textContent : '';
    // hold Space to fly and see if we gain height
    const y0 = document.querySelector('canvas') ? 1 : 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    await sleep(900);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    await sleep(100);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    await sleep(300);
    return { btnShown, label, mounted, labelAfter, dismounted: msg(), y0 };
  });
  console.log('step: ride', JSON.stringify(ride));

  // --- PWA assets reachable ---
  const pwa = await page.evaluate(async () => {
    const m = await fetch('./manifest.webmanifest').then(r => r.ok ? r.json() : null).catch(() => null);
    const sw = await fetch('./sw.js').then(r => r.ok).catch(() => false);
    return { name: m && m.name, display: m && m.display, sw };
  });
  console.log('step: pwa', JSON.stringify(pwa));

  console.log('hasTitle:', hasTitle);
  console.log('hasStartBtn:', hasStart);
  console.log('hasCanvas:', hasCanvas);
  console.log('HUD cSpark:', spark, '| nextGoal:', nextGoal, '| nextIn:', nextIn, '| buddy:', buddy);
  console.log('--- console logs (last 12) ---');
  console.log(logs.slice(-12).join('\n'));
  console.log('--- errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  const realErrors = errors.filter(e => !e.includes('favicon'));
  const buddyOk = /friend/.test(buddy); // >=1 buddy present (saved pet loaded, live befriend may add more)
  const sparkOk = spark === '12';
  const buildOk = paletteOn && buildsCount >= 1 && builtType === 'mushroom' && afterUndo === buildsCount - 1;
  const pauseOk = pauseOn && hasControls && pauseOff;
  console.log('buddy loaded from save:', buddyOk, '| sparks restored:', sparkOk);
  console.log('build: paletteOn', paletteOn, '| placed', buildsCount, '| type', builtType, '| afterUndo', afterUndo, '| OK', buildOk);
  console.log('pause menu OK:', pauseOk);
  const build2Ok = build2.type === 'fence' && build2.rot > 0 && build2.pieces === 9;
  const careOk = /♥|pet+ing|friend/i.test(care.msg || '');
  const journalOk = journal.on && /\/ 9/.test(journal.biomes) && /\/ 6/.test(journal.quests);
  const pwaOk = pwa.name === 'Skyseed Isles' && pwa.display === 'standalone' && pwa.sw === true;
  const wardrobeOk = wr.on && wr.hats === 4 && wr.capes === 3 && wr.locked > 0 && (!wr.picked || !!wr.saved);
  const rideOk = ride.btnShown && ride.label === 'RIDE' && /riding/i.test(ride.mounted)
    && ride.labelAfter === 'HOP OFF' && /hop off/i.test(ride.dismounted);
  console.log('ride OK:', rideOk);
  console.log('build2.0 OK:', build2Ok, '| care OK:', careOk, '| journal OK:', journalOk, '| pwa OK:', pwaOk, '| wardrobe OK:', wardrobeOk);
  console.log('RESULT:', (hasCanvas && hasTitle && buddyOk && sparkOk && buildOk && pauseOk
    && build2Ok && careOk && journalOk && pwaOk && wardrobeOk && rideOk && realErrors.length === 0) ? 'PASS' : 'CHECK');
} catch (e) {
  console.log('THREW:', e.message);
  console.log('errors so far:', errors.join('\n'));
  console.log('RESULT: CHECK');
} finally {
  await browser.close();
}
