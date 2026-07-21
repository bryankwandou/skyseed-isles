// Does a guest's progress survive signing up for an account?
// This is the exact flow a child hits: play as guest, then create an account.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE || 'https://skyseed-isles.vercel.app';

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  userDataDir: 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/edge-mig-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const page = await browser.newPage();

// 1) Arrive as a guest who has already played a lot
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('skyseed_save_v1', JSON.stringify({
    sparks: 240, unlocked: ['jump', 'glide', 'triple', 'magnet'],
    biomes: ['Meadow Isles', 'Snow Isles'],
    pets: [{ level: 6, color: 0x7fe8c9, name: 'Boba' }, { level: 4, color: 0xff9ec6, name: 'Mochi' }],
    builds: [{ x: 1, y: 0, z: 1, type: 'tree', rot: 0 }, { x: 2, y: 0, z: 2, type: 'bench', rot: 0 }],
    treasures: 3, shinies: 1, bops: 12, wonders: ['1,1'], quest: { i: 4, base: null }
  }));
});
await page.goto(BASE + '/play/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 45000 });
await new Promise(r => setTimeout(r, 2500));
const before = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('skyseed_save_v1'));
  return { sparks: s.sparks, pets: s.pets.length, builds: s.builds.length, quest: s.quest.i };
});
console.log('guest progress BEFORE signup:', JSON.stringify(before));

// 2) The child creates an account (fresh, so the server has empty progress)
const u = 'qa_mig_' + Date.now().toString().slice(-6);
const reg = await page.evaluate(async (u) => {
  const r = await fetch('/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, email: u + '@example.com', password: 'KidPass123', confirm: 'KidPass123', acceptedTerms: true, acceptedPrivacy: true })
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}, u);
console.log('signup:', reg.ok, JSON.stringify(reg.data.progress));

// 3) Reload the game as a logged-in child — does the progress survive?
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 45000 });
await new Promise(r => setTimeout(r, 4000));
const after = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('skyseed_save_v1'));
  return {
    sparks: s.sparks, pets: (s.pets || []).length, builds: (s.builds || []).length,
    quest: (s.quest || {}).i, hud: document.getElementById('cSpark').textContent
  };
});
console.log('progress AFTER  signup:', JSON.stringify(after));

const survived = after.sparks === before.sparks && after.pets === before.pets
  && after.builds === before.builds && after.quest === before.quest;
console.log(survived ? 'RESULT: PASS — guest progress kept' : 'RESULT: FAIL — GUEST PROGRESS LOST');

// cleanup: remove the throwaway account
console.log('cleanup-user:' + u);
await browser.close();
