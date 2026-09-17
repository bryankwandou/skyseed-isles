// A tablet photo showed the score panel sitting on top of the journal, wardrobe and pet
// buttons, so a child could not tap them. For each screen shape this checks that the HUD
// rectangle does not intersect any visible on-screen button.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const BROWSER = process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.SHOT_DIR || 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
mkdirSync(OUT, { recursive: true });

const SHAPES = {
  tabletLandscape: { width: 1280, height: 640, isMobile: true, hasTouch: true, isLandscape: true },
  phoneLandscape: { width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true },
  phonePortrait: { width: 390, height: 780, isMobile: true, hasTouch: true },
  desktop: { width: 1366, height: 768 }
};

const b = await puppeteer.launch({ executablePath: BROWSER, headless: 'new',
  userDataDir: OUT + 'edge-hud-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const results = {};
for (const [name, vp] of Object.entries(SHAPES)) {
  const p = await b.newPage();
  await p.setViewport(vp);
  await p.evaluateOnNewDocument(() => localStorage.setItem('skyseed_save_v1', JSON.stringify(
    { sparks: 40, seeds: 3, energy: 5, unlocked: ['jump'], pets: [] })));
  await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => window.__sky && document.getElementById('startBtn'), { timeout: 90000 });
  await p.evaluate(() => document.getElementById('startBtn').click());
  await new Promise(r => setTimeout(r, 4000));
  const m = await p.evaluate(() => {
    const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 && r.height > 0; };
    const hud = document.getElementById('hud').getBoundingClientRect();
    const hits = [];
    for (const el of document.querySelectorAll('button')) {
      if (!vis(el) || el.closest('#hud')) continue;
      // closed cards are display:none, so every button still visible is one a child can see
      const r = el.getBoundingClientRect();
      const overlap = r.left < hud.right && r.right > hud.left && r.top < hud.bottom && r.bottom > hud.top;
      if (overlap) hits.push(el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 12));
    }
    return { hud: [hud.left, hud.top, hud.right, hud.bottom].map(Math.round), hits };
  });
  await p.screenshot({ path: OUT + `shot-hud-${name}.png` });
  console.log(name, JSON.stringify(m));
  results[name] = m.hits.length === 0;
  await p.close();
}
await b.close();
console.log('RESULTS', JSON.stringify(results));
const pass = Object.values(results).every(Boolean);
console.log('HUD OVERLAP TEST:', pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
