import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// ---------- basics ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
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
scene.add(new THREE.HemisphereLight(0xbfe8ff, 0x7fbf6a, 0.9));

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
  { name: 'Meadow Isles',  grass: 0x6fce4e, tuft: 0x8fe06a, dirt: 0x9a6b4f, leaf: 0xff9ec6, sky: 0x8fd0f5, fog: 0xa8ddf8 },
  { name: 'Sunset Grove',  grass: 0xe0a24e, tuft: 0xf3c06a, dirt: 0x8a5540, leaf: 0xff8f6a, sky: 0xf6c98f, fog: 0xf8dcc0 },
  { name: 'Snow Isles',    grass: 0xdfeaf2, tuft: 0xffffff, dirt: 0x8fa6b9, leaf: 0xbfe0ff, sky: 0xcfe8ff, fog: 0xe6f4ff },
  { name: 'Starfall Isles',grass: 0x454a7a, tuft: 0x7f88e0, dirt: 0x2a2f45, leaf: 0x9ad0ff, sky: 0x2e3360, fog: 0x3a4070 },
  { name: 'Candy Reef',    grass: 0xff9ec6, tuft: 0xffc2dd, dirt: 0xc06a9a, leaf: 0xa06bf0, sky: 0xffd6ef, fog: 0xffe0f2 },
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
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (r - 0.6);
    m.makeRotationY(rand() * Math.PI);
    m.setPosition(Math.cos(a) * d, 0.25, Math.sin(a) * d);
    inst.setMatrixAt(i, m);
  }
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
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0),
    new THREE.MeshToonMaterial({ color: isl.biome.leaf }));
  leaf.position.set(ox, 3.1, oz); leaf.castShadow = true;
  isl.group.add(trunk, leaf);
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
      neck: h.getNormalizedBoneNode('neck')
    };
    if (vrmBones.lArm) vrmBones.lArm.rotation.z = 1.15;
    if (vrmBones.rArm) vrmBones.rArm.rotation.z = -1.15;
    say('Miru has arrived!');
  }, undefined, err => console.warn('VRM load failed, keeping placeholder', err));
}

// ---------- slimes (boppable, harmless) ----------
const slimes = [];
const slimeColors = [0x7fe8c9, 0xffd98a, 0xff9ec6, 0xa0c8ff];
function makeSlime(isl, ox, oz, rand) {
  const g = new THREE.Group();
  const col = slimeColors[Math.floor((rand ? rand() : Math.random()) * slimeColors.length)];
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12),
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
    g, blob, isl, alive: true, respawn: 0,
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
function addSeed(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), seedMat);
  s.position.set(isl.x + ox, isl.y + 1, isl.z + oz);
  s.add(new THREE.PointLight(0xffe98a, 0.6, 4));
  scene.add(s);
  const c = { mesh: s, kind: 'seed', r: 1.1, worth: 1 };
  collect.push(c); isl.collect.push(c);
}
function addStar(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4), starMat);
  s.position.set(isl.x + ox, isl.y + 1.2, isl.z + oz);
  scene.add(s);
  const c = { mesh: s, kind: 'star', r: 1.2, worth: 3 };
  collect.push(c); isl.collect.push(c);
}
function addRing(isl, ox, oz) {
  const s = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 10, 28), ringMat);
  s.position.set(isl.x + ox, isl.y + 2.2, isl.z + oz);
  scene.add(s);
  const c = { mesh: s, kind: 'ring', r: 1.4, worth: 2 };
  collect.push(c); isl.collect.push(c);
}

let bops = 0;

let msgTimer;
function say(text) {
  const el = $('msg');
  el.textContent = text; el.classList.add('show');
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

let ac;
function chime(freq) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.4);
  } catch (e) { /* audio unavailable */ }
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
let progress = { sparks: 0, unlocked: [], biomes: [] };
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) progress = Object.assign(progress, JSON.parse(raw)); } catch (e) { /* storage blocked */ }
function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked */ } }

