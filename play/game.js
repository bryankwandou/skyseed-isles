import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { t as L, setLang, translateDom } from './i18n.js';

// ---------- basics ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0f5);
scene.fog = new THREE.Fog(0xa8ddf8, 60, 180);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

const sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 200;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x7fbf6a, 0.9);
scene.add(hemi);

// gradient sky dome — richer than a flat colour, and its horizon blends into the fog
const skyUniforms = {
  top: { value: new THREE.Color(0x8fd0f5) },
  bottom: { value: new THREE.Color(0xdfeffb) },
  exponent: { value: 0.9 }
};
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(320, 24, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float exponent; varying vec3 vP;' +
      'void main(){ float h = normalize(vP).y * 0.5 + 0.5; float m = pow(clamp(h,0.0,1.0), exponent); gl_FragColor = vec4(mix(bottom, top, m), 1.0); }'
  })
);
skyDome.renderOrder = -1;
scene.add(skyDome);

// a soft sun disc + glow high in the sky, so there is a warm focal point
const sunSprite = new THREE.Mesh(
  new THREE.CircleGeometry(14, 32),
  new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.9, fog: false, depthWrite: false })
);
const sunGlow = new THREE.Mesh(
  new THREE.CircleGeometry(30, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.28, fog: false, depthWrite: false })
);
sunSprite.renderOrder = -1; sunGlow.renderOrder = -1;
scene.add(sunGlow); scene.add(sunSprite);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- islands ----------
const islands = []; // live island objects near the player

// Biomes ring outward from the origin, so every stretch of exploring shows a
// visibly new kind of land — the core "endless discovery" hook.
const BIOMES = [
  { name: 'Meadow Isles',   grass: 0x6fce4e, tuft: 0x8fe06a, dirt: 0x9a6b4f, leaf: 0xff9ec6, sky: 0x8fd0f5, fog: 0xa8ddf8, root: 220 },
  { name: 'Sunset Grove',   grass: 0xe0a24e, tuft: 0xf3c06a, dirt: 0x8a5540, leaf: 0xff8f6a, sky: 0xf6c98f, fog: 0xf8dcc0, root: 196 },
  { name: 'Snow Isles',     grass: 0xdfeaf2, tuft: 0xffffff, dirt: 0x8fa6b9, leaf: 0xbfe0ff, sky: 0xcfe8ff, fog: 0xe6f4ff, root: 247 },
  { name: 'Starfall Isles', grass: 0x454a7a, tuft: 0x7f88e0, dirt: 0x2a2f45, leaf: 0x9ad0ff, sky: 0x2e3360, fog: 0x3a4070, root: 175 },
  { name: 'Candy Reef',     grass: 0xff9ec6, tuft: 0xffc2dd, dirt: 0xc06a9a, leaf: 0xa06bf0, sky: 0xffd6ef, fog: 0xffe0f2, root: 262 },
  { name: 'Desert Dunes',   grass: 0xe8cf8a, tuft: 0xf3e0a8, dirt: 0xc09a5f, leaf: 0x8fce6a, sky: 0xf8e3b8, fog: 0xf6ead0, root: 208 },
  { name: 'Crystal Caverns',grass: 0x6a5f9a, tuft: 0xa48fe0, dirt: 0x3a3455, leaf: 0x8fd0ff, sky: 0x51487f, fog: 0x655a96, root: 165 },
  { name: 'Autumn Woods',   grass: 0xd08a4e, tuft: 0xe8a860, dirt: 0x7a4a35, leaf: 0xe85f3f, sky: 0xf0c8a0, fog: 0xf3d8bc, root: 233 },
  { name: 'Aurora Peaks',   grass: 0xbfeadf, tuft: 0xdffff2, dirt: 0x6f8fa6, leaf: 0x9affd0, sky: 0x9fe8d8, fog: 0xc8f6ea, root: 294 },
];
function biomeFor(x, z) { return BIOMES[Math.floor(Math.hypot(x, z) / 130) % BIOMES.length]; }

function makeIsland(x, y, z, r, biome, rand) {
  const g = new THREE.Group();
  const grassMat = new THREE.MeshToonMaterial({ color: biome.grass });
  const dirtMat = new THREE.MeshToonMaterial({ color: biome.dirt });
  const tuftMat = new THREE.MeshToonMaterial({ color: biome.tuft });
  const topGeo = new THREE.CylinderGeometry(r, r * 0.92, 1.2, 24);
  const top = new THREE.Mesh(topGeo, grassMat);
  top.position.y = -0.6; top.receiveShadow = true; g.add(top);
  const rockGeo = new THREE.ConeGeometry(r * 0.92, r * 1.6, 10);
  const rock = new THREE.Mesh(rockGeo, dirtMat);
  rock.rotation.x = Math.PI; rock.position.y = -1.2 - r * 0.8; g.add(rock);
  const tuftGeo = new THREE.ConeGeometry(0.16, 0.55, 5);
  const n = Math.floor(r * r * 0.7);
  const inst = new THREE.InstancedMesh(tuftGeo, tuftMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), tuftBase = new THREE.Color(biome.tuft), tuftAlt = new THREE.Color(biome.grass);
  const tc = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (r - 0.6);
    // varied height, a slight lean, and random spin so the grass never looks stamped
    const hs = 0.7 + rand() * 0.9, lean = (rand() - 0.5) * 0.5;
    q.setFromAxisAngle(up, rand() * Math.PI);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), lean);
    q.multiply(tilt);
    scl.set(0.75 + rand() * 0.6, hs, 0.75 + rand() * 0.6);
    pos.set(Math.cos(a) * d, 0.1 + hs * 0.14, Math.sin(a) * d);
    m.compose(pos, q, scl);
    inst.setMatrixAt(i, m);
    // blend each blade between tuft and grass tone for a mottled, natural field
    tc.copy(tuftBase).lerp(tuftAlt, rand() * 0.55).multiplyScalar(0.9 + rand() * 0.2);
    inst.setColorAt(i, tc);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);
  g.position.set(x, y, z);
  scene.add(g);
  const isl = { x, z, y, r, group: g, biome, collect: [], slimes: [] };
  islands.push(isl);
  return isl;
}

// decorations are children of the island group (local coords) so despawning
// an island is a single scene.remove + dispose walk.
function makePillar(isl, ox, oz, h) {
  const mat = new THREE.MeshToonMaterial({ color: 0xb9c4cf });
  const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), mat);
  p.position.set(ox, h / 2, oz); p.castShadow = true; p.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.9), mat);
  cap.position.set(ox, h + 0.25, oz); cap.castShadow = true;
  isl.group.add(p, cap);
}

function makeTree(isl, ox, oz) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
    new THREE.MeshToonMaterial({ color: 0x8a5a3b }));
  trunk.position.set(ox, 1.1, oz); trunk.castShadow = true;
  // rounder, fuller canopy from two overlapping blobs instead of one faceted ball
  const lm = new THREE.MeshToonMaterial({ color: isl.biome.leaf });
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), lm);
  leaf.position.set(ox, 3.1, oz); leaf.castShadow = true;
  const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1),
    new THREE.MeshToonMaterial({ color: new THREE.Color(isl.biome.leaf).multiplyScalar(0.88) }));
  leaf2.position.set(ox + 0.6, 3.6, oz - 0.4); leaf2.castShadow = true;
  isl.group.add(trunk, leaf, leaf2);
}

// waterfall ribbon under a group child (local coords)
const fallMat = new THREE.MeshBasicMaterial({ color: 0xcdefff, transparent: true, opacity: 0.45 });
function makeFall(isl, ox, oz) {
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 14, 10, 1, true), fallMat);
  f.position.set(ox, -7, oz);
  isl.group.add(f);
}

const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff });
const clouds = [];
for (let i = 0; i < 14; i++) {
  const c = new THREE.Group();
  for (let j = 0; j < 4; j++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random(), 10, 8), cloudMat);
    b.position.set(j * 1.4 - 2, Math.random() * 0.5, Math.random() * 1.2);
    c.add(b);
  }
  c.position.set((Math.random() - 0.5) * 160, 14 + Math.random() * 18, (Math.random() - 0.5) * 160);
  c.userData.v = 0.4 + Math.random() * 0.8;
  scene.add(c); clouds.push(c);
}

// ---------- character: Miru ----------
const skin = new THREE.MeshToonMaterial({ color: 0xffe3cf });
const hairM = new THREE.MeshToonMaterial({ color: 0xb9a3ff });
const dressM = new THREE.MeshToonMaterial({ color: 0xffffff });
const dressTrim = new THREE.MeshToonMaterial({ color: 0x7fd4f7 });

const player = new THREE.Group();
const body = new THREE.Group();
player.add(body);

const dress = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 14), dressM);
dress.position.y = 0.75; dress.castShadow = true; body.add(dress);
const trim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 8, 20), dressTrim);
trim.rotation.x = Math.PI / 2; trim.position.y = 0.28; body.add(trim);
const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), dressTrim);
chest.position.y = 1.28; chest.castShadow = true; body.add(chest);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), skin);
head.position.y = 1.95; head.castShadow = true; body.add(head);
const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 12), hairM);
hairBack.position.set(0, 2.02, -0.08); hairBack.scale.set(1, 1, 0.95); body.add(hairBack);
const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), hairM);
bangs.position.set(0, 2.05, 0.02); body.add(bangs);
const tails = [];
[-1, 1].forEach(s => {
  const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.9, 4, 8), hairM);
  tl.position.set(0.42 * s, 1.55, -0.15);
  tl.rotation.z = 0.35 * s;
  body.add(tl); tails.push(tl);
});
[-1, 1].forEach(s => {
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x2a2f45 }));
  e.position.set(0.16 * s, 1.98, 0.37); body.add(e);
});
const arms = [];
[-1, 1].forEach(s => {
  const pivot = new THREE.Group();
  pivot.position.set(0.4 * s, 1.35, 0);
  const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), skin);
  a.position.y = -0.28;
  a.castShadow = true;
  pivot.add(a);
  pivot.rotation.z = 0.35 * s;
  body.add(pivot); arms.push(pivot);
});
const crown = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 16),
  new THREE.MeshToonMaterial({ color: 0xffc2dd }));
crown.rotation.x = Math.PI / 2.4; crown.position.y = 2.38; body.add(crown);

player.position.set(0, 0, 3);
scene.add(player);

// ---------- VRM anime avatar (replaces the primitive Miru once loaded) ----------
let vrm = null, vrmBones = null;
{
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  loader.load('assets/miru.vrm', gltf => {
    const v = gltf.userData.vrm;
    if (!v) return;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.removeUnnecessaryJoints(gltf.scene);
    VRMUtils.rotateVRM0(v);
    v.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    body.clear();
    body.add(v.scene);
    v.scene.scale.setScalar(1.55);
    vrm = v;
    const h = v.humanoid;
    vrmBones = {
      lArm: h.getNormalizedBoneNode('leftUpperArm'),
      rArm: h.getNormalizedBoneNode('rightUpperArm'),
      lLeg: h.getNormalizedBoneNode('leftUpperLeg'),
      rLeg: h.getNormalizedBoneNode('rightUpperLeg'),
      spine: h.getNormalizedBoneNode('spine'),
      hips: h.getNormalizedBoneNode('hips'),
      neck: h.getNormalizedBoneNode('neck'),
      head: h.getNormalizedBoneNode('head')
    };
    if (vrmBones.lArm) vrmBones.lArm.rotation.z = 1.15;
    if (vrmBones.rArm) vrmBones.rArm.rotation.z = -1.15;
    const lb = $('loadBar'); if (lb) lb.parentElement.style.display = 'none';
    applyWardrobe(); // re-attach outfit to the real bones
    say(L('Miru has arrived!'));
  }, xhr => {
    // loading progress bar on the title screen while the avatar streams in
    const lb = $('loadBar');
    if (lb && xhr.total) lb.style.width = Math.min(100, Math.round(xhr.loaded / xhr.total * 100)) + '%';
  }, err => {
    const lb = $('loadBar'); if (lb) lb.parentElement.style.display = 'none';
    console.warn('VRM load failed, keeping placeholder', err);
  });
}

