import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const B = process.env.TEST_URL || 'http://127.0.0.1:5620/play/';
const OUT = 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new',
  defaultViewport:{width:1280,height:720}, userDataDir: OUT+'edge-shop-'+Date.now(),
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader'] });
const page = await browser.newPage();
const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR '+e.message));
page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text().slice(0,90)); });
// seed a save with plenty of Seeds so purchases are affordable
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('skyseed_save_v1', JSON.stringify({
    sparks: 200, seeds: 100, energy: 2, skins: [], unlocked:['jump','glide'],
    biomes:['Meadow Isles'], pets:[], builds:[]
  }));
});
await page.goto(B,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('canvas',{timeout:45000});
await page.click('#startBtn');
await new Promise(r=>setTimeout(r,2500));

// HUD shows seeds + energy
const hud = await page.evaluate(()=>({ seed:document.getElementById('cSeed')?.textContent,
  energy:document.getElementById('cEnergy')?.textContent }));
console.log('HUD:', JSON.stringify(hud));

// open the shop with the T key
await page.keyboard.press('KeyT');
await new Promise(r=>setTimeout(r,600));
const opened = await page.evaluate(()=>document.getElementById('shop')?.classList.contains('on'));
console.log('shop opens with T:', opened);
await page.screenshot({path:OUT+'shot-shop.png'});

// buy a refill (energy 2 -> 3, seeds 100 -> 88)
const beforeRefill = await page.evaluate(()=>document.getElementById('shopEnergy')?.textContent);
await page.evaluate(()=>{ document.querySelector('#shopEnergyBox .shopBuy')?.click(); });
await new Promise(r=>setTimeout(r,700));
const afterRefill = await page.evaluate(()=>({ e:document.getElementById('shopEnergy')?.textContent,
  s:document.getElementById('shopSeeds')?.textContent }));
console.log('refill:', beforeRefill, '->', JSON.stringify(afterRefill));

// buy the first skin (aurora, 30) -> seeds 88 - 30 = 58, row becomes Owned
await page.evaluate(()=>{ document.querySelector('#shopSkinBox .shopBuy')?.click(); });
await new Promise(r=>setTimeout(r,700));
const afterSkin = await page.evaluate(()=>({ s:document.getElementById('shopSeeds')?.textContent,
  owned:document.querySelectorAll('#shopSkinBox .shopRow.owned').length,
  saved:JSON.parse(localStorage.getItem('skyseed_save_v1')||'{}').skins }));
console.log('buy skin:', JSON.stringify(afterSkin));

// the bought skin must now appear unlocked in the wardrobe
await page.keyboard.press('KeyT'); await new Promise(r=>setTimeout(r,400));
await page.keyboard.press('KeyK'); await new Promise(r=>setTimeout(r,700));
const wr = await page.evaluate(()=>{
  const btns=[...document.querySelectorAll('#wr_outfit .wrItem')];
  const a=btns.find(b=>/Aurora/i.test(b.textContent));
  return { found:!!a, locked:a?a.classList.contains('locked'):null, label:a?.textContent };
});
console.log('wardrobe aurora:', JSON.stringify(wr));

const pass = opened && afterRefill.e==='3/5' && afterRefill.s==='88' &&
  afterSkin.s==='58' && afterSkin.owned===1 && (afterSkin.saved||[]).includes('aurora') &&
  wr.found && wr.locked===false;
console.log('--- errors ---'); errs.slice(0,6).forEach(e=>console.log(e));
console.log('SHOP TEST:', pass ? 'PASS' : 'FAIL');
await browser.close();