function nextUnlock() { return UNLOCKS.find(u => !progress.unlocked.includes(u.id)); }
function refreshGoal() {
  const nu = nextUnlock();
  const spEl = $('cSpark'); if (spEl) spEl.textContent = progress.sparks;
  const gEl = $('nextGoal'), inEl = $('nextIn');
  if (nu) { if (gEl) gEl.textContent = nu.name; if (inEl) inEl.textContent = Math.max(0, nu.at - progress.sparks); }
  else { if (gEl) gEl.textContent = 'Sky Explorer'; if (inEl) inEl.textContent = '∞'; }
}
function applyUnlock(u, announce) {
  u.apply();
  if (!progress.unlocked.includes(u.id)) progress.unlocked.push(u.id);
  if (announce) {
    say(u.msg); chime(1180);
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
  const ns = rand() < 0.6 ? 1 : (rand() < 0.5 ? 0 : 2);
  for (let i = 0; i < ns; i++) { const [x, z] = spot(); makeSlime(isl, x, z, rand); }
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
  const count = rand() < 0.68 ? 1 : (rand() < 0.55 ? 0 : 2);
  for (let i = 0; i < count; i++) {
    const x = cx * CELL + (rand() - 0.5) * CELL * 0.6;
    const z = cz * CELL + (rand() - 0.5) * CELL * 0.6;
    const y = (rand() - 0.5) * 9;
    const r = 4 + rand() * 5;
    const isl = makeIsland(x, y, z, r, biomeFor(x, z), rand);
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
    say('You reached the ' + b.name + '!');
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

function makePet(color, level, name) {
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
  const pet = { g, blob, color, level: level || 1, xp: 0, name: name || PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)], phase: Math.random() * 6 };
  pets.push(pet);
  return pet;
}

function updateBuddyHud() {
  const el = $('cBuddy');
  if (el) el.textContent = pets.length ? pets.length + (pets.length > 1 ? ' friends' : ' friend') : 'none yet';
}
function savePets() { progress.pets = pets.map(p => ({ level: p.level, color: p.color, name: p.name })); saveProgress(); }

function befriend(slime) {
  let gi = slimes.indexOf(slime); if (gi >= 0) slimes.splice(gi, 1);
  gi = slime.isl.slimes.indexOf(slime); if (gi >= 0) slime.isl.slimes.splice(gi, 1);
  const color = slime.blob.material.color.getHex();
  scene.remove(slime.g);
  slime.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
  const pet = makePet(color, 1);
  heartBurst(pet.g.position); chime(1240);
  say(pet.name + ' is your friend now!');
  savePets(); updateBuddyHud();
}

function grantPetXp(n) {
  if (!pets.length) return;
  for (const p of pets) {
    p.xp += n;
    const need = p.level * 8;
    if (p.xp >= need && p.level < 8) { p.xp -= need; p.level++; heartBurst(p.g.position); chime(1320); say(p.name + ' grew to Lv ' + p.level + '!'); }
  }
  savePets(); updateBuddyHud();
}

// bring back buddies made in a past session
if (Array.isArray(progress.pets)) for (const p of progress.pets) makePet(p.color, p.level, p.name);
updateBuddyHud();

// ---------- input ----------
const keys = {};
let jumpPressed = false, punchPressed = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyF' || e.code === 'KeyE') punchPressed = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });

// --- free-look camera state ---
let camYaw = 0, camPitch = 0.32, camDist = 9;
const isTouch = matchMedia('(pointer:coarse)').matches;

// desktop: pointer lock mouse-look; click while locked = punch
renderer.domElement.addEventListener('click', () => {
  if (!started) return;
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  } else {
    punchPressed = true;
  }
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  camYaw -= e.movementX * 0.0028;
  camPitch = Math.min(1.15, Math.max(-0.35, camPitch + e.movementY * 0.0022));
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
    camYaw -= (t.clientX - lastTX) * 0.006;
    camPitch = Math.min(1.15, Math.max(-0.35, camPitch + (t.clientY - lastTY) * 0.004));
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
  chime(660);
  say(isTouch ? 'Drag the right side to look around!' : 'Click the world to grab the camera!');
});

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
      bops++;
      const bopEl = $('cBop'); if (bopEl) bopEl.textContent = bops;
      chime(1040);
      say(['Boing! Got one!', 'Slime bopped!', 'Pow! It giggled away.'][bops % 3]);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

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

    const speed = (keys.ShiftLeft || keys.ShiftRight) ? SPRINT : WALK;
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

    if (jumpPressed) {
      if (onGround) { vel.y = JUMP; jumps = 1; chime(520); }
      else if (jumps < MAXJUMPS) { vel.y = JUMP * 0.9; jumps++; chime(560 + jumps * 40); }
    }
    jumpPressed = false;

    if (punchPressed && punchTime < 0) doPunch(t);
    punchPressed = false;

    vel.y += GRAV * dt;
    if (vel.y < 0 && keys.Space) vel.y = Math.max(vel.y, GLIDE);

    player.position.x += vel.x * dt;
    player.position.z += vel.z * dt;
    player.position.y += vel.y * dt;

    // stream new islands in / far ones out, and greet new biomes
    ensureChunks(player.position.x, player.position.z);
    checkBiome(player.position.x, player.position.z);
    // ease sky + fog toward the current biome so each region feels distinct
    const bh = biomeFor(player.position.x, player.position.z);
    scene.background.lerp(skyTmp.setHex(bh.sky), dt * 0.8);
    scene.fog.color.lerp(fogTmp.setHex(bh.fog), dt * 0.8);

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

    if (player.position.y < -25) {
      player.position.copy(spawn).add(new THREE.Vector3(0, 6, 0));
      vel.set(0, 0, 0);
      say('Whoops! The wind carried you back.');
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
        chime(c.kind === 'seed' ? 880 : c.kind === 'ring' ? 740 : 990);
        addSparks(c.worth);
      }
    }

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

    // breadcrumb trail so buddies follow in a conga line
    trail.unshift(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
    if (trail.length > 260) trail.pop();
    for (let i = 0; i < pets.length; i++) {
      const p = pets[i];
      const target = trail[Math.min(trail.length - 1, (i + 1) * 18)] || player.position;
      p.g.position.x += (target.x - p.g.position.x) * Math.min(1, dt * 6);
      p.g.position.z += (target.z - p.g.position.z) * Math.min(1, dt * 6);
      const gh = groundHeight(p.g.position.x, p.g.position.z);
      const baseY = (gh > -Infinity ? gh : target.y) + 0.4;
      const hop = Math.abs(Math.sin(t * 4 + p.phase));
      p.g.position.y = baseY + hop * 0.35;
      p.g.scale.setScalar(1 + (p.level - 1) * 0.11);
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
    camera.position.lerp(target, 0.35);
  } else {
    camera.position.set(Math.sin(t * 0.15) * 22, 10, Math.cos(t * 0.15) * 22);
  }
  camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);

  renderer.render(scene, camera);
}
animate();