// ---------- slimes (boppable, harmless) ----------
const slimes = [];
const slimeColors = [0x7fe8c9, 0xffd98a, 0xff9ec6, 0xa0c8ff];
function makeSlime(isl, ox, oz, rand) {
  const g = new THREE.Group();
  const rv = rand ? rand() : Math.random();
  const shiny = rv < 0.06; // rare golden slime for the Journal
  const col = shiny ? 0xfff2c8 : slimeColors[Math.floor(rv * slimeColors.length)];
  const blob = new THREE.Mesh(new THREE.SphereGeometry(shiny ? 0.62 : 0.55, 14, 12),
    new THREE.MeshToonMaterial({ color: col }));
  blob.scale.y = 0.8; blob.castShadow = true; g.add(blob);
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x2a2f45 }));
    e.position.set(0.18 * s, 0.18, 0.45); g.add(e);
  });
  g.position.set(isl.x + ox, isl.y + 0.45, isl.z + oz);
  scene.add(g);
  const s = {
    g, blob, isl, alive: true, respawn: 0, shiny,
    home: new THREE.Vector3(isl.x + ox, isl.y + 0.45, isl.z + oz),
    dir: Math.random() * Math.PI * 2, turn: 0, phase: Math.random() * 6
  };
  slimes.push(s);
  isl.slimes.push(s);
  return s;
}

// ---------- collectibles ----------
const $ = id => document.getElementById(id);
const collect = [];
const seedMat = new THREE.MeshBasicMaterial({ color: 0xfff08a });
const starMat = new THREE.MeshBasicMaterial({ color: 0xffd6f2 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x8af0d8 });
seedMat.userData.shared = starMat.userData.shared = ringMat.userData.shared = true;

// sparks are worth: seed 1, ring 2, star 3 — the single currency that drives unlocks
// soft radial glow texture, built once, reused for every collectible halo (bloom-lite)
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function glowSprite(color, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0.85, fog: false
  }));
  sp.scale.setScalar(size);
  return sp;
}
function addSeed(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), seedMat);
  s.position.set(isl.x + ox, isl.y + 1, isl.z + oz);
  s.add(new THREE.PointLight(0xffe98a, 0.6, 4));
  s.add(glowSprite(0xffe08a, 1.6));
  scene.add(s);
  const c = { mesh: s, kind: 'seed', r: 1.1, worth: 1 };
  collect.push(c); isl.collect.push(c);
}
function addStar(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4), starMat);
  s.position.set(isl.x + ox, isl.y + 1.2, isl.z + oz);
  s.add(glowSprite(0xfff2a0, 1.9));
  scene.add(s);
  const c = { mesh: s, kind: 'star', r: 1.2, worth: 3 };
  collect.push(c); isl.collect.push(c);
}
function addRing(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 10, 28), ringMat);
  s.position.set(isl.x + ox, isl.y + 2.2, isl.z + oz);
  s.add(glowSprite(0x9ad8ff, 2.6));
  scene.add(s);
  const c = { mesh: s, kind: 'ring', r: 1.4, worth: 2 };
  collect.push(c); isl.collect.push(c);
}
const petalMat = new THREE.MeshBasicMaterial({ color: 0xd8b8ff });
petalMat.userData.shared = true;
function addMoonpetal(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), petalMat);
  s.position.set(isl.x + ox, isl.y + 1.3, isl.z + oz);
  s.add(new THREE.PointLight(0xd8b8ff, 0.9, 6));
  s.add(glowSprite(0xe6c8ff, 2.2));
  scene.add(s);
  const c = { mesh: s, kind: 'petal', r: 1.2, worth: 5 };
  collect.push(c); isl.collect.push(c);
}

// bops now lives in progress.bops (persisted)

let msgTimer, lastSayAt = -1e9;
function say(text) {
  const el = $('msg');
  el.textContent = text; el.classList.add('show');
  lastSayAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

const bursts = [];
function burst(pos, color, count = 20) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3), velArr = [];
  for (let i = 0; i < count; i++) {
    arr.set([pos.x, pos.y, pos.z], i * 3);
    velArr.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 6, (Math.random() - 0.5) * 6));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.22, transparent: true }));
  scene.add(pts);
  bursts.push({ pts, vel: velArr, life: 0.8 });
}

// ---------- settings (persisted) ----------
const SETTINGS_KEY = 'skyseed_settings_v1';
const settings = Object.assign({
  music: 0.5, sfx: 0.8, quality: 'high', sensitivity: 1, invert: false,
  contrast: false, bigText: false, lang: 'id', tut: {}
}, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })());
setLang(settings.lang);
translateDom();
document.documentElement.lang = settings.lang;
function applyA11y() {
  document.body.classList.toggle('hiContrast', !!settings.contrast);
  document.body.classList.toggle('bigText', !!settings.bigText);
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* blocked */ } }
function applyQuality() {
  const low = settings.quality === 'low';
  renderer.shadowMap.enabled = !low;
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 2));
  scene.fog.far = low ? 120 : 180;
  sun.castShadow = !low;
}

// ---------- audio: sfx + generative ambient music ----------
let ac, musicBus, sfxBus, musicTimer = null, curScale = null;
function ensureAudio() {
  if (ac) return true;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    musicBus = ac.createGain(); musicBus.gain.value = settings.music * 0.16; musicBus.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(ac.destination);
    return true;
  } catch (e) { return false; }
}
function setVolumes() {
  if (musicBus) musicBus.gain.value = settings.music * 0.16;
  if (sfxBus) sfxBus.gain.value = settings.sfx;
}
function chime(freq) {
  if (!ensureAudio()) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = freq; o.type = 'sine';
  g.gain.setValueAtTime(0.15, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
  o.connect(g).connect(sfxBus);
  o.start(); o.stop(ac.currentTime + 0.4);
}
function thud(freq, dur) { // soft filtered noise for steps/landings
  if (!ensureAudio()) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = 0.22;
  src.connect(f).connect(g).connect(sfxBus);
  src.start();
}
// gentle pad: two-note chord from a pentatonic scale rooted per biome, new note every ~2.4s
function musicTick() {
  if (!ac || settings.music <= 0.01) return;
  const root = (biomeFor(player.position.x, player.position.z).root || 220);
  const penta = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
  for (let k = 0; k < 2; k++) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = k ? 'triangle' : 'sine';
    o.frequency.value = root * penta[Math.floor(Math.random() * penta.length)] * (k ? 0.5 : 1);
    const t0 = ac.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.8);
    g.gain.linearRampToValueAtTime(0, t0 + 3.4);
    o.connect(g).connect(musicBus);
    o.start(t0); o.stop(t0 + 3.5);
  }
}
function startMusic() {
  if (!ensureAudio() || musicTimer) return;
  musicTick();
  musicTimer = setInterval(musicTick, 2400);
}

// ---------- progression: sparks -> unlocks, saved to localStorage ----------
// movement + ability state (mutated as unlocks are earned)
let WALK = 7, SPRINT = 11, JUMP = 9.5, GRAV = -22, MAXJUMPS = 2, GLIDE = -3.5, MAGNET = 0, hasTrail = false;

const UNLOCKS = [
  { id: 'jump',   at: 8,   name: 'Springy Boots', msg: 'Springy Boots unlocked — you jump higher now!',        apply() { JUMP = 11.2; } },
  { id: 'glide',  at: 18,  name: 'Feather Glide',  msg: 'Feather Glide — hold jump while falling to float!',    apply() { GLIDE = -2.1; } },
  { id: 'triple', at: 32,  name: 'Triple Hop',     msg: 'Triple Hop — tap jump three times in the air!',        apply() { MAXJUMPS = 3; } },
  { id: 'magnet', at: 50,  name: 'Spark Magnet',   msg: 'Spark Magnet — sparks drift toward you now!',          apply() { MAGNET = 1.8; } },
  { id: 'speed',  at: 72,  name: 'Wind Runner',    msg: 'Wind Runner — hold Shift to dash even faster!',        apply() { SPRINT = 14.5; } },
  { id: 'trail',  at: 100, name: 'Sparkle Trail',  msg: 'Sparkle Trail — you leave stardust when you run!',      apply() { hasTrail = true; } },
  { id: 'float',  at: 140, name: 'Cloud Steps',    msg: 'Cloud Steps — jumps feel floatier and higher!',        apply() { GRAV = -18; JUMP = 12.2; } },
];

const SAVE_KEY = 'skyseed_save_v1';
let progress = { sparks: 0, unlocked: [], biomes: [], treasures: 0, shinies: 0, bops: 0, wonders: [], quest: { i: 0, base: null }, wardrobe: { hat: 'none', cape: 'none', outfit: 'dress' }, berries: 0 };
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) progress = Object.assign(progress, JSON.parse(raw)); } catch (e) { /* storage blocked */ }
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked */ }
  syncServer();
}

function nextUnlock() { return UNLOCKS.find(u => !progress.unlocked.includes(u.id)); }
function refreshGoal() {
  const nu = nextUnlock();
  const spEl = $('cSpark'); if (spEl) spEl.textContent = progress.sparks;
  const bopEl = $('cBop'); if (bopEl) bopEl.textContent = progress.bops || 0;
  const gEl = $('nextGoal'), inEl = $('nextIn');
  if (nu) { if (gEl) gEl.textContent = L(nu.name); if (inEl) inEl.textContent = Math.max(0, nu.at - progress.sparks); }
  else { if (gEl) gEl.textContent = L('Sky Explorer'); if (inEl) inEl.textContent = '∞'; }
}
function applyUnlock(u, announce) {
  u.apply();
  if (!progress.unlocked.includes(u.id)) progress.unlocked.push(u.id);
  if (announce) {
    say(L(u.msg)); chime(1180);
    burst(player.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 0xfff2a0, 30);
  }
}
// re-apply everything already earned in a past session (silent)
for (const u of UNLOCKS) if (progress.unlocked.includes(u.id)) applyUnlock(u, false);

function addSparks(n) {
  progress.sparks += n;
  let nu = nextUnlock();
  while (nu && progress.sparks >= nu.at) { applyUnlock(nu, true); nu = nextUnlock(); }
  refreshGoal();
  saveProgress();
  grantPetXp(n); // sparks also feed your buddies so they grow
}

// ---------- endless world: procedural island chunks ----------
const CELL = 44, GEN_R = 3, KEEP_R = 4;
const cells = new Map(); // "cx,cz" -> [island,...]

function hash2(a, b) {
  let h = ((a | 0) * 374761393 + (b | 0) * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function decorate(isl, rand) {
  const r = isl.r;
  const spot = () => { const a = rand() * 6.283, d = rand() * (r - 1.6); return [Math.cos(a) * d, Math.sin(a) * d]; };
  if (rand() < 0.7) { const [x, z] = spot(); makeTree(isl, x, z); }
  if (rand() < 0.4) { const [x, z] = spot(); makeTree(isl, x, z); }
  if (rand() < 0.5) { const [x, z] = spot(); makePillar(isl, x, z, 2 + rand() * 3); }
  if (rand() < 0.35) { const [x, z] = spot(); makeFall(isl, x, z); }
  const seeds = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < seeds; i++) { const [x, z] = spot(); addSeed(isl, x, z); }
  if (rand() < 0.5) { const [x, z] = spot(); addRing(isl, x, z); }
  if (rand() < 0.28) { const [x, z] = spot(); addStar(isl, x, z); }
  if (rand() < 0.08) { const [x, z] = spot(); addMoonpetal(isl, x, z); } // rare treasure
  const ns = rand() < 0.6 ? 1 : (rand() < 0.5 ? 0 : 2);
  for (let i = 0; i < ns; i++) { const [x, z] = spot(); makeSlime(isl, x, z, rand); }
}

// landmark "Great Tree" wonder island: huge tree, guaranteed rewards
function makeWonder(isl, rand) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 9, 12),
    new THREE.MeshToonMaterial({ color: 0x7a4a30 }));
  trunk.position.set(0, 4.5, 0); trunk.castShadow = true;
  isl.group.add(trunk);
  // a full, rounded canopy built from many smooth overlapping blobs (not one faceted ball)
  const leafMat = new THREE.MeshToonMaterial({ color: isl.biome.leaf });
  const leafMat2 = new THREE.MeshToonMaterial({ color: new THREE.Color(isl.biome.leaf).multiplyScalar(0.86) });
  const blobs = [
    [0, 9.4, 0, 2.7], [1.7, 8.6, 0.6, 2.0], [-1.6, 8.7, -0.5, 2.1],
    [0.5, 8.4, 1.7, 1.9], [-0.6, 8.5, -1.7, 1.9], [0, 10.6, 0, 1.9],
    [1.3, 10.0, -1.2, 1.6], [-1.3, 9.9, 1.2, 1.6]
  ];
  for (let i = 0; i < blobs.length; i++) {
    const [x, y, z, r] = blobs[i];
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), i % 2 ? leafMat2 : leafMat);
    leaf.position.set(x, y, z); leaf.castShadow = true;
    isl.group.add(leaf);
  }
  addMoonpetal(isl, 0, 2.4);
  addStar(isl, -2.2, 0);
  addSeed(isl, 2.2, 1); addSeed(isl, -1.5, -2);
  isl.wonder = true;
}

