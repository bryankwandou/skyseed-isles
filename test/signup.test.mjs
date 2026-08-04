// Sign-up screen test. This is the first screen twelve children will meet with no adult
// beside them, so it is checked the way a child would use it: no email, one password,
// tap Show to check the typing, and every visible word in Indonesian.
import puppeteer from 'puppeteer-core';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT='C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',defaultViewport:{width:420,height:900},
  userDataDir:OUT+'edge-su-'+Date.now(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader']});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
// the register call is stubbed: this test is about whether a child can complete the form,
// not about the database. What it DOES check is the exact payload that reaches the server.
let sent=null;
await p.setRequestInterception(true);
p.on('request',r=>{
  if(r.url().endsWith('/api/register')){ sent=JSON.parse(r.postData()||'{}');
    return r.respond({status:200,contentType:'application/json',body:JSON.stringify({username:sent.username})}); }
  if(r.url().endsWith('/api/me')) return r.respond({status:401,body:'no'});
  if(r.url().endsWith('/api/google')) return r.respond({status:503,body:'no'});
  r.continue();
});
await p.goto(process.env.TEST_URL+'account.html#signup',{waitUntil:'networkidle2',timeout:60000});
const pass={};

// 1. the sign-up tab is open and email is NOT required
const f=await p.evaluate(()=>({
  tab:document.getElementById('registerForm').classList.contains('on'),
  emailReq:document.getElementById('rg_email').required,
  confirmGone:!document.getElementById('rg_confirm'),
  peek:!!document.getElementById('rg_peek')
}));
console.log('form:',JSON.stringify(f));
pass.form = f.tab && !f.emailReq && f.confirmGone && f.peek;

// 2. every visible word is Indonesian — no English leak on the first screen a child sees
const words=await p.evaluate(()=>document.querySelector('.card').innerText);
// "Email" is the same word in Indonesian, so it is not a leak — only English phrases are.
const leaks=['Sign up','Log in','Password','Username','Show','Create account','Confirm password',
  'only if you have one','At least 8 characters','Back to the game']
  .filter(w=>words.includes(w));
console.log('english leaks:',JSON.stringify(leaks));
pass.lang = leaks.length===0;

// 3. the Show button really reveals the password
await p.type('#rg_pass','langit123');
const t1=await p.evaluate(()=>document.getElementById('rg_pass').type);
await p.click('#rg_peek');
const t2=await p.evaluate(()=>({type:document.getElementById('rg_pass').type,
  label:document.getElementById('rg_peek').innerText.trim(),
  pressed:document.getElementById('rg_peek').getAttribute('aria-pressed')}));
console.log('peek:',t1,'->',JSON.stringify(t2));
pass.peek = t1==='password' && t2.type==='text' && t2.pressed==='true';

// 4. a short password is refused kindly, in Indonesian, and focus goes back to the field
await p.evaluate(()=>{document.getElementById('rg_pass').value='abc';});
await p.type('#rg_user','miru_kecil');
await p.click('#rg_terms'); await p.click('#rg_privacy');
await p.click('#registerForm .primary'); await new Promise(r=>setTimeout(r,300));
const short=await p.evaluate(()=>({msg:document.getElementById('rg_msg').textContent,
  focused:document.activeElement.id}));
console.log('short password:',JSON.stringify(short));
pass.shortPw = /8 karakter/.test(short.msg) && short.focused==='rg_pass' && sent===null;

// 5. a child with NO email can finish, and the server receives a blank email
await p.evaluate(()=>{document.getElementById('rg_pass').value='langitbiru';});
await p.click('#registerForm .primary'); await new Promise(r=>setTimeout(r,600));
console.log('sent to server:',JSON.stringify(sent));
pass.noEmail = !!sent && sent.username==='miru_kecil' && sent.email==='' &&
  sent.password==='langitbiru' && sent.confirm===sent.password &&
  sent.acceptedTerms===true && sent.acceptedPrivacy===true;

// 6. touch targets a child can actually hit
const hit=await p.evaluate(()=>{const r=document.getElementById('rg_peek').getBoundingClientRect();
  const s=document.querySelector('#registerForm .primary').getBoundingClientRect();
  return {peekH:Math.round(r.height),peekW:Math.round(r.width),btnH:Math.round(s.height)};});
console.log('hit targets:',JSON.stringify(hit));
pass.touch = hit.peekH>=40 && hit.peekW>=40 && hit.btnH>=40;

await p.screenshot({path:OUT+'shot-signup.png',fullPage:true});
console.log('--- errors ---'); errs.slice(0,5).forEach(e=>console.log(e));
console.log('RESULTS',JSON.stringify(pass));
console.log('SIGNUP TEST:', Object.values(pass).every(Boolean)?'PASS':'FAIL');
await b.close();
