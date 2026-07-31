import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT='C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',defaultViewport:{width:1280,height:720},
  userDataDir:OUT+'edge-dg3-'+Date.now(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader']});
const p=await b.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push('CONSOLE '+m.text().slice(0,80));});
await p.evaluateOnNewDocument(()=>{localStorage.setItem('skyseed_save_v1',JSON.stringify({sparks:50,seeds:10,energy:3,skins:[],unlocked:['jump'],biomes:[],pets:[],builds:[]}));});
await p.goto(process.env.TEST_URL,{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForSelector('canvas',{timeout:45000});
await p.click('#startBtn'); await new Promise(r=>setTimeout(r,2000));

await p.click('#dungeonBtn'); await new Promise(r=>setTimeout(r,1500));
const s1=await p.evaluate(()=>window.__sky.state());
const camGap=Math.hypot(s1.camera[0]-s1.player[0], s1.camera[2]-s1.player[2]);
console.log('entered: crystals='+s1.crystals+' energy-ok camGap='+camGap.toFixed(1));
await p.screenshot({path:OUT+'shot-dungeon.png'});

// collect all six by stepping onto each in turn
for(let i=0;i<6;i++){
  await p.evaluate(()=>window.__sky.toCrystal());
  await new Promise(r=>setTimeout(r,450));
}
const s2=await p.evaluate(()=>window.__sky.state());
const cnt=await p.evaluate(()=>document.getElementById('dgCount').textContent);
console.log('after collecting: found='+s2.found+' remaining='+s2.crystals+' hud='+cnt);
await p.screenshot({path:OUT+'shot-dungeon-cleared.png'});

// walk into the chest to claim
await p.evaluate(()=>window.__sky.toChest());
await new Promise(r=>setTimeout(r,3000));
const after=await p.evaluate(()=>({
  seeds:document.getElementById('cSeed').textContent,
  inD:window.__sky.state().inDungeon,
  saved:JSON.parse(localStorage.getItem('skyseed_save_v1')||'{}')}));
console.log('after chest: seeds='+after.seeds+' stillInDungeon='+after.inD+' cleared='+after.saved.dungeonsCleared);
await p.screenshot({path:OUT+'shot-after-rift.png'});

const pass = s1.crystals===6 && camGap<40 && s2.found===6 && s2.crystals===0 &&
  after.seeds==='35' && after.inD===false && after.saved.dungeonsCleared===1;
console.log('--- errors ---'); errs.slice(0,5).forEach(e=>console.log(e));
console.log('DUNGEON TEST:', pass?'PASS':'FAIL');
await b.close();