function generateCell(cx, cz) {
  const key = cx + ',' + cz;
  if (cells.has(key)) return;
  const list = []; cells.set(key, list);
  const rand = makeRng(hash2(cx, cz));
  if (cx === 0 && cz === 0) {
    const home = makeIsland(0, 0, 0, 10, BIOMES[0], rand);
    decorate(home, rand);
    list.push(home);
    return;
  }
  // roughly 1 in 23 cells hosts a Great Tree wonder island
  const isWonder = hash2(cx * 7 + 3, cz * 11 - 5) % 23 === 0;
  const count = isWonder ? 1 : (rand() < 0.68 ? 1 : (rand() < 0.55 ? 0 : 2));
  for (let i = 0; i < count; i++) {
    const x = cx * CELL + (rand() - 0.5) * CELL * 0.6;
    const z = cz * CELL + (rand() - 0.5) * CELL * 0.6;
    const y = (rand() - 0.5) * 9;
    const r = isWonder ? 9 + rand() * 2 : 4 + rand() * 5;
    const isl = makeIsland(x, y, z, r, biomeFor(x, z), rand);
    if (isWonder && i === 0) { makeWonder(isl, rand); isl.key = cx + ',' + cz; }
    decorate(isl, rand);
    list.push(isl);
  }
}

function despawnIsland(isl) {
  scene.remove(isl.group);
  isl.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m.userData.shared) m.dispose(); }); }
  });
  for (const c of isl.collect) {
    scene.remove(c.mesh);
    if (c.mesh.geometry) c.mesh.geometry.dispose();
    const gi = collect.indexOf(c); if (gi >= 0) collect.splice(gi, 1);
  }
  for (const s of isl.slimes) {
    scene.remove(s.g);
    s.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
    const gi = slimes.indexOf(s); if (gi >= 0) slimes.splice(gi, 1);
  }
  const ii = islands.indexOf(isl); if (ii >= 0) islands.splice(ii, 1);
}

let lastCX = 1e9, lastCZ = 1e9;
function ensureChunks(px, pz) {
  const ccx = Math.round(px / CELL), ccz = Math.round(pz / CELL);
  if (ccx === lastCX && ccz === lastCZ) return;
  lastCX = ccx; lastCZ = ccz;
  for (let dz = -GEN_R; dz <= GEN_R; dz++)
    for (let dx = -GEN_R; dx <= GEN_R; dx++)
      generateCell(ccx + dx, ccz + dz);
  for (const [key, list] of cells) {
    const [kx, kz] = key.split(',').map(Number);
    if (Math.abs(kx - ccx) > KEEP_R || Math.abs(kz - ccz) > KEEP_R) {
      for (const isl of list) despawnIsland(isl);
      cells.delete(key);
    }
  }
}

// biome discovery: announce the first time the player sets foot in a new region
let curBiome = BIOMES[0].name;
function checkBiome(x, z) {
  const b = biomeFor(x, z);
  if (b.name === curBiome) return;
  curBiome = b.name;
  if (!progress.biomes.includes(b.name)) {
    progress.biomes.push(b.name);
    say(L('You reached the {biome}!', { biome: b.name }));
    chime(900); saveProgress();
  }
}

// build the starting area now so there is ground under Miru at spawn
ensureChunks(0, 0);
refreshGoal();

// ---------- buddies: befriend slimes, they follow you and grow ----------
const pets = [];
const trail = []; // breadcrumb of recent player positions (conga line)
const PET_NAMES = ['Boba', 'Mochi', 'Pudding', 'Kiwi', 'Pixel', 'Sunny', 'Cloud', 'Berry', 'Nori', 'Taro'];

function heartBurst(pos) { burst(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xff8fc0, 14); }

function makePet(color, level, name, happy) {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), new THREE.MeshToonMaterial({ color }));
  blob.scale.y = 0.82; blob.castShadow = true; g.add(blob);
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), new THREE.MeshBasicMaterial({ color: 0x2a2f45 }));
    e.position.set(0.16 * s, 0.16, 0.42); g.add(e);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb0cf }));
    ch.position.set(0.3 * s, 0.0, 0.36); g.add(ch);
  });
  g.position.copy(player.position);
  scene.add(g);
  const pet = { g, blob, color, level: level || 1, xp: 0, happy: (typeof happy === 'number' ? happy : 60), name: name || PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)], phase: Math.random() * 6 };
  pets.push(pet);
  if (pet.level >= 8) addWings(pet); // a fully-raised buddy keeps its wings between sessions
  return pet;
}

function updateBuddyHud() {
  const el = $('cBuddy');
  if (el) el.textContent = pets.length ? L('{n} friends', { n: pets.length }) : L('none yet');
}
function savePets() { progress.pets = pets.map(p => ({ level: p.level, color: p.color, name: p.name, happy: Math.round(p.happy) })); saveProgress(); }

function befriend(slime) {
  let gi = slimes.indexOf(slime); if (gi >= 0) slimes.splice(gi, 1);
  gi = slime.isl.slimes.indexOf(slime); if (gi >= 0) slime.isl.slimes.splice(gi, 1);
  const color = slime.blob.material.color.getHex();
  scene.remove(slime.g);
  slime.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
  const pet = makePet(color, 1);
  heartBurst(pet.g.position); chime(1240);
  if (slime.shiny) {
    progress.shinies = (progress.shinies || 0) + 1;
    say(L('A SHINY slime! {name} joins you — journal updated!', { name: pet.name }));
  } else {
    say(L('{name} is your friend now!', { name: pet.name }));
  }
  savePets(); updateBuddyHud();
}

// A buddy you have cared for grows wings at max level — the payoff for petting.
function addWings(pet) {
  if (pet.wings) return;
  const w = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  [-1, 1].forEach(s => {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12, 0, Math.PI), mat);
    wing.position.set(0.34 * s, 0.28, -0.16);
    wing.rotation.set(-0.35, s * 0.9, 0);
    w.add(wing);
  });
  pet.g.add(w);
  pet.wings = w;
}

function grantPetXp(n) {
  if (!pets.length) return;
  for (const p of pets) {
    p.xp += n;
    const need = p.level * 8;
    if (p.xp >= need && p.level < 8) {
      p.xp -= need; p.level++; heartBurst(p.g.position); chime(1320);
      if (p.level === RIDE_LEVEL) say(L('{name} is big enough to ride now! Press R next to them.', { name: p.name }));
      else if (p.level === 8) { addWings(p); say(L('{name} grew WINGS! Ride them and hold Space to fly!', { name: p.name })); burst(p.g.position, 0xffffff, 30); }
      else say(L('{name} grew to Lv {lv}!', { name: p.name, lv: p.level }));
    }
  }
  savePets(); updateBuddyHud();
}

// ---------- riding: your buddy becomes your mount ----------
const RIDE_LEVEL = 4;
let riding = null, rideLift = 0;

function nearestPet(maxDist) {
  let best = null, bd = maxDist;
  for (const p of pets) {
    const d = Math.hypot(p.g.position.x - player.position.x, p.g.position.z - player.position.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function toggleRide() {
  if (riding) {
    say(L('You hop off {name}.', { name: riding.name }));
    riding = null; chime(520);
    return;
  }
  if (!pets.length) { say(L('Make a slime friend first — walk up to one!')); return; }
  const p = nearestPet(4);
  if (!p) { say(L('Stand closer to a buddy to ride them.')); return; }
  if (p.level < RIDE_LEVEL) {
    say(L('{name} is still small — pet them to Lv {need} to ride! (Lv {lv} now)', { name: p.name, need: RIDE_LEVEL, lv: p.level }));
    chime(300); return;
  }
  riding = p;
  p.careBounce = 1;
  heartBurst(p.g.position); chime(1180);
  burst(p.g.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xfff2a0, 22);
  // one clear message rather than a tip that instantly overwrites the exciting one
  const firstRide = !settings.tut.ride;
  if (firstRide) { settings.tut.ride = true; saveSettings(); }
  say(L('You are riding {name}!', { name: p.name })
    + (p.wings ? L(' Hold Space to FLY!') : '')
    + (firstRide ? L(' (press R to hop off)') : ''));
}
const rideBtn = $('rideBtn');
if (rideBtn) rideBtn.addEventListener('click', toggleRide);

// bring back buddies made in a past session
if (Array.isArray(progress.pets)) for (const p of progress.pets) makePet(p.color, p.level, p.name, p.happy);
updateBuddyHud();

// ---------- build mode: place & decorate your islands, saved forever ----------
let buildMode = false, buildType = 'tree';
const buildMeshes = [];

function makeBuildMesh(type) {
  const g = new THREE.Group();
  if (type === 'tree') {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7), new THREE.MeshToonMaterial({ color: 0x8a5a3b }));
    tr.position.y = 0.7; tr.castShadow = true; g.add(tr);
    const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshToonMaterial({ color: 0x74c96a }));
    lf.position.y = 1.7; lf.castShadow = true; g.add(lf);
  } else if (type === 'flower') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), new THREE.MeshToonMaterial({ color: 0x5fae4e }));
    st.position.y = 0.35; g.add(st);
    const petals = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.1, 6, 10), new THREE.MeshToonMaterial({ color: 0xff8fc0 }));
    petals.position.y = 0.72; petals.rotation.x = Math.PI / 2; g.add(petals);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshToonMaterial({ color: 0xffe08a }));
    mid.position.y = 0.72; g.add(mid);
  } else if (type === 'mushroom') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 7), new THREE.MeshToonMaterial({ color: 0xf3ead0 }));
    st.position.y = 0.25; g.add(st);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8, 0, 6.283, 0, 1.7), new THREE.MeshToonMaterial({ color: 0xe8564f }));
    cap.position.y = 0.5; cap.castShadow = true; g.add(cap);
  } else if (type === 'lantern') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), new THREE.MeshToonMaterial({ color: 0x6a5540 }));
    post.position.y = 0.55; g.add(post);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    glow.position.y = 1.15; g.add(glow);
    glow.add(new THREE.PointLight(0xffcf7a, 0.7, 6));
  } else if (type === 'crystal') {
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshToonMaterial({ color: 0x8fd0ff }));
    cr.position.y = 0.55; cr.castShadow = true; g.add(cr);
    cr.add(new THREE.PointLight(0x8fd0ff, 0.5, 5));
  } else if (type === 'fence') {
    const rail = new THREE.MeshToonMaterial({ color: 0xb98a5a });
    [-0.45, 0.45].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), rail); p.position.set(x, 0.4, 0); p.castShadow = true; g.add(p); });
    [0.28, 0.55].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.08), rail); b.position.set(0, y, 0); g.add(b); });
  } else if (type === 'bench') {
    const wood = new THREE.MeshToonMaterial({ color: 0xc98f5a });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.45), wood); seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.1), wood); back.position.set(0, 0.7, -0.18); g.add(back);
    [-0.5, 0.5].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), wood); l.position.set(x, 0.22, 0); g.add(l); });
  } else if (type === 'arch') {
    const stone = new THREE.MeshToonMaterial({ color: 0xd8c8e8 });
    [-0.7, 0.7].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.8, 8), stone); p.position.set(x, 0.9, 0); p.castShadow = true; g.add(p); });
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.16, 8, 16, Math.PI), stone); top.position.y = 1.8; top.castShadow = true; g.add(top);
  } else { // path
    const stone = new THREE.MeshToonMaterial({ color: 0xbfc6cf });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 7), stone);
      s.position.set((i - 1) * 0.5, 0.04, 0); g.add(s);
    }
  }
  return g;
}

