import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT='C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',defaultViewport:{width:1280,height:720},
  userDataDir:OUT+'edge-w-'+Date.now(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader']});
const p=await b.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push('CONSOLE '+m.text().slice(0,80));});
await p.evaluateOnNewDocument(()=>{localStorage.setItem('skyseed_save_v1',JSON.stringify({
  sparks:80,seeds:5,energy:3,skins:[],unlocked:['jump','glide'],biomes:[],pets:[],builds:[]}));});
await p.goto(process.env.TEST_URL,{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForSelector('canvas',{timeout:45000});
await p.click('#startBtn'); await new Promise(r=>setTimeout(r,2500));
const pass={};

// --- 1. energy regenerates on its own ---
await p.evaluate(()=>window.__sky.setEnergy(1));
await p.evaluate(()=>window.__sky.ageEnergy(13));  // 13 min => +2 points
const w1=await p.evaluate(()=>window.__sky.world());
pass.regen = w1.energy===3;
console.log('regen: energy 1 + 13min ->', w1.energy, '(expect 3) eta='+Math.round(w1.eta/1000)+'s');

// --- 2. world landmarks exist ---
console.log('landmarks: gates='+w1.gates+' waypoints='+w1.waypoints);
pass.landmarks = w1.gates>0 && w1.waypoints>0;

// --- 3. touching a waypoint unlocks fast travel ---
await p.evaluate(()=>window.__sky.toWaypoint());
await new Promise(r=>setTimeout(r,900));
const w2=await p.evaluate(()=>window.__sky.world());
console.log('waypoint unlocked:', w2.unlocked);
pass.waypoint = w2.unlocked===1;

// travel away then back
await p.click('#travelBtn'); await new Promise(r=>setTimeout(r,600));
const rows=await p.evaluate(()=>document.querySelectorAll('#travelList .travelGo').length);
await p.evaluate(()=>document.querySelector('#travelList .travelGo')?.click());
await new Promise(r=>setTimeout(r,1200));
const st=await p.evaluate(()=>window.__sky.state());
const wp=await p.evaluate(()=>JSON.parse(localStorage.getItem('skyseed_save_v1')).waypoints[0]);
const dist=Math.hypot(st.player[0]-wp.x, st.player[2]-wp.z);
const camGap=Math.hypot(st.camera[0]-st.player[0], st.camera[2]-st.player[2]);
console.log('fast travel: rows='+rows+' landedWithin='+dist.toFixed(1)+' camGap='+camGap.toFixed(1));
pass.travel = rows===1 && dist<3 && camGap<40;
await p.screenshot({path:OUT+'shot-waypoint.png'});

// --- 4. gate prompt: walking in must NOT auto-spend energy ---
const eBefore=(await p.evaluate(()=>window.__sky.world())).energy;
await p.evaluate(()=>window.__sky.toGate());
await new Promise(r=>setTimeout(r,1200));
const gateOpen=await p.evaluate(()=>document.getElementById('gatePanel').classList.contains('on'));
const eAfter=(await p.evaluate(()=>window.__sky.world())).energy;
const tiers=await p.evaluate(()=>({rows:document.querySelectorAll('#gateTiers .gateRow').length,
  locked:document.querySelectorAll('#gateTiers .gateRow.locked').length}));
console.log('gate: opened='+gateOpen+' energy '+eBefore+'->'+eAfter+' tiers='+JSON.stringify(tiers));
pass.gate = gateOpen && eBefore===eAfter && tiers.rows===5 && tiers.locked===4;
await p.screenshot({path:OUT+'shot-gate.png'});

// --- 5. entering from the gate spends exactly 1 and builds tier 1 ---
await p.evaluate(()=>document.querySelector('#gateTiers .gateGo:not(:disabled)')?.click());
await new Promise(r=>setTimeout(r,1500));
const s5=await p.evaluate(()=>window.__sky.state());
const w5=await p.evaluate(()=>window.__sky.world());
console.log('entered: crystals='+s5.crystals+' energy='+w5.energy+' hud='+
  await p.evaluate(()=>document.getElementById('dgCount').textContent));
pass.enter = s5.inDungeon && s5.crystals===6 && w5.energy===eAfter-1;

// clear it and check the tier ladder advances
for(let i=0;i<6;i++){ await p.evaluate(()=>window.__sky.toCrystal()); await new Promise(r=>setTimeout(r,420)); }
await p.evaluate(()=>window.__sky.toChest());
await new Promise(r=>setTimeout(r,3200));
const w6=await p.evaluate(()=>window.__sky.world());
const sv=await p.evaluate(()=>JSON.parse(localStorage.getItem('skyseed_save_v1')));
console.log('cleared: tier now='+w6.tier+' seeds='+sv.seeds+' cleared='+sv.dungeonsCleared);
pass.ladder = w6.tier===2 && sv.dungeonsCleared===1;

console.log('--- errors ---'); errs.slice(0,6).forEach(e=>console.log(e));
console.log('RESULTS', JSON.stringify(pass));
console.log('WORLD TEST:', Object.values(pass).every(Boolean)?'PASS':'FAIL');
await b.close();
