// The family board inside the Sky Journal. Twelve children play on twelve phones; this is the
// only place any of them can see that the others exist. /api/board is stubbed here because the
// real one needs a database — what is being tested is the panel, not the query.
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', defaultViewport: { width: 420, height: 820 },
  userDataDir: OUT + 'edge-fam-' + Date.now(), args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));

let serve = true;
await p.setRequestInterception(true);
p.on('request', r => {
  if (r.url().includes('/api/board')) {
    if (!serve) return r.respond({ status: 401, contentType: 'application/json', body: '{"error":"Not logged in"}' });
    return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
      me: 'nayra',
      goal: 5000, total: 1250,
      players: [{ username: 'bima', sparks: 700, badges: 3 }, { username: 'nayra', sparks: 400, badges: 2 },
                { username: '<img src=x onerror=alert(1)>', sparks: 150, badges: 0 }] })});
  }
  r.continue();
});
await p.evaluateOnNewDocument(() => localStorage.setItem('skyseed_save_v1',
  JSON.stringify({ sparks: 400, seeds: 5, energy: 5, unlocked: ['jump'], biomes: [], pets: [], builds: [], badges: [] })));
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('canvas', { timeout: 45000 });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 2500));
const pass = {};

// 1. the board lists everyone, ranked, with the shared goal filled to the right fraction
await p.click('#journalBtn'); await p.waitForFunction(() => { const f = document.getElementById('jFamily'); return f && (f.querySelector('.fRow') || f.querySelector('.jNote')); }, { timeout: 15000 }); await new Promise(r => setTimeout(r, 400));
const view = await p.evaluate(() => ({
  rows: [...document.querySelectorAll('#jFamily .fRow')].map(r => r.querySelector('.fName').textContent),
  width: document.getElementById('jGoalFill').style.width,
  num: document.getElementById('jGoalNum').textContent,
  aria: document.getElementById('jGoalBar').getAttribute('aria-valuenow'),
  meRows: document.querySelectorAll('#jFamily .fRow.me').length,
  meWord: document.querySelector('#jFamily .fRow.me .fMe')?.textContent || ''
}));
console.log('view:', JSON.stringify(view));
pass.list = view.rows.length === 3 && view.rows[0] === 'bima';
pass.goal = view.width === '25%' && view.aria === '1250' && /5.?000/.test(view.num);
// your own row is marked with a word, not only a colour
pass.me = view.meRows === 1 && view.meWord === 'kamu';

// 2. a username is never treated as markup
const injected = await p.evaluate(() => ({
  imgs: document.querySelectorAll('#jFamily img').length,
  text: [...document.querySelectorAll('#jFamily .fName')].some(n => n.textContent.includes('onerror'))
}));
console.log('injection:', JSON.stringify(injected));
pass.safe = injected.imgs === 0 && injected.text === true;

// 3. every word is Indonesian
const txt = await p.evaluate(() => document.getElementById('journalCard').innerText);
const leaks = ['Family', 'you', 'Nobody else', 'Looking for'].filter(w => txt.includes(w));
console.log('english leaks:', JSON.stringify(leaks), '| has Keluarga:', txt.includes('Keluarga'));
pass.lang = leaks.length === 0 && txt.includes('Keluarga');

// 4. a guest, or a child with no internet, is told why instead of staring at an empty box
serve = false;
await p.evaluate(() => document.getElementById('journalClose').click());
await new Promise(r => setTimeout(r, 300));
await p.click('#journalBtn'); await p.waitForFunction(() => { const f = document.getElementById('jFamily'); return f && (f.querySelector('.fRow') || f.querySelector('.jNote')); }, { timeout: 15000 }); await new Promise(r => setTimeout(r, 400));
const off = await p.evaluate(() => document.getElementById('jFamily').innerText);
console.log('offline:', JSON.stringify(off));
pass.offline = /Belum bisa melihat yang lain/.test(off);

await p.screenshot({ path: OUT + 'shot-family.png' });
console.log('--- errors ---'); errs.slice(0, 5).forEach(e => console.log(e));
console.log('RESULTS', JSON.stringify(pass));
console.log('FAMILY TEST:', Object.values(pass).every(Boolean) ? 'PASS' : 'FAIL');
await b.close();