function spawnBuild(b) {
  const g = makeBuildMesh(b.type);
  g.position.set(b.x, b.y, b.z);
  if (b.rot) g.rotation.y = b.rot;
  scene.add(g);
  buildMeshes.push(g);
}

let buildRot = 0; // current placement rotation, cycled with R

function targetBuildPoint() {
  const fwd = new THREE.Vector3(Math.sin(body.rotation.y), 0, Math.cos(body.rotation.y));
  const p = player.position.clone().addScaledVector(fwd, 2.6);
  const gh = groundHeight(p.x, p.z);
  if (gh === -Infinity) return null;
  p.y = gh; return p;
}

const ghost = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 20),
  new THREE.MeshBasicMaterial({ color: 0x7cff9b, transparent: true, opacity: 0.85 }));
ghost.rotation.x = Math.PI / 2; ghost.visible = false; scene.add(ghost);

function placeBuild() {
  const tp = targetBuildPoint();
  if (!tp) { say(L('Face an island to build there.')); return; }
  const b = { x: +tp.x.toFixed(2), y: +tp.y.toFixed(2), z: +tp.z.toFixed(2), type: buildType, rot: +buildRot.toFixed(3) };
  spawnBuild(b);
  if (!Array.isArray(progress.builds)) progress.builds = [];
  progress.builds.push(b); saveProgress();
  burst(tp.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xbfffcf, 12);
  chime(700);
}

function undoBuild() {
  if (!Array.isArray(progress.builds) || !progress.builds.length) { say(L('Nothing to undo yet.')); return; }
  progress.builds.pop(); saveProgress();
  const g = buildMeshes.pop();
  if (g) { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); }); }
  chime(360);
}

function setBuildType(t) {
  buildType = t;
  document.querySelectorAll('#palette [data-t]').forEach(btn => btn.classList.toggle('sel', btn.dataset.t === t));
}

function toggleBuild(on) {
  buildMode = on === undefined ? !buildMode : on;
  $('buildBtn').classList.toggle('on', buildMode);
  $('palette').classList.toggle('on', buildMode);
  if (!buildMode) ghost.visible = false;
  say(buildMode ? L('Build mode on — face a spot and tap Place!') : L('Back to playing!'));
}

// wire the build controls
$('buildBtn').addEventListener('click', () => toggleBuild());
$('placeBtn').addEventListener('click', placeBuild);
$('undoBtn').addEventListener('click', undoBuild);
document.querySelectorAll('#palette [data-t]').forEach(btn =>
  btn.addEventListener('click', () => setBuildType(btn.dataset.t)));
addEventListener('keydown', e => {
  if (e.code === 'KeyB') toggleBuild();
  if (!buildMode) return;
  if (e.code === 'KeyU') undoBuild();
  if (e.code === 'KeyR') { buildRot = (buildRot + Math.PI / 8) % (Math.PI * 2); ghost.rotation.z = -buildRot; chime(600); }
  const n = { Digit1: 'tree', Digit2: 'flower', Digit3: 'mushroom', Digit4: 'lantern', Digit5: 'crystal',
              Digit6: 'fence', Digit7: 'bench', Digit8: 'arch', Digit9: 'path' }[e.code];
  if (n) setBuildType(n);
});
const rotateBtn = $('rotateBtn');
if (rotateBtn) rotateBtn.addEventListener('click', () => { buildRot = (buildRot + Math.PI / 8) % (Math.PI * 2); ghost.rotation.z = -buildRot; chime(600); });

// restore everything the child built in a past session
if (Array.isArray(progress.builds)) for (const b of progress.builds) spawnBuild(b);

// ---------- account sync: load & save progress to the server when logged in ----------
let serverUser = null, syncTimer = null;

function clearPets() {
  for (const p of pets) { scene.remove(p.g); p.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  pets.length = 0;
}
function clearBuilds() {
  for (const g of buildMeshes) { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  buildMeshes.length = 0;
}

function applyServerProgress(p) {
  if (!p || typeof p !== 'object') return;
  progress = Object.assign({ sparks: 0, unlocked: [], biomes: [], pets: [], builds: [], treasures: 0, shinies: 0, bops: 0, wonders: [], quest: { i: 0, base: null }, wardrobe: { hat: 'none', cape: 'none', outfit: 'dress' }, berries: 0 }, p);
  for (const u of UNLOCKS) if (progress.unlocked.includes(u.id)) applyUnlock(u, false);
  clearPets(); if (Array.isArray(progress.pets)) for (const pet of progress.pets) makePet(pet.color, pet.level, pet.name, pet.happy);
  clearBuilds(); if (Array.isArray(progress.builds)) for (const b of progress.builds) spawnBuild(b);
  applyWardrobe();
  refreshGoal(); updateBuddyHud();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked */ }
}

function syncServer() {
  if (!serverUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress }) })
      .then(r => { if (r.ok) toast(L('Saved ✓')); else toast(L('Offline — saved on this device')); })
      .catch(() => toast(L('Offline — saved on this device')));
  }, 1200);
}

function renderAccountBar(u) {
  const bar = $('accountBar');
  if (!bar) return;
  if (u && u.username) {
    bar.innerHTML = L('Hi,') + ' <b></b> · <a href="#" id="logoutLink">' + L('Log out') + '</a>';
    bar.querySelector('b').textContent = u.username;
    const ll = $('logoutLink');
    if (ll) ll.addEventListener('click', e => { e.preventDefault(); fetch('/api/logout', { method: 'POST' }).then(() => location.reload()); });
  } else {
    bar.innerHTML = '<a href="./account.html">' + L('Log in / Sign up') + '</a> ' + L('to save across devices');
  }
}

// Merge two saves field by field, always keeping the more-advanced value of each.
// This way a child who builds on a tablet and then plays on a phone loses nothing from
// either session — no single "winner" can erase the other's work.
function mergeProgress(a, b) {
  a = a || {}; b = b || {};
  const num = k => Math.max(a[k] || 0, b[k] || 0);
  const longer = k => ((b[k] || []).length >= (a[k] || []).length ? (b[k] || []) : (a[k] || [])).slice();
  const union = k => Array.from(new Set([...(a[k] || []), ...(b[k] || [])]));
  // pets/builds: keep whichever list is richer (more entries, then higher total level)
  const petScore = list => (list || []).reduce((s, p) => s + 1 + (p.level || 0), 0);
  const pets = petScore(b.pets) >= petScore(a.pets) ? (b.pets || []) : (a.pets || []);
  const wa = a.wardrobe || {}, wb = b.wardrobe || {};
  return {
    sparks: num('sparks'),
    unlocked: union('unlocked'),
    biomes: union('biomes'),
    wonders: union('wonders'),
    pets: pets.slice(),
    builds: longer('builds'),
    treasures: num('treasures'), shinies: num('shinies'), bops: num('bops'),
    berries: num('berries'),
    quest: { i: Math.max((a.quest && a.quest.i) || 0, (b.quest && b.quest.i) || 0), base: null },
    // prefer a chosen cosmetic over "none"
    wardrobe: { hat: (wb.hat && wb.hat !== 'none') ? wb.hat : (wa.hat || 'none'),
                cape: (wb.cape && wb.cape !== 'none') ? wb.cape : (wa.cape || 'none'),
                outfit: wb.outfit || wa.outfit || 'dress' }
  };
}

fetch('/api/me').then(r => r.ok ? r.json() : null).then(u => {
  if (u && u.username) {
    serverUser = u.username;
    // merge this device's save with the server's, so neither can wipe the other
    applyServerProgress(mergeProgress(progress, u.progress));
    say(L('Welcome back, {name}!', { name: u.username }));
    syncServer(); // push the merged result back up
    renderAccountBar(u);
  } else {
    renderAccountBar(null);
  }
}).catch(() => renderAccountBar(null));

// ---------- first-run tutorial tips (each shows once, ever) ----------
function tip(key, text) {
  if (settings.tut[key]) return;
  // never stomp on a message the child just saw (e.g. "You're riding Boba!") — wait for a quiet moment
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - lastSayAt < 1800) return;
  settings.tut[key] = true; saveSettings();
  say(text);
}

// ---------- Journal / Codex ----------
function openJournal() {
  const el = $('journal'); if (!el) return;
  $('jBiomes').textContent = progress.biomes.length + ' / ' + BIOMES.length;
  $('jBuddies').textContent = pets.length;
  $('jShiny').textContent = progress.shinies || 0;
  $('jPetal').textContent = progress.treasures || 0;
  $('jWonder').textContent = (progress.wonders || []).length;
  $('jBops').textContent = progress.bops || 0;
  $('jBuilds').textContent = (progress.builds || []).length;
  $('jQuests').textContent = Math.min(progress.quest.i, QUESTS.length) + ' / ' + QUESTS.length;
  el.classList.add('on');
}
function closeJournal() { const el = $('journal'); if (el) el.classList.remove('on'); }
const journalBtn = $('journalBtn');
if (journalBtn) journalBtn.addEventListener('click', openJournal);
const journalClose = $('journalClose');
if (journalClose) journalClose.addEventListener('click', closeJournal);

// ---------- Skykeeper NPC + quest chain ----------
const skykeeper = new THREE.Group();
{
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.7, 12),
    new THREE.MeshToonMaterial({ color: 0xe8f2ff }));
  robe.position.y = 0.85; robe.castShadow = true; skykeeper.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12),
    new THREE.MeshToonMaterial({ color: 0xffe8d0 }));
  head.position.y = 1.95; skykeeper.add(head);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 2.5; skykeeper.add(halo);
  skykeeper.add(new THREE.PointLight(0xfff2c0, 0.8, 8));
  skykeeper.position.set(5, 0, -5);
  scene.add(skykeeper);
}

function qSnapshot() {
  return {
    sparks: progress.sparks, pets: pets.length, bops: progress.bops || 0,
    builds: (progress.builds || []).length, biomes: progress.biomes.length,
    treasures: progress.treasures || 0
  };
}
const QUESTS = [
  { give: 'The islands are drifting apart… sparks hold them together! Gather 10 sparks for me.',
    done: 'Wonderful! The isles feel steadier already.', reward: 10,
    prog: b => L('{n}/10 sparks', { n: Math.min(10, progress.sparks - b.sparks) }),
    ok: b => progress.sparks - b.sparks >= 10 },
  { give: 'Slimes are lonely little things. Make friends with one — just stand close and be kind.',
    done: 'A new friendship! The sky sings for you.', reward: 10,
    prog: b => L('{n}/1 buddy', { n: Math.min(1, pets.length - b.pets) }),
    ok: b => pets.length - b.pets >= 1 },
  { give: 'Some slimes love a playful bop — it makes them giggle! Bop 3 of them.',
    done: 'Hee hee! They loved it.', reward: 10,
    prog: b => L('{n}/3 bops', { n: Math.min(3, (progress.bops || 0) - b.bops) }),
    ok: b => (progress.bops || 0) - b.bops >= 3 },
  { give: 'Make the isles beautiful again — place 3 decorations anywhere you like. Press B to build!',
    done: 'Oh, how lovely! You have a gardener\'s heart, like Miru.', reward: 10,
    prog: b => L('{n}/3 placed', { n: Math.min(3, (progress.builds || []).length - b.builds) }),
    ok: b => (progress.builds || []).length - b.builds >= 3 },
  { give: 'Far from here the land changes color. Travel until you discover a new region!',
    done: 'You crossed the sky! Few gardeners wander so far.', reward: 15,
    prog: b => L('{n}/1 region', { n: Math.min(1, progress.biomes.length - b.biomes) }),
    ok: b => progress.biomes.length - b.biomes >= 1 },
  { give: 'One last thing… legends speak of glowing moonpetals. Find one and the isles will bloom!',
    done: 'A moonpetal! You did it — you are a true Sky Explorer! Come back any time, little gardener.', reward: 25,
    prog: b => L('{n}/1 moonpetal', { n: Math.min(1, (progress.treasures || 0) - b.treasures) }),
    ok: b => (progress.treasures || 0) - b.treasures >= 1 },
];

