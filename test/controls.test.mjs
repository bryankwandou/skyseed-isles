// Does the child go where they are pointing?
// A child pushes forward and expects to walk away from the camera, into the world.
// This test never looks at code — it presses a key, then measures which way the body moved
// relative to where the camera is actually looking. That is the only definition that matters.
import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT='C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',defaultViewport:{width:1280,height:720,hasTouch:true},
  userDataDir:OUT+'edge-c-'+Date.now(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader']});
const p=await b.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push('CONSOLE '+m.text().slice(0,80));});
await p.evaluateOnNewDocument(()=>{localStorage.setItem('skyseed_save_v1',JSON.stringify({
  sparks:80,seeds:5,energy:3,skins:[],unlocked:['jump','glide'],biomes:[],pets:[],builds:[]}));});
await p.goto(process.env.TEST_URL,{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForSelector('canvas',{timeout:45000});
await p.click('#startBtn'); await new Promise(r=>setTimeout(r,2500));
const pass={};

// camera basis, measured from the live scene rather than assumed
const basis=async()=>{
  const s=await p.evaluate(()=>window.__sky.state());
  const fx=s.player[0]-s.camera[0], fz=s.player[2]-s.camera[2];
  const l=Math.hypot(fx,fz)||1;
  return {fx:fx/l, fz:fz/l, px:s.player[0], pz:s.player[2]};
};
// push an input for a moment, return how far we travelled along fwd / along right
async function push(fn){
  // start from open ground with the camera at a known angle every time, otherwise a tree
  // or a ledge turns "which way did they go" into a coin flip
  await p.evaluate(()=>window.__sky.clearGround());
  await new Promise(r=>setTimeout(r,350));
  const a=await basis();
  await fn(true); await new Promise(r=>setTimeout(r,700)); await fn(false);
  await new Promise(r=>setTimeout(r,120));
  const s=await p.evaluate(()=>window.__sky.state());
  const dx=s.player[0]-a.px, dz=s.player[2]-a.pz;
  // right-hand vector on the ground plane, for a camera looking along (fx,fz)
  return { fwd: dx*a.fx + dz*a.fz, right: dx*(-a.fz) + dz*(a.fx), moved: Math.hypot(dx,dz), yaw: s.yaw };
}
const key=k=>on=>on?p.keyboard.down(k):p.keyboard.up(k);

// --- 1. W walks away from the camera, S walks back toward it ---
const fwd=await push(key('w'));
console.log('W  ->', JSON.stringify({fwd:+fwd.fwd.toFixed(2), right:+fwd.right.toFixed(2)}));
pass.wForward = fwd.fwd > 0.15 && Math.abs(fwd.right) < Math.abs(fwd.fwd)*0.5;

const back=await push(key('s'));
console.log('S  ->', JSON.stringify({fwd:+back.fwd.toFixed(2), right:+back.right.toFixed(2)}));
pass.sBack = back.fwd < -0.15;

// --- 2. D goes to the child's right, A to the left ---
const rt=await push(key('d'));
console.log('D  ->', JSON.stringify({fwd:+rt.fwd.toFixed(2), right:+rt.right.toFixed(2)}));
pass.dRight = rt.right > 0.15 && Math.abs(rt.fwd) < Math.abs(rt.right)*0.5;

const lf=await push(key('a'));
console.log('A  ->', JSON.stringify({fwd:+lf.fwd.toFixed(2), right:+lf.right.toFixed(2)}));
pass.aLeft = lf.right < -0.15;

// --- 3. the on-screen stick agrees with the keys ---
// push the knob straight up: the same thing a thumb does when it means "go".
const stickPush=async(dx,dy)=>{
  const r=await p.evaluate(()=>{const e=document.getElementById('stick').getBoundingClientRect();
    return {x:e.left+e.width/2, y:e.top+e.height/2};});
  return async on=>{
    if(on){ await p.mouse.move(r.x,r.y); await p.mouse.down(); await p.mouse.move(r.x+dx,r.y+dy,{steps:4}); }
    else { await p.mouse.up(); }
  };
};
const up=await push(await stickPush(0,-50));
console.log('stick up ->', JSON.stringify({fwd:+up.fwd.toFixed(2), right:+up.right.toFixed(2), moved:+up.moved.toFixed(2)}));
pass.stickUp = up.fwd > 0.15 && Math.abs(up.right) < Math.abs(up.fwd)*0.5;

const stR=await push(await stickPush(50,0));
console.log('stick right ->', JSON.stringify({fwd:+stR.fwd.toFixed(2), right:+stR.right.toFixed(2)}));
pass.stickRight = stR.right > 0.15 && Math.abs(stR.fwd) < Math.abs(stR.right)*0.5;

// the knob must come home when the thumb lifts, or the child keeps drifting
const drift=await p.evaluate(async()=>{const a=window.__sky.state().player;
  await new Promise(r=>setTimeout(r,600)); const c=window.__sky.state().player;
  return Math.hypot(c[0]-a[0], c[2]-a[2]);});
console.log('drift after release =', drift.toFixed(3));
pass.noDrift = drift < 0.2;

// --- 4. the JUMP button works with a mouse, not only a finger ---
const yBefore=await p.evaluate(()=>window.__sky.state().player[1]);
await p.click('#jumpBtn'); await new Promise(r=>setTimeout(r,260));
const yPeak=await p.evaluate(()=>window.__sky.state().player[1]);
console.log('jump button: y '+yBefore.toFixed(2)+' -> '+yPeak.toFixed(2));
pass.jumpBtn = yPeak - yBefore > 0.4;

// --- 5. landscape phone: every control on screen, big enough, not on top of each other ---
// A fresh page sized like a phone, not a resized desktop one: touch emulation only takes
// hold at load, and resizing mid-session made an earlier version of this test lie.
const m=await b.newPage();
await m.setViewport({width:780,height:390,hasTouch:true,isMobile:true});
m.on('pageerror',e=>errs.push('MOBILE PAGEERR '+e.message));
await m.evaluateOnNewDocument(()=>{localStorage.setItem('skyseed_save_v1',JSON.stringify({
  sparks:80,seeds:5,energy:3,skins:[],unlocked:['jump','glide'],biomes:[],pets:[],builds:[]}));});
await m.goto(process.env.TEST_URL,{waitUntil:'domcontentloaded',timeout:60000});
await m.waitForSelector('canvas',{timeout:45000});
await m.click('#startBtn'); await new Promise(r=>setTimeout(r,2500));
const land=await m.evaluate(()=>{
  const ids=['stick','jumpBtn','punchBtn','pauseBtn','journalBtn','wardrobeBtn','buildBtn','careBtn','rideBtn'];
  const out={}; const boxes=[];
  for(const id of ids){
    const e=document.getElementById(id); if(!e) continue;
    const s=getComputedStyle(e); if(s.display==='none') { out[id]='hidden'; continue; }
    const r=e.getBoundingClientRect();
    out[id]={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};
    boxes.push({id,r});
  }
  const onScreen=boxes.filter(b=>b.r.left>=0&&b.r.top>=0&&b.r.right<=innerWidth+1&&b.r.bottom<=innerHeight+1).map(b=>b.id);
  const small=boxes.filter(b=>b.r.width<40||b.r.height<40).map(b=>b.id);
  const overlaps=[];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i].r,c=boxes[j].r;
    if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom) overlaps.push(boxes[i].id+'/'+boxes[j].id);
  }
  return {out,count:boxes.length,offScreen:boxes.map(b=>b.id).filter(x=>!onScreen.includes(x)),small,overlaps};
});
console.log('landscape 780x390:', JSON.stringify(land.out));
console.log('  offScreen=',land.offScreen,' tooSmall=',land.small,' overlaps=',land.overlaps);
pass.landscape = land.count>=8 && land.offScreen.length===0 && land.small.length===0 && land.overlaps.length===0;
await m.screenshot({path:OUT+'shot-landscape.png'});

