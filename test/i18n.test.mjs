// Is the game actually readable in Indonesian, and does the toggle work?
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.env.TEST_URL || 'http://127.0.0.1:5610/play/';

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  userDataDir: 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/edge-i18n-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 45000 });
await new Promise(r => setTimeout(r, 2500));

const id = await page.evaluate(() => ({
  htmlLang: document.documentElement.lang,
  start: document.getElementById('startBtn').textContent,
  sparks: document.querySelector('#hud [data-i18n="Sparks"]').textContent,
  buddies: document.querySelector('#hud [data-i18n="Buddies"]').textContent,
  quest: document.getElementById('qLine').textContent,
  build: document.getElementById('buildBtn').textContent,
  pet: document.getElementById('careBtn').textContent
}));
console.log('ID:', JSON.stringify(id));

// open the journal + wardrobe to check overlays translated
await page.click('#startBtn');
await new Promise(r => setTimeout(r, 1500));
const overlays = await page.evaluate(() => {
  document.getElementById('journalBtn').click();
  const j = document.querySelector('#journalCard h2').textContent;
  document.getElementById('journalClose').click();
  document.getElementById('wardrobeBtn').click();
  const w = document.querySelector('#wardrobeCard h2').textContent;
  const hat = document.querySelector('#wr_hat .wrItem').textContent;
  const req = document.querySelector('#wr_hat .wrReq');
  document.getElementById('wardrobeClose').click();
  return { journal: j, wardrobe: w, hat, req: req ? req.textContent : '' };
});
console.log('overlays:', JSON.stringify(overlays));

// switch to English and confirm it flips back
const en = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById('pauseBtn').click();
  await sleep(300);
  const sel = document.getElementById('setLang');
  sel.value = 'en';
  sel.dispatchEvent(new Event('change'));
  await sleep(400);
  const out = {
    htmlLang: document.documentElement.lang,
    sparks: document.querySelector('#hud [data-i18n="Sparks"]').textContent,
    build: document.getElementById('buildBtn').textContent
  };
  document.getElementById('resumeBtn').click();
  return out;
});
console.log('EN after toggle:', JSON.stringify(en));

const idOk = id.htmlLang === 'id' && id.start === 'Mulai Petualangan' && id.sparks === 'Kilau'
  && id.buddies === 'Teman' && id.build === 'Bangun' && id.pet === '♥ Elus'
  && /Penjaga Langit/.test(id.quest);
const overlaysOk = overlays.journal === 'Jurnal Langit' && overlays.wardrobe === 'Lemari Baju Miru'
  && overlays.hat === 'Tanpa topi' && /Kumpulkan|Temukan|Selesaikan/.test(overlays.req);
const enOk = en.htmlLang === 'en' && en.sparks === 'Sparks' && en.build === 'Build';
console.log('indonesian OK:', idOk, '| overlays OK:', overlaysOk, '| english toggle OK:', enOk);
console.log('page errors:', errs.length ? errs.join(' | ') : '(none)');
console.log('RESULT:', (idOk && overlaysOk && enOk && errs.length === 0) ? 'PASS' : 'FAIL');
await browser.close();