function showDialog(text) {
  const d = $('dialog'); if (!d) { say(text); return; }
  $('dlgText').textContent = text;
  d.classList.add('on');
}
const dlgBtn = $('dlgBtn');
if (dlgBtn) dlgBtn.addEventListener('click', () => $('dialog').classList.remove('on'));

function questLine() {
  const q = progress.quest;
  if (q.i >= QUESTS.length) return L('All done — Sky Explorer!');
  if (!q.base) return L('Talk to the Skykeeper ✦');
  const Q = QUESTS[q.i];
  return Q.ok(q.base) ? L('Return to the Skykeeper ✦') : Q.prog(q.base);
}
let lastQLine = '';
function refreshQuestHud() {
  const s = questLine();
  if (s === lastQLine) return;
  lastQLine = s;
  const el = $('qLine'); if (el) el.textContent = s;
}

function talkSkykeeper() {
  const q = progress.quest;
  if (q.i >= QUESTS.length) { showDialog(L('The isles bloom because of you. Play as long as you like, Sky Explorer!')); return; }
  const Q = QUESTS[q.i];
  if (!q.base) {
    q.base = qSnapshot();
    showDialog(L(Q.give));
  } else if (Q.ok(q.base)) {
    showDialog(L(Q.done) + L(' (+{n} sparks)', { n: Q.reward }));
    q.i++; q.base = null;
    addSparks(Q.reward);
    burst(skykeeper.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xfff2a0, 24);
    chime(1320);
  } else {
    showDialog(L(Q.give) + ' (' + Q.prog(q.base) + ')');
  }
  saveProgress(); refreshQuestHud();
}
let interactPressed = false;
const talkBtn = $('talkBtn');
if (talkBtn) talkBtn.addEventListener('click', () => { interactPressed = true; });
refreshQuestHud();

// ---------- buddy care: pet the nearest buddy to raise happiness & grant XP ----------
let petPressed = false;
const CARE_NAMES = ['giggled', 'did a happy wiggle', 'bounced with joy', 'glowed brighter', 'nuzzled you'];
function careForBuddy() {
  if (!pets.length) { say('Make a slime friend first — walk up to one!'); return; }
  // nearest buddy to the player
  let best = null, bd = 3.5;
  for (const p of pets) {
    const d = Math.hypot(p.g.position.x - player.position.x, p.g.position.z - player.position.z);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) best = pets[0];
  heartBurst(best.g.position);
  best.careBounce = 1; // animation impulse
  chime(1040);
  if (navigator.vibrate) navigator.vibrate(10);
  grantPetXp(2); // petting helps them grow
  say(best.name + ' ' + L(CARE_NAMES[Math.floor(Math.random() * CARE_NAMES.length)]) + '! ♥');
  tip('care', L('Petting your buddies makes them happy and helps them grow!'));
}
const careBtn = $('careBtn');
if (careBtn) careBtn.addEventListener('click', careForBuddy);

// ---------- buddy panel: name your buddies and feed them berries ----------
function feedBuddy(pet) {
  if ((progress.berries || 0) <= 0) { say(L('No berries yet — collect seeds to find some!')); chime(300); return; }
  progress.berries--;
  pet.happy = Math.min(100, (pet.happy || 60) + 22);
  pet.careBounce = 1;
  heartBurst(pet.g.position); chime(1120);
  if (navigator.vibrate) navigator.vibrate(10);
  grantPetXp(3); // a fed buddy grows a little
  say(L('{name} loved the berry! 🍓', { name: pet.name }));
  renderBuddyPanel();
}

function renameBuddy(pet) {
  const cur = pet.name;
  const nm = (prompt(L('Name your buddy:'), cur) || '').trim().slice(0, 14);
  if (!nm || nm === cur) return;
  pet.name = nm;
  savePets(); updateBuddyHud(); renderBuddyPanel();
  heartBurst(pet.g.position); chime(1240);
}

function moodFor(h) {
  if (h >= 80) return '😍'; if (h >= 55) return '😊'; if (h >= 30) return '🙂'; return '😴';
}

function renderBuddyPanel() {
  const box = $('buddyList'); if (!box) return;
  $('berryCount').textContent = progress.berries || 0;
  if (!pets.length) { box.innerHTML = '<p class="bdEmpty">' + L('No buddies yet — walk up to a slime and be kind!') + '</p>'; return; }
  box.innerHTML = '';
  pets.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'bdRow';
    const dot = '#' + new THREE.Color(p.color).getHexString();
    row.innerHTML =
      '<span class="bdChip" style="background:' + dot + '"></span>' +
      '<span class="bdName">' + moodFor(p.happy) + ' <b></b> <small>Lv' + p.level + (p.wings ? ' ✦' : '') + '</small></span>' +
      '<span class="bdBar"><i style="width:' + Math.round(p.happy || 0) + '%"></i></span>';
    row.querySelector('b').textContent = p.name;
    const rn = document.createElement('button'); rn.className = 'bdBtn'; rn.textContent = L('Rename');
    rn.addEventListener('click', () => renameBuddy(p));
    const fd = document.createElement('button'); fd.className = 'bdBtn feed'; fd.textContent = L('Feed') + ' 🍓';
    fd.addEventListener('click', () => feedBuddy(p));
    row.appendChild(rn); row.appendChild(fd);
    box.appendChild(row);
  });
}
function openBuddyPanel() { renderBuddyPanel(); const el = $('buddyPanel'); if (el) el.classList.add('on'); }
function closeBuddyPanel() { const el = $('buddyPanel'); if (el) el.classList.remove('on'); }
const buddyBtn = $('buddyBtn');
if (buddyBtn) buddyBtn.addEventListener('click', openBuddyPanel);
const buddyClose = $('buddyClose');
if (buddyClose) buddyClose.addEventListener('click', closeBuddyPanel);

// ---------- minimap + compass: so a child never gets lost in an endless world ----------
const mapCanvas = $('map');
const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;
let mapTick = 0;
function drawMap() {
  if (!mapCtx) return;
  const big = $('mapWrap').classList.contains('big');
  const S = big ? 220 : 132;               // canvas pixel size
  if (mapCanvas.width !== S) { mapCanvas.width = S; mapCanvas.height = S; }
  const range = big ? 140 : 70;            // world units shown from centre to edge
  const c = S / 2, scale = c / range;
  mapCtx.clearRect(0, 0, S, S);
  // soft round backdrop
  mapCtx.fillStyle = 'rgba(20,40,70,.55)';
  mapCtx.beginPath(); mapCtx.arc(c, c, c, 0, 7); mapCtx.fill();
  const px = player.position.x, pz = player.position.z;
  const toXY = (x, z) => [c + (x - px) * scale, c + (z - pz) * scale];
  // islands
  for (const isl of islands) {
    const [x, y] = toXY(isl.x, isl.z);
    if (x < -10 || x > S + 10 || y < -10 || y > S + 10) continue;
    mapCtx.fillStyle = isl.wonder ? '#bfffcf' : 'rgba(150,220,150,.9)';
    mapCtx.beginPath(); mapCtx.arc(x, y, Math.max(2, isl.r * scale * 0.5), 0, 7); mapCtx.fill();
  }
  // home marker (origin)
  const [hx, hy] = toXY(0, 0);
  mapCtx.fillStyle = '#ffd98a'; mapCtx.font = (big ? 16 : 11) + 'px sans-serif';
  mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle';
  mapCtx.fillText('🏠', hx, hy);
  // skykeeper
  const [kx, ky] = toXY(skykeeper.position.x, skykeeper.position.z);
  mapCtx.fillText('✦', kx, ky);
  // player arrow, pointing where Miru faces
  mapCtx.save(); mapCtx.translate(c, c); mapCtx.rotate(-body.rotation.y);
  mapCtx.fillStyle = '#ff8fb8'; mapCtx.beginPath();
  mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(0, 3); mapCtx.lineTo(-5, 6); mapCtx.closePath(); mapCtx.fill();
  mapCtx.restore();
  // compass: arrow at the rim pointing back home when you have wandered off
  const dh = Math.hypot(px, pz);
  if (dh > range) {
    const ang = Math.atan2(-pz, -px);
    const rx = c + Math.cos(ang) * (c - 12), ry = c + Math.sin(ang) * (c - 12);
    mapCtx.fillStyle = '#ffd98a'; mapCtx.fillText('🏠', rx, ry);
  }
}

// ---------- wardrobe: cosmetics earned by exploring (never bought) ----------
const WARDROBE = {
  // outfit has no 'none' option — Miru always wears something (kid-friendly by design)
  outfit: [
    { id: 'dress',  name: 'Sky Dress',     need: () => true,                                 req: '' },
    { id: 'meadow', name: 'Meadow Tunic',  need: () => progress.biomes.length >= 2,          req: 'Discover 2 regions' },
    { id: 'sunset', name: 'Sunset Gown',   need: () => progress.sparks >= 40,                req: 'Collect 40 sparks' },
    { id: 'star',   name: 'Starlight Robe', need: () => (progress.wonders || []).length >= 1, req: 'Find a Great Tree' }
  ],
  hat: [
    { id: 'none',   name: 'No hat',       need: () => true, req: '' },
    { id: 'flower', name: 'Flower Crown', need: () => progress.sparks >= 20,               req: 'Collect 20 sparks' },
    { id: 'star',   name: 'Star Hat',     need: () => (progress.wonders || []).length >= 1, req: 'Find a Great Tree' },
    { id: 'party',  name: 'Party Hat',    need: () => (progress.quest?.i || 0) >= 3,        req: 'Finish 3 Skykeeper quests' }
  ],
  cape: [
    { id: 'none', name: 'No cape',        need: () => true, req: '' },
    { id: 'sky',  name: 'Sky Cape',       need: () => progress.biomes.length >= 2,          req: 'Discover 2 regions' },
    { id: 'star', name: 'Starlight Cape', need: () => (progress.treasures || 0) >= 1,       req: 'Find a moonpetal' }
  ]
};

// a full outfit that covers the torso and legs — built in real-metre proportions
// so it drops straight onto the normalized VRM hips bone at scale 1
function makeOutfit(id) {
  const palette = {
    dress:  { body: 0x7fb0e8, skirt: 0x6a9fe0, trim: 0xffffff },
    meadow: { body: 0x8fd6a0, skirt: 0x74c58a, trim: 0xfff2c0 },
    sunset: { body: 0xffa9c4, skirt: 0xf58fb2, trim: 0xffe6a0 },
    star:   { body: 0x8f8ff0, skirt: 0x6f6fd8, trim: 0xfff2a0 }
  }[id] || { body: 0x7fb0e8, skirt: 0x6a9fe0, trim: 0xffffff };
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshToonMaterial({ color: palette.body });
  const skirtMat = new THREE.MeshToonMaterial({ color: palette.skirt, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshToonMaterial({ color: palette.trim });
  // bodice: upper chest down to waist (wide/tall enough to fully hide the base top)
  const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.46, 18), bodyMat);
  bodice.position.y = 0.20; g.add(bodice);
  // rounded neckline cap so nothing peeks over the top
  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
  neck.position.y = 0.43; g.add(neck);
  // short sleeves so shoulders/upper arms are covered
  for (const sx of [-1, 1]) {
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.15, 12), bodyMat);
    sl.position.set(sx * 0.15, 0.33, 0); sl.rotation.z = sx * 0.5; g.add(sl);
  }
  // waist trim
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 8, 20), trimMat);
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.02; g.add(belt);
  // skirt: waist flaring down to the knees, covering hips + thighs
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.27, 0.44, 20, 1, true), skirtMat);
  skirt.position.y = -0.19; g.add(skirt);
  // hem trim
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 8, 24), trimMat);
  hem.rotation.x = Math.PI / 2; hem.position.y = -0.40; g.add(hem);
  if (id === 'star') {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
      const a = i / 6 * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.2, -0.28 - Math.random() * 0.08, Math.sin(a) * 0.2); g.add(s);
    }
  }
  return g;
}