// nothing may sit on top of the stick — a stray full-screen panel would leave the
// controls visible but deaf, which is exactly what a child would report as "broken"
const cover=await m.evaluate(()=>{
  const s=document.getElementById('stick').getBoundingClientRect();
  const top=document.elementFromPoint(s.left+s.width/2, s.top+s.height/2);
  return {top: top?(top.id||top.tagName):null, touchUI: document.body.classList.contains('touchUI')};
});
console.log('stick reachable:', JSON.stringify(cover));
pass.stickOnTop = cover.top==='stick' && cover.touchUI;

// a child uses a finger, so drive it through the touchscreen
const fingerPush=async(dx,dy)=>{
  const c=await m.evaluate(()=>{const e=document.getElementById('stick').getBoundingClientRect();
    return {x:e.left+e.width/2, y:e.top+e.height/2};});
  return async on=>{
    if(on){ await m.touchscreen.touchStart(c.x,c.y); await m.touchscreen.touchMove(c.x+dx,c.y+dy); }
    else { await m.touchscreen.touchEnd(); }
  };
};
async function mPush(fn){
  await m.evaluate(()=>window.__sky.clearGround());
  await new Promise(r=>setTimeout(r,350));
  const s0=await m.evaluate(()=>window.__sky.state());
  const fx=s0.player[0]-s0.camera[0], fz=s0.player[2]-s0.camera[2], l=Math.hypot(fx,fz)||1;
  const a={fx:fx/l, fz:fz/l};
  await fn(true); await new Promise(r=>setTimeout(r,700)); await fn(false);
  await new Promise(r=>setTimeout(r,120));
  const s1=await m.evaluate(()=>window.__sky.state());
  const dx=s1.player[0]-s0.player[0], dz=s1.player[2]-s0.player[2];
  return {fwd:dx*a.fx+dz*a.fz, right:dx*(-a.fz)+dz*(a.fx), moved:Math.hypot(dx,dz)};
}
const landPush=await mPush(await fingerPush(0,-40));
console.log('landscape finger up ->', JSON.stringify({fwd:+landPush.fwd.toFixed(2), right:+landPush.right.toFixed(2), moved:+landPush.moved.toFixed(2)}));
pass.landscapeStick = landPush.fwd > 0.15 && landPush.fwd > Math.abs(landPush.right);

// and JUMP answers a finger too — the tester said the buttons never responded on a phone
const my0=await m.evaluate(()=>window.__sky.state().player[1]);
const jb=await m.evaluate(()=>{const r=document.getElementById('jumpBtn').getBoundingClientRect();
  return {x:r.left+r.width/2, y:r.top+r.height/2};});
await m.touchscreen.touchStart(jb.x,jb.y); await m.touchscreen.touchEnd();
await new Promise(r=>setTimeout(r,260));
const my1=await m.evaluate(()=>window.__sky.state().player[1]);
console.log('finger JUMP: y '+my0.toFixed(2)+' -> '+my1.toFixed(2));
pass.fingerJump = my1-my0 > 0.4;

console.log('--- errors ---'); errs.slice(0,6).forEach(e=>console.log(e));
console.log('RESULTS', JSON.stringify(pass));
console.log('CONTROLS TEST:', Object.values(pass).every(Boolean)?'PASS':'FAIL');
await b.close();
