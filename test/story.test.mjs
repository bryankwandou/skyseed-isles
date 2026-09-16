// Proves two claims made about the world:
//  1. the map is not a repeating pattern: regions are irregular, biome neighbours vary,
//     places have distinct names, and broad continent islands really get built;
//  2. the story has chapters that play as scenes, and the new quests are completed by
//     doing the thing they ask (entering rooms, crafting, travelling, turning in shards).
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.SHOT_DIR || 'C:/Users/arche/AppData/Local/Temp/claude/e--000VSCODE-PROJECT-MULAI-DARI-DESEMBER-2025-AlterCast/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const URL = process.env.TEST_URL || 'http://127.0.0.1:5610/play/';
const b = await puppeteer.launch({
  executablePath: EDGE, headless: 'new', defaultViewport: { width: 1280, height: 800 },
  userDataDir: OUT + 'edge-story-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const p = await b.newPage(); const errs = []; const fails = [];
const ok = (name, cond, detail) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); if (!cond) fails.push(name); };
const wait = ms => new Promise(r => setTimeout(r, ms));
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await wait(1500);
await p.evaluate(() => window.__sky.setGfx('setAuto', false));

// ---------------- map ----------------
const map = await p.evaluate(() => {
  const S = window.__sky, R = 240, seen = new Map(), names = new Set();
  // walk a 3 km square on a 60-unit grid
  const grid = [];
  for (let i = -25; i <= 25; i++) { const row = []; for (let j = -25; j <= 25; j++) {
    const r = S.region(i * 60, j * 60); row.push(r.biome); seen.set(r.key, r); names.add(r.name);
  } grid.push(row); }
  // a ring layout would put the same biome at the same distance in every direction:
  // check four points at equal distance 1500 units out
  const d = 1500, compass = [S.region(d, 0), S.region(-d, 0), S.region(0, d), S.region(0, -d)].map(r => r.biome);
  // biome sequence along one straight line, collapsed; a ring world repeats A,B,C,...,A,B,C
  const line = []; for (let x = 0; x < 6000; x += 30) { const bb = S.region(x, 777).biome; if (line[line.length - 1] !== bb) line.push(bb); }
  const regions = [...seen.values()];
  const byBiome = {}; regions.forEach(r => (byBiome[r.biome] = (byBiome[r.biome] || 0) + 1));
  return { regions: regions.length, uniqueNames: names.size, home: S.region(0, 0), byBiome, compass, line,
    sample: regions.slice(0, 6).map(r => r.name), continents: S.continents(40).length };
});
ok('the start is always a meadow', map.home.biome === 'Meadow Isles', map.home.name);
ok('a 3 km square holds many separate regions', map.regions >= 120, map.regions + ' regions');
ok('regions have their own names', map.uniqueNames >= map.regions * 0.8, map.uniqueNames + ' names for ' + map.regions + ' regions; e.g. ' + map.sample.join(', '));
ok('all nine biomes appear', Object.keys(map.byBiome).length === 9, JSON.stringify(map.byBiome));
ok('same distance, different directions, different land', new Set(map.compass).size >= 2, map.compass.join(' / '));
const seq = map.line.join('>');
const period9 = map.line.length > 18 && map.line.slice(0, 9).join('>') === map.line.slice(9, 18).join('>');
ok('biomes along a straight line do not repeat in a fixed cycle', !period9, map.line.length + ' changes: ' + map.line.slice(0, 10).join(' > '));
ok('continents are placed across the map', map.continents >= 100, map.continents + ' continent cells within 1.8 km');

// fly to a continent and confirm it is built large
const target = await p.evaluate(() => window.__sky.continents(6).sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0]);
await p.evaluate(([cx, cz]) => window.__sky.teleport ? window.__sky.teleport(cx * 44, 30, cz * 44) : null, target);
let built = [];
for (let i = 0; i < 20 && !built.length; i++) { await wait(500); built = await p.evaluate(() => window.__sky.loadedContinents()); }
ok('a continent island is actually built, much larger than normal islands', built.length > 0 && Math.max(...built) >= 13, 'cell ' + target + ' radii ' + JSON.stringify(built));

// ---------------- story ----------------
// jump to the start of Chapter III with the chapters before it finished
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('skyseed_save_v1') || '{}');
  s.quest = { i: 12, base: null }; s.treasures = 10;
  localStorage.setItem('skyseed_save_v1', JSON.stringify(s));
});
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('canvas'); await p.click('#startBtn'); await wait(1500);
const st = () => p.evaluate(() => window.__sky.story());
let s0 = await st();
ok('20 quests across 4 chapters', s0.total === 20 && s0.chapters.length === 4, s0.total + ' quests, ' + s0.chapters.length + ' chapters');
await p.evaluate(() => window.__sky.talk()); await wait(200);
s0 = await st();
ok('a new chapter opens with a title card', /Bab III|Chapter III/.test(s0.head), s0.head);
ok('and plays as several pages behind Next', s0.pagesLeft >= 2 && /Lanjut|Next/.test(s0.btn), s0.pagesLeft + ' more, button "' + s0.btn + '"');
await p.screenshot({ path: OUT + 'story-chapter3.png' });
while ((await st()).pagesLeft > 0) { await p.click('#dlgBtn'); await wait(120); }
s0 = await st();
ok('the last page is the quest itself', /Tovi/.test(s0.text) && /Oke|Okay/.test(s0.btn), s0.text.slice(0, 70));
await p.click('#dlgBtn'); await wait(150);
ok('the HUD tracks it', /0\/1/.test(s0.line) || /0\/1/.test((await st()).line), (await st()).line);

