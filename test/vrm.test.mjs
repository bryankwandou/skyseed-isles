// Does the compressed VRM still load as a real VRM with a working humanoid rig?
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FILE = process.argv[2] || 'miru.vrm';

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  userDataDir: 'C:/Users/arche/AppData/Local/Temp/claude/e--Download-vericode-ai/bc3f8d82-57b5-4fc2-855d-ee92e70b4040/scratchpad/edge-vrm-' + Date.now(),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader']
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://127.0.0.1:5610/play/', { waitUntil: 'domcontentloaded', timeout: 45000 });

const out = await page.evaluate(async (file) => {
  const { GLTFLoader } = await import('https://unpkg.com/three@0.164.1/examples/jsm/loaders/GLTFLoader.js');
  const { VRMLoaderPlugin } = await import('https://unpkg.com/@pixiv/three-vrm@2.1.3/lib/three-vrm.module.js');
  const loader = new GLTFLoader();
  loader.register(p => new VRMLoaderPlugin(p));
  try {
    const gltf = await loader.loadAsync('assets/' + file);
    const v = gltf.userData.vrm;
    if (!v) return { ok: false, why: 'no vrm in userData (VRM extension lost)' };
    const h = v.humanoid;
    const bones = ['leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg', 'spine', 'head'];
    const found = bones.filter(b => !!(h && h.getNormalizedBoneNode(b)));
    let meshes = 0, tex = 0;
    v.scene.traverse(o => { if (o.isMesh) { meshes++; if (o.material && o.material.map) tex++; } });
    return { ok: found.length === bones.length && meshes > 0, bones: found.length + '/' + bones.length, meshes, texturedMeshes: tex };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}, FILE);

console.log(FILE, '->', JSON.stringify(out));
await browser.close();