function makeHat(id) {
  const g = new THREE.Group();
  if (id === 'flower') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 16), new THREE.MeshToonMaterial({ color: 0x7fd86a }));
    ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshToonMaterial({ color: [0xff8fc0, 0xffe08a, 0xffffff][i % 3] }));
      const a = i / 6 * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.34, 0.03, Math.sin(a) * 0.34); g.add(p);
    }
  } else if (id === 'star') {
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 10), new THREE.MeshToonMaterial({ color: 0x6a7ae0 }));
    cap.position.y = 0.25; g.add(cap);
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
    st.position.y = 0.58; g.add(st);
    st.add(new THREE.PointLight(0xfff2a0, 0.5, 3));
  } else { // party
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 12), new THREE.MeshToonMaterial({ color: 0xff7ab0 }));
    cone.position.y = 0.28; g.add(cone);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshToonMaterial({ color: 0xfff2c0 }));
    pom.position.y = 0.58; g.add(pom);
  }
  return g;
}

function makeCape(id) {
  const g = new THREE.Group();
  const col = id === 'sky' ? 0x8fd0f5 : 0x4a4f8f;
  const cape = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.15, 12, 1, true, Math.PI * 0.25, Math.PI * 1.5),
    new THREE.MeshToonMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
  );
  cape.position.y = -0.42; g.add(cape);
  if (id === 'star') {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
      s.position.set((Math.random() - 0.5) * 0.7, -0.2 - Math.random() * 0.75, -0.3 - Math.random() * 0.12);
      g.add(s);
    }
  }
  return g;
}

let hatMesh = null, capeMesh = null, outfitMesh = null;
function applyWardrobe() {
  if (hatMesh && hatMesh.parent) hatMesh.parent.remove(hatMesh);
  if (capeMesh && capeMesh.parent) capeMesh.parent.remove(capeMesh);
  if (outfitMesh && outfitMesh.parent) outfitMesh.parent.remove(outfitMesh);
  hatMesh = capeMesh = outfitMesh = null;
  const w = progress.wardrobe || { hat: 'none', cape: 'none', outfit: 'dress' };
  const vHead = vrmBones && vrmBones.head;
  const vSpine = vrmBones && vrmBones.spine;
  const vHips = vrmBones && vrmBones.hips;

  // outfit rides the hips so torso + legs stay covered (default 'dress', never bare)
  outfitMesh = makeOutfit(w.outfit || 'dress');
  if (vHips) { outfitMesh.scale.setScalar(1); outfitMesh.position.y = 0.06; vHips.add(outfitMesh); }
  else { outfitMesh.scale.setScalar(2.1); outfitMesh.position.y = 0.9; body.add(outfitMesh); }

  if (w.hat && w.hat !== 'none') {
    hatMesh = makeHat(w.hat);
    // VRM bones are in normalized metres; the primitive rig uses larger local units
    hatMesh.scale.setScalar(vHead ? 0.34 : 1);
    hatMesh.position.y = vHead ? 0.15 : 0.36;
    (vHead || head).add(hatMesh);
  }
  if (w.cape && w.cape !== 'none') {
    capeMesh = makeCape(w.cape);
    capeMesh.scale.setScalar(vSpine ? 0.42 : 1);
    capeMesh.position.set(0, vSpine ? 0.42 : 1.35, vSpine ? -0.07 : -0.2);
    (vSpine || body).add(capeMesh);
  }
}

function setWardrobe(slot, id) {
  if (!progress.wardrobe) progress.wardrobe = { hat: 'none', cape: 'none', outfit: 'dress' };
  progress.wardrobe[slot] = id;
  applyWardrobe(); saveProgress(); chime(880);
  burst(player.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 0xffe08a, 14);
}

function renderWardrobe() {
  for (const slot of ['outfit', 'hat', 'cape']) {
    const box = $('wr_' + slot);
    if (!box) continue;
    box.innerHTML = '';
    const cur = (progress.wardrobe || {})[slot] || 'none';
    for (const item of WARDROBE[slot]) {
      const ok = item.need();
      const b = document.createElement('button');
      b.className = 'wrItem' + (cur === item.id ? ' sel' : '') + (ok ? '' : ' locked');
      b.textContent = ok ? L(item.name) : '🔒 ' + L(item.name);
      b.title = ok ? L(item.name) : L('Locked — {req}', { req: L(item.req) });
      if (ok) b.addEventListener('click', () => { setWardrobe(slot, item.id); renderWardrobe(); });
      else { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
      box.appendChild(b);
      if (!ok) {
        const hint = document.createElement('span');
        hint.className = 'wrReq'; hint.textContent = L(item.req);
        box.appendChild(hint);
      }
    }
  }
}
function openWardrobe() { renderWardrobe(); const el = $('wardrobe'); if (el) el.classList.add('on'); }
function closeWardrobe() { const el = $('wardrobe'); if (el) el.classList.remove('on'); }
const wardrobeBtn = $('wardrobeBtn');
if (wardrobeBtn) wardrobeBtn.addEventListener('click', openWardrobe);
const wardrobeClose = $('wardrobeClose');
if (wardrobeClose) wardrobeClose.addEventListener('click', closeWardrobe);
applyWardrobe();

// ---------- PWA: register the service worker (installable app) ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* optional */ });
}

// ---------- input ----------
const keys = {};
let jumpPressed = false, punchPressed = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyF') punchPressed = true;
  if (e.code === 'KeyE') interactPressed = true;
  if (e.code === 'KeyP') petPressed = true;
  if (e.code === 'KeyR' && !buildMode) toggleRide();
  if (e.code === 'KeyJ') { const j = $('journal'); if (j && j.classList.contains('on')) closeJournal(); else openJournal(); }
  if (e.code === 'KeyK') { const w = $('wardrobe'); if (w && w.classList.contains('on')) closeWardrobe(); else openWardrobe(); }
  if (e.code === 'KeyN') { const bp = $('buddyPanel'); if (bp && bp.classList.contains('on')) closeBuddyPanel(); else openBuddyPanel(); }
  if (e.code === 'KeyM') { const mp = $('mapWrap'); if (mp) mp.classList.toggle('big'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });

// --- free-look camera state ---
let camYaw = 0, camPitch = 0.32, camDist = 9;
const isTouch = matchMedia('(pointer:coarse)').matches;
// raycaster used to keep the camera from clipping through trees/decorations
const camRay = new THREE.Raycaster();
camRay.far = 40;
// objects the camera ray must ignore (sky/sun/player never block the view)
function camRayBlocks(obj) {
  for (let o = obj; o; o = o.parent) {
    if (o === player || o === skyDome || o === sunSprite || o === sunGlow) return false;
  }
  return true;
}

// desktop: pointer lock mouse-look; click while locked = punch
renderer.domElement.addEventListener('click', () => {
  if (!started) return;
  if (buildMode) { placeBuild(); return; }
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  } else {
    punchPressed = true;
  }
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const s = settings.sensitivity, inv = settings.invert ? -1 : 1;
  camYaw -= e.movementX * 0.0028 * s;
  camPitch = Math.min(1.15, Math.max(-0.35, camPitch + e.movementY * 0.0022 * s * inv));
});
addEventListener('wheel', e => {
  camDist = Math.min(16, Math.max(5, camDist + e.deltaY * 0.008));
});

// touch: drag anywhere on the right side of the canvas rotates the camera
let camTouch = null, lastTX = 0, lastTY = 0;
renderer.domElement.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    if (t.clientX > innerWidth * 0.45 && camTouch === null) {
      camTouch = t.identifier; lastTX = t.clientX; lastTY = t.clientY;
    }
  }
}, { passive: true });
renderer.domElement.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier !== camTouch) continue;
    camYaw -= (t.clientX - lastTX) * 0.006 * settings.sensitivity;
    camPitch = Math.min(1.15, Math.max(-0.35, camPitch + (t.clientY - lastTY) * 0.004 * settings.sensitivity * (settings.invert ? -1 : 1)));
    lastTX = t.clientX; lastTY = t.clientY;
  }
}, { passive: true });
const endCamTouch = e => {
  for (const t of e.changedTouches) if (t.identifier === camTouch) camTouch = null;
};
renderer.domElement.addEventListener('touchend', endCamTouch);
renderer.domElement.addEventListener('touchcancel', endCamTouch);

const stickVec = { x: 0, y: 0 };
const stickEl = $('stick'), knob = $('knob');
if (stickEl) {
  let sid = null;
  stickEl.addEventListener('touchstart', e => { sid = e.changedTouches[0].identifier; }, { passive: true });
  stickEl.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== sid) continue;
      const r = stickEl.getBoundingClientRect();
      let dx = (t.clientX - (r.left + 64)) / 52, dy = (t.clientY - (r.top + 64)) / 52;
      const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
      stickVec.x = dx; stickVec.y = dy;
      knob.style.left = 40 + dx * 34 + 'px'; knob.style.top = 40 + dy * 34 + 'px';
    }
  }, { passive: true });
  const end = () => { stickVec.x = stickVec.y = 0; knob.style.left = '40px'; knob.style.top = '40px'; };
  stickEl.addEventListener('touchend', end); stickEl.addEventListener('touchcancel', end);
}
$('jumpBtn').addEventListener('touchstart', e => { e.preventDefault(); jumpPressed = true; });
$('jumpBtn').addEventListener('click', () => { jumpPressed = true; });
const punchBtn = $('punchBtn');
if (punchBtn) {
  punchBtn.addEventListener('touchstart', e => { e.preventDefault(); punchPressed = true; });
  punchBtn.addEventListener('click', () => { punchPressed = true; });
}

// ---------- physics + loop ----------
const vel = new THREE.Vector3();
let onGround = false, jumps = 0, running = false;
let punchTime = -1; // >=0 while punch anim plays
let trailTick = 0, bondT = 0;
let coyoteT = 0, jumpBufT = 0, footT = 0, wasAirborne = false, airTime = 0;
const skyTmp = new THREE.Color(), fogTmp = new THREE.Color();
const spawn = new THREE.Vector3(0, 0, 3);
// WALK/SPRINT/JUMP/GRAV/MAXJUMPS/GLIDE/MAGNET live in the progression block above

function groundHeight(x, z) {
  let best = -Infinity;
  for (const isl of islands) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d < isl.r) best = Math.max(best, isl.y);
  }
  return best;
}

let started = false;
$('startBtn').addEventListener('click', () => {
  started = true;
  const t = $('title');
  t.style.opacity = '0';
  setTimeout(() => t.remove(), 650);
  applyQuality();
  startMusic();
  chime(660);
  say(isTouch ? L('Drag the right side to look around!') : L('Click the world to grab the camera!'));
});

// ---------- pause + settings menu ----------
function setPaused(on) {
  paused = on;
  const m = $('pauseMenu');
  if (m) m.classList.toggle('on', on);
  if (on && document.pointerLockElement) document.exitPointerLock();
}
addEventListener('keydown', e => {
  if (e.code === 'Escape' && started) setPaused(!paused);
});
const pauseBtn = $('pauseBtn');
if (pauseBtn) pauseBtn.addEventListener('click', () => setPaused(true));
const resumeBtn = $('resumeBtn');
if (resumeBtn) resumeBtn.addEventListener('click', () => setPaused(false));

