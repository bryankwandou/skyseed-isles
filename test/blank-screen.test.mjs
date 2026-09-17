// A tablet reported a blank sky: only eyes, shoes and glows drew. Streamed pickups each
// carried a PointLight, and every light is compiled into every lit shader, so the count
// grew until the GPU's uniform budget ran out and the world stopped drawing.
// This pins a small budget like a tablet's, walks so islands stream in, and checks that
// no shader failed, the light count stayed small, and the frame actually has a world in it.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const BROWSER = process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.SHOT_DIR || 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/';
mkdirSync(OUT, { recursive: true });
const MAX_LIGHTS = 4;
const TABLET_UNIFORMS = 221;

const b = await puppeteer.launch({ executablePath: BROWSER, headless: 'new',
  defaultViewport: { width: 1280, height: 640, isMobile: true, hasTouch: true, isLandscape: true },
  userDataDir: OUT + 'edge-blank-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.evaluateOnNewDocument(limit => {
  // report a tablet-sized fragment uniform budget; three.js sizes its shaders from this
  for (const C of [self.WebGLRenderingContext, self.WebGL2RenderingContext]) {
    if (!C) continue;
    const get = C.prototype.getParameter;
    C.prototype.getParameter = function (k) {
      if (k === 0x8DFD) return Math.min(limit, get.call(this, k)); // MAX_FRAGMENT_UNIFORM_VECTORS
      return get.call(this, k);
    };
  }
  localStorage.setItem('skyseed_save_v1', JSON.stringify({ sparks: 40, seeds: 3, energy: 5, unlocked: ['jump'] }));
}, TABLET_UNIFORMS);
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.TEST_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForSelector('canvas', { timeout: 90000 });
await p.waitForFunction(() => window.__sky && document.getElementById('startBtn'), { timeout: 90000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => document.getElementById('startBtn').click());
await new Promise(r => setTimeout(r, 4000));

await p.keyboard.down('KeyW');
await new Promise(r => setTimeout(r, 15000));
await p.keyboard.up('KeyW');
await new Promise(r => setTimeout(r, 2000));

const m = await p.evaluate(() => {
  const g = window.__sky.gfx();
  // sample the frame: a blank sky is nearly one colour, a world is not
  const src = document.querySelector('canvas');
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, 64, 32);
  const d = x.getImageData(0, 0, 64, 32).data;
  let n = 0, sum = 0, sq = 0;
  for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; sum += l; sq += l * l; n++; }
  const mean = sum / n;
  return { pointLights: g.pointLights, shaderErrors: window.__shaderErrors.slice(0, 3),
    lumaStd: +Math.sqrt(sq / n - mean * mean).toFixed(2), notice: !!document.getElementById('gpuNotice') };
});
await p.screenshot({ path: OUT + 'shot-blank-screen.png' });
console.log('RESULTS', JSON.stringify({ ...m, pageErrors: errors.slice(0, 3) }));
const pass = !m.shaderErrors.length && m.pointLights <= MAX_LIGHTS && m.lumaStd > 12 && !m.notice && !errors.length;
console.log('BLANK SCREEN TEST:', pass ? 'PASS' : 'FAIL');
await b.close();
process.exit(pass ? 0 : 1);