// quest 12: go into a cottage
await p.evaluate(() => window.__sky.enterHouse('house')); await wait(600);
await p.evaluate(() => window.__sky.leaveHouse()); await wait(600);
ok('entering a cottage completes the cottage quest', /Penjaga|Skykeeper/.test((await st()).line), (await st()).line);
await p.evaluate(() => window.__sky.talk()); await wait(150);
ok('and the Skykeeper tells what was found', /surat|letter/i.test((await st()).text), (await st()).text.slice(0, 80));
await p.click('#dlgBtn'); await wait(100);

// quest 13 cave, 14 craft charm, 15 mountain, 16 arena
const doQuest = async (label, act) => {
  await p.evaluate(() => window.__sky.talk()); await wait(120);
  while ((await st()).pagesLeft > 0) { await p.click('#dlgBtn'); await wait(80); }
  await p.click('#dlgBtn'); await wait(80);
  await act(); await wait(500);
  const before = (await st()).quest;
  await p.evaluate(() => window.__sky.talk()); await wait(150);
  const after = await st();
  ok(label, after.quest === before + 1, 'quest ' + before + ' -> ' + after.quest + ' · ' + after.text.slice(0, 60));
  while ((await st()).pagesLeft > 0) { await p.click('#dlgBtn'); await wait(80); }
  await p.click('#dlgBtn'); await wait(80);
};
await doQuest('a cave visit finishes the cave quest', async () => { await p.evaluate(() => window.__sky.enterHouse('cave')); await wait(500); await p.evaluate(() => window.__sky.leaveHouse()); });
await doQuest('crafting a Glow Charm finishes the charm quest', async () => {
  await p.evaluate(() => { window.__sky.bagGive('shard', 2); window.__sky.bagGive('petal', 1); });
  await p.keyboard.press('KeyI'); await wait(300);
  await p.evaluate(() => document.querySelector('.bagGo[data-recipe="charm"]').click()); await wait(200);
  await p.keyboard.press('KeyI');
});
await doQuest('a mountain climb finishes the mountain quest', async () => { await p.evaluate(() => window.__sky.enterHouse('mountain')); await wait(500); await p.evaluate(() => window.__sky.leaveHouse()); });
await doQuest('an arena visit finishes Chapter III', async () => { await p.evaluate(() => window.__sky.enterHouse('arena')); await wait(500); await p.evaluate(() => window.__sky.leaveHouse()); });

// Chapter IV opens with its own title
await p.evaluate(() => window.__sky.talk()); await wait(150);
ok('Chapter IV opens with its own title card', /Bab IV|Chapter IV/.test((await st()).head), (await st()).head);
while ((await st()).pagesLeft > 0) { await p.click('#dlgBtn'); await wait(80); }
await p.click('#dlgBtn'); await wait(80);

// finale: skip the travel and treat quests by save, then turn in shards
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('skyseed_save_v1'));
  s.quest = { i: 19, base: null }; s.bag = Object.assign(s.bag || {}, { shard: 7 });
  localStorage.setItem('skyseed_save_v1', JSON.stringify(s));
});
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('canvas'); await p.click('#startBtn'); await wait(1500);
await p.evaluate(() => window.__sky.talk()); await wait(100); await p.click('#dlgBtn'); await wait(100);
// measure across the turn-in itself: Miru can pick up a ring (and a shard) while standing at spawn
const shardsBefore = await p.evaluate(() => window.__sky.bag().items.shard);
await p.evaluate(() => window.__sky.talk()); await wait(150);
const fin = await st();
const shardsAfter = await p.evaluate(() => window.__sky.bag().items.shard);
ok('turning in 6 shards ends the story', fin.quest === 20, 'quest ' + fin.quest);
ok('exactly 6 shards are taken from the Bag', shardsBefore - shardsAfter === 6, shardsBefore + ' -> ' + shardsAfter);
ok('the ending plays as a scene of several pages', fin.pagesLeft >= 3, fin.pagesLeft + ' pages after the first');
const pages = [fin.text];
while ((await st()).pagesLeft > 0) { await p.click('#dlgBtn'); await wait(100); pages.push((await st()).text); }
await p.screenshot({ path: OUT + 'story-ending.png' });
ok('Tovi comes home', pages.some(t => /Tovi/.test(t)), pages[pages.length - 1].slice(0, 80));
await p.click('#dlgBtn'); await wait(100);
await p.evaluate(() => document.getElementById('journalBtn').click()); await wait(300);
const journal = await p.evaluate(() => [...document.querySelectorAll('#jStory .jChapter')].map(c => c.querySelector('h4').textContent + ' — ' + c.querySelector('p').textContent.slice(0, 40)));
ok('the journal tells the whole story so far', journal.length === 4, journal.join(' | '));
await p.evaluate(() => document.getElementById('jStory').scrollIntoView({ block: 'center' }));
await p.screenshot({ path: OUT + 'story-journal.png' });

ok('no page errors', !errs.length, [...new Set(errs)].join(' | '));
await b.close();
console.log(fails.length ? 'STORY TEST: FAIL ' + fails.length : 'STORY TEST: PASS');
process.exit(fails.length ? 1 : 0);