// settings controls (present in pause menu)
function bindSetting(id, apply) {
  const el = $(id);
  if (el) el.addEventListener('input', () => { apply(el); saveSettings(); });
  return el;
}
{
  const mv = bindSetting('setMusic', el => { settings.music = +el.value; setVolumes(); });
  if (mv) mv.value = settings.music;
  const sv = bindSetting('setSfx', el => { settings.sfx = +el.value; setVolumes(); });
  if (sv) sv.value = settings.sfx;
  const qv = bindSetting('setQuality', el => { settings.quality = el.value; govApplied = false; applyQuality(); });
  if (qv) qv.value = settings.quality;
  const sens = bindSetting('setSens', el => { settings.sensitivity = +el.value; });
  if (sens) sens.value = settings.sensitivity;
  const inv = $('setInvert');
  if (inv) { inv.checked = settings.invert; inv.addEventListener('change', () => { settings.invert = inv.checked; saveSettings(); }); }
  const con = $('setContrast');
  if (con) { con.checked = settings.contrast; con.addEventListener('change', () => { settings.contrast = con.checked; applyA11y(); saveSettings(); }); }
  const big = $('setBigText');
  if (big) { big.checked = settings.bigText; big.addEventListener('change', () => { settings.bigText = big.checked; applyA11y(); saveSettings(); }); }
  const lng = $('setLang');
  if (lng) {
    lng.value = settings.lang;
    lng.addEventListener('change', () => {
      settings.lang = lng.value; setLang(lng.value); saveSettings();
      document.documentElement.lang = lng.value;
      translateDom();
      refreshGoal(); updateBuddyHud(); lastQLine = ''; refreshQuestHud();
      setBuildType(buildType); renderWardrobe();
    });
  }
}
applyA11y();

// ---------- photo mode: frame a shot, snap it, save it (a sharing hook for siblings) ----------
function setPhotoMode(on) {
  document.body.classList.toggle('photo', on);
  if (on) tip('photo', L('Move the camera to frame your shot, then tap Snap!'));
}
const photoBtn = $('photoBtn');
if (photoBtn) photoBtn.addEventListener('click', () => setPhotoMode(!document.body.classList.contains('photo')));
const photoExit = $('photoExit');
if (photoExit) photoExit.addEventListener('click', () => setPhotoMode(false));
const snapBtn = $('snapBtn');
if (snapBtn) snapBtn.addEventListener('click', () => {
  try {
    const url = renderer.domElement.toDataURL('image/png');
    const img = $('photoImg'); if (img) img.src = url;
    const dl = $('photoSave'); if (dl) { dl.href = url; dl.download = 'skyseed-' + Date.now() + '.png'; }
    $('photoView').classList.add('on');
    chime(1320);
  } catch (e) { say(L('Could not take the photo on this device.')); }
});
const photoClose = $('photoClose');
if (photoClose) photoClose.addEventListener('click', () => $('photoView').classList.remove('on'));

// "saved" micro-toast, used by the server sync
let toastTimer;
function toast(text) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 1400);
}

const clock = new THREE.Clock();

function doPunch(t) {
  punchTime = 0;
  chime(240);
  // hit any slime in front of Miru within reach
  const fwd = new THREE.Vector3(Math.sin(body.rotation.y), 0, Math.cos(body.rotation.y));
  for (const s of slimes) {
    if (!s.alive) continue;
    const to = s.g.position.clone().sub(player.position); to.y = 0;
    if (to.length() < 2.4 && to.normalize().dot(fwd) > 0.35) {
      s.alive = false; s.respawn = t + 6;
      burst(s.g.position, s.blob.material.color, 28);
      s.g.visible = false;
      progress.bops++; saveProgress();
      const bops = progress.bops;
      const bopEl = $('cBop'); if (bopEl) bopEl.textContent = bops;
      chime(1040);
      say(L(['Boing! Got one!', 'Slime bopped!', 'Pow! It giggled away.'][bops % 3]));
    }
  }
}

// FPS governor: if the frame rate stays low, quietly drop expensive features
let fpsAcc = 0, fpsN = 0, govApplied = false;
function governFps(dt) {
  if (govApplied || settings.quality === 'low') return;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 2) {
    const fps = fpsN / fpsAcc;
    fpsAcc = 0; fpsN = 0;
    if (fps < 28) {
      govApplied = true;
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      say(L('Smoothing things out for your device!'));
    }
  }
}

