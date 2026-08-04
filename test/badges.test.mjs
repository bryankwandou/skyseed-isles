// Badges. The game already counted all of these things and showed the child a bare number.
// This checks that a badge is actually awarded at the moment it is earned, that it survives
// a reload, and that a locked one is distinguishable without relying on colour.
import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT='C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',defaultViewport:{width:1280,height:720},
  userDataDir:OUT+'edge-bg-'+Date.now(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader']});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
// start with nothing earned
// seed ONLY on the first load — this also runs on reload, and overwriting there would
// destroy the very thing step 4 is trying to prove survived
await p.evaluateOnNewDocument(()=>{ if(!localStorage.getItem('skyseed_save_v1'))
  localStorage.setItem('skyseed_save_v1',JSON.stringify(
  {sparks:80,seeds:5,energy:5,unlocked:['jump','glide'],biomes:[],pets:[],builds:[]}));});
await p.goto(process.env.TEST_URL,{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForSelector('canvas',{timeout:45000});
await p.click('#startBtn'); await new Promise(r=>setTimeout(r,2500));
const pass={};

// 1. journal shows every badge, all locked, and locked ones say so in words
await p.click('#journalBtn'); await new Promise(r=>setTimeout(r,500));
const start=await p.evaluate(()=>({
  total:document.querySelectorAll('#jBadges .badge').length,
  earned:document.querySelectorAll('#jBadges .badge.on').length,
  count:document.getElementById('jBadgeCount').textContent,
  label:document.querySelector('#jBadges .badge').getAttribute('aria-label'),
  icon:document.querySelector('#jBadges .badge .bIco').textContent
}));
console.log('start:',JSON.stringify(start));
pass.locked = start.total===12 && start.earned===0 && /0 \/ 12/.test(start.count) &&
  /belum terbuka/.test(start.label) && start.icon==='🔒';

// 2. every badge name is Indonesian in the panel
const txt=await p.evaluate(()=>document.getElementById('jBadges').innerText);
const leaks=['First Friend','Rift Diver','Abyss Walker','Builder','locked'].filter(w=>txt.includes(w));
console.log('english leaks:',JSON.stringify(leaks));
pass.lang = leaks.length===0;
await p.evaluate(()=>document.getElementById('journalClose').click());

// 3. clearing a rift awards the Rift Diver badge AT THE MOMENT it happens
await p.click('#dungeonBtn'); await new Promise(r=>setTimeout(r,700));
await p.evaluate(()=>document.querySelector('#gateTiers .gateGo:not(:disabled)')?.click());
await new Promise(r=>setTimeout(r,1500));
for(let i=0;i<8;i++){ await p.evaluate(()=>window.__sky.toCrystal()); await new Promise(r=>setTimeout(r,320)); }
await p.evaluate(()=>window.__sky.toChest()); await new Promise(r=>setTimeout(r,2500));
const said=await p.evaluate(()=>document.getElementById('say')?.textContent||'');
const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('skyseed_save_v1')||'{}').badges||[]);
console.log('after rift: badges=',JSON.stringify(saved),'| said=',JSON.stringify(said));
pass.award = saved.includes('diver');

// 4. it survives a reload and shows as earned, with its real icon back
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForSelector('#startBtn',{timeout:45000});
await p.click('#startBtn'); await new Promise(r=>setTimeout(r,2500));
await p.click('#journalBtn'); await new Promise(r=>setTimeout(r,500));
const after=await p.evaluate(()=>{
  const on=[...document.querySelectorAll('#jBadges .badge.on')];
  return {earned:on.length,count:document.getElementById('jBadgeCount').textContent,
    names:on.map(d=>d.querySelector('.bName').textContent),
    icon:on[0]?on[0].querySelector('.bIco').textContent:''};
});
console.log('after reload:',JSON.stringify(after));
pass.persist = after.earned>=1 && after.icon!=='🔒' && /1 \/ 12|2 \/ 12/.test(after.count);

await p.screenshot({path:OUT+'shot-badges.png'});
console.log('--- errors ---'); errs.slice(0,5).forEach(e=>console.log(e));
console.log('RESULTS',JSON.stringify(pass));
console.log('BADGES TEST:', Object.values(pass).every(Boolean)?'PASS':'FAIL');
await b.close();
