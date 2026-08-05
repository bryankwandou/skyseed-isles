// The manifest now allows portrait, so the panels have to actually work at that shape.
// What matters is not "does it look nice" but "can a child reach Close" — so this measures
// whether the card fits the screen and whether the close button is inside the viewport.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', defaultViewport: { width: 390, height: 780 },
  userDataDir: OUT + 'edge-por-' + Date.now(), args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'] });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => localStorage.setItem('skyseed_save_v1', JSON.stringify(
  { sparks: 900, seeds: 40, energy: 5, treasures: 3, unlocked: ['jump', 'glide'],
    biomes: ['a', 'b'], pets: [], builds: [], badges: ['firstfriend', 'diver'] })));
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 2500));

const pass = {};
for (const [btn, card, close] of [['journalBtn', 'journalCard', 'journalClose'],
                                  ['wardrobeBtn', 'wardrobeCard', 'wardrobeClose']]) {
  await p.click('#' + btn); await new Promise(r => setTimeout(r, 800));
  const m = await p.evaluate(([c, x]) => {
    const el = document.getElementById(c), cl = document.getElementById(x);
    const r = el.getBoundingClientRect(), cr = cl.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight,
      scrolls: el.scrollHeight > el.clientHeight + 1,
      closeInView: cr.top >= 0 && cr.bottom <= innerHeight && cr.height >= 40 };
  }, [card, close]);
  console.log(card, JSON.stringify(m));
  // the card must start on screen and its Close must be reachable without pinch-zooming
  pass[card] = m.top >= 0 && m.bottom <= m.vh + 1 && m.closeInView;
  if (card === 'journalCard') await p.screenshot({ path: OUT + 'shot-portrait-journal.png' });
  await p.evaluate(x => document.getElementById(x).click(), close);
  await new Promise(r => setTimeout(r, 400));
}
console.log('RESULTS', JSON.stringify(pass));
console.log('PORTRAIT TEST:', Object.values(pass).every(Boolean) ? 'PASS' : 'FAIL');
await b.close();