let paused = false;

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = paused ? 0 : rawDt;
  const t = clock.elapsedTime;
  governFps(rawDt);

  for (const c of clouds) {
    c.position.x += c.userData.v * dt;
    if (c.position.x > 90) c.position.x = -90;
  }

  // slimes hop and wander
  for (const s of slimes) {
    if (!s.alive) {
      if (t > s.respawn) {
        s.alive = true; s.g.visible = true;
        s.g.position.copy(s.home);
        burst(s.g.position, s.blob.material.color, 12);
      }
      continue;
    }
    s.turn -= dt;
    if (s.turn <= 0) { s.dir += (Math.random() - 0.5) * 2; s.turn = 1.5 + Math.random() * 2; }
    const hop = Math.abs(Math.sin(t * 3 + s.phase));
    s.blob.scale.set(1 + (1 - hop) * 0.15, 0.8 - (1 - hop) * 0.2, 1 + (1 - hop) * 0.15);
    s.g.position.y = s.isl.y + 0.45 + hop * 0.5;
    const nx = s.g.position.x + Math.sin(s.dir) * dt * 1.2;
    const nz = s.g.position.z + Math.cos(s.dir) * dt * 1.2;
    if (Math.hypot(nx - s.isl.x, nz - s.isl.z) < s.isl.r - 0.8) {
      s.g.position.x = nx; s.g.position.z = nz;
    } else { s.dir += Math.PI / 2; }
    s.g.rotation.y = s.dir;
  }

  // keyboard camera rotate fallback (Q/E) for kids without a mouse
  if (keys.KeyQ) camYaw += dt * 2.2;
  if (keys.KeyE && !punchPressed) { /* E reserved for punch; Q rotates */ }

  if (started) {
    // camera-relative movement using free-look yaw
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stickVec.x;
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stickVec.y;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    running = len > 0.05;

    // riding is faster, and a winged buddy is faster still
    const rideBoost = riding ? (riding.wings ? 1.85 : 1.5) : 1;
    const speed = ((keys.ShiftLeft || keys.ShiftRight) ? SPRINT : WALK) * rideBoost;
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    vel.x = (ix * cy - iz * sy) * speed;
    vel.z = (-ix * sy - iz * cy) * speed;

    if (running) {
      const target = Math.atan2(vel.x, vel.z);
      let d = target - body.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      body.rotation.y += d * Math.min(1, dt * 12);
    }

    // forgiving platforming: jump buffer + coyote time
    if (jumpPressed) jumpBufT = 0.14;
    jumpPressed = false;
    coyoteT = onGround ? 0.12 : Math.max(0, coyoteT - dt);
    if (jumpBufT > 0) {
      if (onGround || coyoteT > 0) { vel.y = JUMP; jumps = 1; coyoteT = 0; jumpBufT = 0; chime(520); thud(900, 0.05); }
      else if (jumps > 0 && jumps < MAXJUMPS) { vel.y = JUMP * 0.9; jumps++; jumpBufT = 0; chime(560 + jumps * 40); }
      else jumpBufT -= dt;
    }

    if (punchPressed && punchTime < 0) doPunch(t);
    punchPressed = false;

    vel.y += GRAV * dt;
    if (riding && riding.wings && keys.Space) {
      // winged buddy: hold jump to fly. A soft ceiling eases the climb to nothing near the top
      // so a child drifts to a gentle hover instead of vanishing into empty sky.
      const gh = groundHeight(player.position.x, player.position.z);
      const floor = gh > -Infinity ? gh : 0;
      const room = Math.max(0, 1 - (player.position.y - floor) / 34);
      vel.y = Math.min(vel.y + 46 * dt * room, 8.5 * Math.max(0.12, room));
      if (Math.random() < 0.25) burst(riding.g.position.clone(), 0xffffff, 2);
    } else if (vel.y < 0 && keys.Space) {
      vel.y = Math.max(vel.y, riding ? GLIDE * 0.55 : GLIDE); // a mount always softens the fall
    }

    // sit height on the mount, eased so mounting looks smooth
    const wantLift = riding ? 0.72 + (riding.level - 1) * 0.05 : 0;
    rideLift += (wantLift - rideLift) * Math.min(1, dt * 8);

    player.position.x += vel.x * dt;
    player.position.z += vel.z * dt;
    player.position.y += vel.y * dt;

    // stream new islands in / far ones out, and greet new biomes
    ensureChunks(player.position.x, player.position.z);
    checkBiome(player.position.x, player.position.z);
    // gentle day/night: 5-minute cycle, never darker than dusk (kid-safe)
    const dayF = 0.66 + 0.34 * Math.sin(t * Math.PI * 2 / 300);
    sun.intensity = 2.2 * dayF;
    hemi.intensity = 0.55 + 0.35 * dayF;

    // ease sky + fog toward the current biome (dimmed by time of day)
    const bh = biomeFor(player.position.x, player.position.z);
    const dim = 0.55 + 0.45 * dayF;
    scene.background.lerp(skyTmp.setHex(bh.sky).multiplyScalar(dim), dt * 0.8);
    scene.fog.color.lerp(fogTmp.setHex(bh.fog).multiplyScalar(dim), dt * 0.8);
    // drive the gradient dome: zenith = sky, horizon = fog, so it blends seamlessly
    skyUniforms.top.value.lerp(skyTmp.setHex(bh.sky).multiplyScalar(dim), dt * 0.8);
    skyUniforms.bottom.value.lerp(fogTmp.setHex(bh.fog).multiplyScalar(dim * 1.05), dt * 0.8);
    skyDome.position.copy(camera.position);
    // keep the sun high, offset from the camera, and fade it at night
    const sd = new THREE.Vector3(0.4, 0.8, 0.45).normalize();
    sunSprite.position.copy(camera.position).addScaledVector(sd, 240);
    sunGlow.position.copy(camera.position).addScaledVector(sd, 245);
    sunSprite.lookAt(camera.position); sunGlow.lookAt(camera.position);
    sunSprite.material.opacity = 0.9 * dayF;
    sunGlow.material.opacity = 0.28 * dayF;

    // wonder discovery: first visit to a Great Tree island
    for (const isl of islands) {
      if (!isl.wonder || isl.found) continue;
      if (Math.hypot(player.position.x - isl.x, player.position.z - isl.z) < isl.r + 4) {
        isl.found = true;
        if (!progress.wonders.includes(isl.key)) {
          progress.wonders.push(isl.key);
          say(L('You found a Great Tree! Wonder #{n}!', { n: progress.wonders.length }));
          chime(1180); burst(new THREE.Vector3(isl.x, isl.y + 9, isl.z), 0xbfffcf, 30);
          saveProgress();
        }
      }
    }

    // sparkle trail cosmetic (unlocked later)
    if (hasTrail && running && onGround) {
      trailTick -= dt;
      if (trailTick <= 0) { burst(player.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xfff2c0, 4); trailTick = 0.12; }
    }

    const gh = groundHeight(player.position.x, player.position.z);
    if (gh > -Infinity && player.position.y <= gh && vel.y <= 0) {
      player.position.y = gh; vel.y = 0; onGround = true; jumps = 0;
      spawn.set(player.position.x, gh, player.position.z);
    } else {
      onGround = false;
    }

    // landing feedback: dust puff + soft thud scaled by fall time
    if (onGround && wasAirborne && airTime > 0.18) {
      burst(player.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xd9cfc0, airTime > 0.6 ? 14 : 8);
      thud(airTime > 0.6 ? 320 : 480, 0.08);
    }
    wasAirborne = !onGround;
    airTime = onGround ? 0 : airTime + dt;

    // footsteps + run dust while on ground
    if (running && onGround) {
      footT -= dt;
      if (footT <= 0) {
        thud(650, 0.045);
        burst(player.position.clone().add(new THREE.Vector3(0, 0.1, 0)), 0xcfc5b8, 3);
        footT = (keys.ShiftLeft || keys.ShiftRight) ? 0.22 : 0.3;
      }
    } else footT = 0;

    if (player.position.y < -25) {
      player.position.copy(spawn).add(new THREE.Vector3(0, 6, 0));
      vel.set(0, 0, 0);
      say(L('Whoops! The wind carried you back.'));
      chime(330);
    }

    // character animation — VRM humanoid bones when loaded, primitive rig otherwise
    if (vrm && vrmBones) {
      const B = vrmBones;
      if (punchTime >= 0) {
        punchTime += dt;
        const p = Math.min(1, punchTime / 0.3);
        if (B.rArm) { B.rArm.rotation.z = -1.15; B.rArm.rotation.x = -Math.sin(p * Math.PI) * 2.0; }
        body.position.z = Math.sin(p * Math.PI) * 0.15;
        if (p >= 1) { punchTime = -1; if (B.rArm) B.rArm.rotation.x = 0; body.position.z = 0; }
      } else if (running && onGround) {
        const s = Math.sin(t * 14);
        if (B.lArm) { B.lArm.rotation.z = 1.15; B.lArm.rotation.x = s * 0.7; }
        if (B.rArm) { B.rArm.rotation.z = -1.15; B.rArm.rotation.x = -s * 0.7; }
        if (B.lLeg) B.lLeg.rotation.x = -s * 0.75;
        if (B.rLeg) B.rLeg.rotation.x = s * 0.75;
        if (B.spine) B.spine.rotation.x = 0.12;
        body.position.y = Math.abs(s) * 0.08;
      } else {
        if (B.lArm) B.lArm.rotation.x *= 0.85;
        if (B.rArm) B.rArm.rotation.x *= 0.85;
        if (B.lLeg) B.lLeg.rotation.x *= 0.85;
        if (B.rLeg) B.rLeg.rotation.x *= 0.85;
        if (B.spine) B.spine.rotation.x = Math.sin(t * 2.4) * 0.03;
        if (B.neck) B.neck.rotation.x = Math.sin(t * 1.7) * 0.04;
        body.position.y = Math.sin(t * 2.4) * 0.04 + (onGround ? 0 : -0.05);
      }
      vrm.update(dt);
    } else {
      // punch animation: right arm windmill over 0.3s
      if (punchTime >= 0) {
        punchTime += dt;
        const p = Math.min(1, punchTime / 0.3);
        arms[1].rotation.x = -Math.sin(p * Math.PI) * 2.2;
        body.position.z = Math.sin(p * Math.PI) * 0.15;
        if (p >= 1) { punchTime = -1; arms[1].rotation.x = 0; body.position.z = 0; }
      } else if (running && onGround) {
        const s = Math.sin(t * 14);
        arms[0].rotation.x = s * 0.9; arms[1].rotation.x = -s * 0.9;
        body.position.y = Math.abs(Math.sin(t * 14)) * 0.12;
        dress.rotation.y = s * 0.08;
      } else {
        arms[0].rotation.x *= 0.85; arms[1].rotation.x *= 0.85;
        body.position.y = Math.sin(t * 2.4) * 0.05 + 0.02;
      }
      tails.forEach((tail, i) => { tail.rotation.x = Math.sin(t * 3 + i) * 0.18 - (onGround ? 0 : 0.5); });
    }
    // sit on top of your buddy while riding (applied after the animation sets body.y)
    body.position.y += rideLift;

    // collectibles (descending so splice-on-pickup is safe)
    const head = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    for (let i = collect.length - 1; i >= 0; i--) {
      const c = collect[i];
      c.mesh.rotation.y += dt * 2;
      const d = c.mesh.position.distanceTo(head);
      // Spark Magnet: nearby sparks drift toward Miru
      if (MAGNET > 0 && d < 5) c.mesh.position.lerp(head, Math.min(1, dt * 3.5));
      if (d < c.r + MAGNET) {
        burst(c.mesh.position, c.mesh.material.color);
        scene.remove(c.mesh);
        collect.splice(i, 1);
        if (c.kind === 'petal') {
          progress.treasures = (progress.treasures || 0) + 1;
          say(L('A moonpetal! Treasure #{n} for your journal!', { n: progress.treasures }));
          chime(1240);
        } else {
          chime(c.kind === 'seed' ? 880 : c.kind === 'ring' ? 740 : 990);
        }
        if (navigator.vibrate) navigator.vibrate(12);
        // seeds sometimes hide a berry — food to feed your buddies
        if (c.kind === 'seed' && Math.random() < 0.28) {
          progress.berries = (progress.berries || 0) + 1;
          burst(c.mesh ? head.clone() : head, 0xff6a8a, 6);
          if (pets.length) tip('berry', L('You found a berry! Feed it to a buddy in the 🐾 panel.'));
        }
        addSparks(c.worth);
      }
    }

    // minimap, refreshed a few times a second (cheap, but no need every frame)
    if ((mapTick += dt) > 0.12) { mapTick = 0; drawMap(); }

    // Skykeeper: gentle float + talk when near
    skykeeper.position.y = Math.sin(t * 1.4) * 0.15 + 0.05;
    skykeeper.rotation.y = Math.sin(t * 0.5) * 0.3;
    const dK = Math.hypot(player.position.x - skykeeper.position.x, player.position.z - skykeeper.position.z);
    const nearK = dK < 3.2;
    if (talkBtn) talkBtn.style.display = nearK ? 'flex' : 'none';
    if (nearK) tip('keeper', isTouch ? L('Tap TALK to speak with the Skykeeper!') : L('Press E to talk to the Skykeeper!'));
    if (interactPressed) { if (nearK) talkSkykeeper(); else careForBuddy(); }
    interactPressed = false;
    if (petPressed) { careForBuddy(); petPressed = false; }

    // show the RIDE button when a buddy is close enough to hop on
    if (rideBtn) {
      const np = riding ? riding : nearestPet(4);
      rideBtn.style.display = np ? 'flex' : 'none';
      if (np) rideBtn.textContent = riding ? L('HOP OFF') : (np.level >= RIDE_LEVEL ? L('RIDE') : 'Lv' + np.level + '/' + RIDE_LEVEL);
    }
    // nudge toward the wings goal only for buddies that aren't there yet
    if (riding && !riding.wings) tip('wings', L('Keep petting {name} — at Lv 8 they grow wings and can fly!', { name: riding.name }));

    // contextual first-run tips
    if (progress.sparks >= 6) tip('build', L('Press B (or the Build button) to decorate your island!'));
    if (airTime > 0.7) tip('glide', L('Hold jump while falling to glide gently down!'));
    for (const s of slimes) {
      if (!s.alive) continue;
      if (Math.hypot(s.g.position.x - player.position.x, s.g.position.z - player.position.z) < 4.5) {
        tip('slime', L('Stand close to a slime and stay kind — it will become your friend!'));
        break;
      }
    }
    refreshQuestHud();

    // befriend: linger next to a wild slime (without punching) and it joins you
    if (punchTime < 0) {
      let near = null, nd = 1.8;
      for (const s of slimes) {
        if (!s.alive) continue;
        const dd = Math.hypot(s.g.position.x - player.position.x, s.g.position.z - player.position.z);
        if (dd < nd) { nd = dd; near = s; }
      }
      if (near) {
        bondT += dt;
        if (Math.random() < 0.16) burst(near.g.position.clone().add(new THREE.Vector3(0, 0.75, 0)), 0xff9ec6, 3);
        if (bondT > 0.8) { befriend(near); bondT = 0; }
      } else bondT = 0;
    } else bondT = 0;

    // build placement indicator
    if (buildMode) {
      const tp = targetBuildPoint();
      if (tp) { ghost.position.set(tp.x, tp.y + 0.06, tp.z); ghost.visible = true; ghost.rotation.z += dt * 1.5; }
      else ghost.visible = false;
    }

    // breadcrumb trail so buddies follow in a conga line
    trail.unshift(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
    if (trail.length > 260) trail.pop();
    for (let i = 0; i < pets.length; i++) {
      const p = pets[i];
      // the buddy you are riding carries you instead of trailing behind
      if (p === riding) {
        p.g.position.set(player.position.x, player.position.y + 0.1, player.position.z);
        p.g.rotation.y = body.rotation.y;
        p.g.scale.setScalar(1.5 + (p.level - 1) * 0.09);
        const bob = Math.abs(Math.sin(t * 6)) * (running ? 0.14 : 0.05);
        p.g.position.y += bob;
        p.blob.scale.set(1 + bob, 0.82 - bob * 0.5, 1 + bob);
        if (p.wings) {
          const flap = Math.sin(t * (onGround ? 6 : 16));
          p.wings.children[0].rotation.y = 0.9 + flap * 0.5;
          p.wings.children[1].rotation.y = -0.9 - flap * 0.5;
        }
        continue;
      }
      const target = trail[Math.min(trail.length - 1, (i + 1) * 18)] || player.position;
      p.g.position.x += (target.x - p.g.position.x) * Math.min(1, dt * 6);
      p.g.position.z += (target.z - p.g.position.z) * Math.min(1, dt * 6);
      const gh = groundHeight(p.g.position.x, p.g.position.z);
      const baseY = (gh > -Infinity ? gh : target.y) + 0.4;
      const hop = Math.abs(Math.sin(t * 4 + p.phase));
      if (p.careBounce > 0) p.careBounce = Math.max(0, p.careBounce - dt * 2);
      p.g.position.y = baseY + hop * 0.35 + (p.careBounce || 0) * 0.5;
      // happiness drifts down very slowly; happy buddies hop a touch higher and sparkle
      if (p.happy === undefined) p.happy = 60;
      p.happy = Math.max(0, p.happy - dt * 0.25);
      if (p.happy > 75 && Math.random() < dt * 0.6) burst(p.g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xfff2c0, 2);
      p.g.scale.setScalar((1 + (p.level - 1) * 0.11) * (1 + (p.happy - 60) / 600));
      p.blob.scale.set(1 + (1 - hop) * 0.12, 0.82 - (1 - hop) * 0.12, 1 + (1 - hop) * 0.12);
      const dx = target.x - p.g.position.x, dz = target.z - p.g.position.z;
      if (dx * dx + dz * dz > 0.02) p.g.rotation.y = Math.atan2(dx, dz);
    }
  }

  // pickup sparkles
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt;
    const pos = b.pts.geometry.attributes.position;
    for (let j = 0; j < b.vel.length; j++) {
      b.vel[j].y -= 9 * dt;
      pos.setXYZ(j, pos.getX(j) + b.vel[j].x * dt, pos.getY(j) + b.vel[j].y * dt, pos.getZ(j) + b.vel[j].z * dt);
    }
    pos.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, b.life / 0.8);
    if (b.life <= 0) { scene.remove(b.pts); bursts.splice(i, 1); }
  }

  // orbit camera around player using yaw/pitch/distance
  if (started) {
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const ox = Math.sin(camYaw) * cp * camDist;
    const oz = Math.cos(camYaw) * cp * camDist;
    const target = new THREE.Vector3(
      player.position.x + ox,
      player.position.y + 1.6 + sp * camDist,
      player.position.z + oz
    );
    // camera collision: never sink below the island the camera hovers over
    const cgh = groundHeight(target.x, target.z);
    if (cgh > -Infinity && target.y < cgh + 0.7) target.y = cgh + 0.7;
    // camera collision: pull in if a tree/decoration sits between head and camera
    const head = new THREE.Vector3(player.position.x, player.position.y + 1.6, player.position.z);
    const toCam = target.clone().sub(head);
    const wantDist = toCam.length();
    if (wantDist > 0.01) {
      camRay.set(head, toCam.multiplyScalar(1 / wantDist));
      camRay.far = wantDist;
      const hits = camRay.intersectObjects(scene.children, true);
      for (const h of hits) {
        if (camRayBlocks(h.object)) {
          // sit just IN FRONT of the obstacle — never farther, or the camera would
          // end up inside/behind it and render the mesh interior (a full-screen blob).
          // a small floor keeps it from jamming into the player (now modestly dressed).
          const d = Math.min(wantDist, Math.max(1.6, h.distance - 0.4));
          target.copy(head).addScaledVector(camRay.ray.direction, d);
          break;
        }
      }
    }
    camera.position.lerp(target, 0.35);
  } else {
    camera.position.set(Math.sin(t * 0.15) * 22, 10, Math.cos(t * 0.15) * 22);
  }
  camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);

  renderer.render(scene, camera);
}
animate();
