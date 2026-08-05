// The Skykeeper used to run out of things to say after six quests. Six more were added on top
// of the systems that arrived later (rifts, waypoints, feeding). The dangerous part is the
// snapshot: a child who is mid-quest today has a save with none of the new fields in it, and
// if that turns into NaN their quest can never complete. That is what step 3 is really for.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 720 },
  userDataDir: OUT + 'edge-q-' + Date.now(), args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));

// an old save: quest 6 in progress, snapshot taken before the new fields existed
await p.evaluateOnNewDocument(() => localStorage.setItem('skyseed_save_v1', JSON.stringify({
  sparks: 300, seeds: 5, energy: 5, treasures: 0, unlocked: ['jump', 'glide'],
  biomes: [], pets: [], builds: [], badges: [],
  quest: { i: 6, base: { sparks: 0, pets: 0, bops: 0, builds: 0, biomes: 0, treasures: 0 } }
})));
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 2500));
const pass = {};

// 1. there are twelve quests now, and the journal counts them
await p.click('#journalBtn'); await new Promise(r => setTimeout(r, 700));
const jq = await p.evaluate(() => document.getElementById('jQuests').textContent);
console.log('journal quests:', JSON.stringify(jq));
pass.count = /\/ 12/.test(jq);
await p.evaluate(() => document.getElementById('journalClose').click());

// 2. the seventh quest reads as a real target, not "NaN" and not "All done"
const line = await p.evaluate(() => document.getElementById('qLine').textContent);
console.log('quest line on an old save:', JSON.stringify(line));
pass.noNaN = !/NaN|undefined/.test(line);
pass.live = !/Penjelajah Langit|All done/.test(line);

// 3. it can actually be completed — clearing one rift must satisfy it
const before = await p.evaluate(() => document.getElementById('qLine').textContent);
await p.evaluate(() => { window.__sky.setEnergy(5); });
await p.click('#dungeonBtn'); await new Promise(r => setTimeout(r, 700));
await p.evaluate(() => document.querySelector('#gateTiers .gateGo:not(:disabled)')?.click());
await new Promise(r => setTimeout(r, 1500));
for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__sky.toCrystal()); await new Promise(r => setTimeout(r, 320)); }
await p.evaluate(() => window.__sky.toChest()); await new Promise(r => setTimeout(r, 2500));
const after = await p.evaluate(() => document.getElementById('qLine').textContent);
console.log('quest line before/after rift:', JSON.stringify(before), '->', JSON.stringify(after));
pass.completable = /Kembali|Return/.test(after);

// 4. every new quest string is Indonesian
const langLeak = await p.evaluate(() => {
  // the panel is the only place the raw give-text is shown, so ask the game directly
  return typeof window.__sky.questText === 'function' ? window.__sky.questText() : null;
});
const txtAll = await p.evaluate(() => document.body.innerText);
const leaks = ['rift', 'waypoints', 'berries', 'moonpetals', 'depth'].filter(w => txtAll.includes(w));
console.log('english leaks on screen:', JSON.stringify(leaks), '| questText hook:', langLeak);
pass.lang = leaks.length === 0;

await p.screenshot({ path: OUT + 'shot-quests.png' });
console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('RESULTS', JSON.stringify(pass));
console.log('QUESTS TEST:', Object.values(pass).every(Boolean) ? 'PASS' : 'FAIL');
await b.close();
