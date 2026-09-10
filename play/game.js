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

// one soft radial-gradient texture, reused by the sun and by collectible halos.
// a flat disc with a hard rim reads as a pale sticker over the world; a gradient fades out.
function radialGlowTex(innerStop) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(innerStop, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sunTex = radialGlowTex(0.28);

// a soft sun disc + halo high in the sky, so there is a warm focal point
const sunSprite = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshBasicMaterial({ map: sunTex, color: 0xfff6e0, transparent: true, opacity: 0.75, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
);
const sunGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 46),
  new THREE.MeshBasicMaterial({ map: sunTex, color: 0xffe9b8, transparent: true, opacity: 0.22, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
);
sunSprite.renderOrder = -1; sunGlow.renderOrder = -1;
// backdrop only — must never register as an obstacle for camera or build raycasts
sunSprite.raycast = () => {}; sunGlow.raycast = () => {}; skyDome.raycast = () => {};
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
  // solids: the props a child can bump into or stand on. Kept per-island in world
  // coordinates so despawning an island takes its colliders with it, and so the physics
  // step never has to walk the scene graph.
  const isl = { x, z, y, r, group: g, biome, collect: [], slimes: [], solids: [] };
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
  // A pillar looks like a platform, so it has to behave like one. Children jumped at these
  // and dropped straight through, which is most of what "lantai tembus" was describing.
  isl.solids.push({ x: isl.x + ox, z: isl.z + oz, r: 0.95, top: isl.y + h + 0.5, stand: true });
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
  // the trunk stops you; the canopy does not, so a jump still clears the tree
  isl.solids.push({ x: isl.x + ox, z: isl.z + oz, r: 0.5, top: isl.y + 2.2, stand: false });
}

// ---------- houses you can actually walk into ----------
// A building you cannot enter is scenery wearing a costume, and QA said so: "template
// rumah rumahan yang tidak bisa dimasuki". Every house placed by this function has a door
// that leads to a real room. The walls are solid, so the only way in is the doorway.
const doors = [];
function makeHouse(isl, ox, oz, rot = 0) {
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  g.rotation.y = rot;
  const wallMat = new THREE.MeshToonMaterial({ color: 0xf2e4cf });
  const roofMat = new THREE.MeshToonMaterial({ color: 0xc4593f });
  const woodMat = new THREE.MeshToonMaterial({ color: 0x7a4a30 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3, 4.2), wallMat);
  body.position.y = 1.5; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.1, 4), roofMat);
  roof.position.y = 4.05; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  // the doorway is a dark recess, not a painted-on rectangle: it reads as somewhere to go
  const doorway = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x2a1d16 }));
  doorway.position.set(0, 1.05, 2.15); g.add(doorway);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.18), woodMat);
  frame.position.set(0, 1.2, 2.06); g.add(frame);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  lamp.position.set(0.95, 2.4, 2.2); g.add(lamp);
  lamp.add(glowSprite(0xffd9a0, 1.6));
  for (const dx of [-1.35, 1.35]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.15),
      new THREE.MeshToonMaterial({ color: 0x9ad8ff }));
    win.position.set(dx, 1.9, 2.12); g.add(win);
  }
  isl.group.add(g);
  // The house body blocks, but the doorway must not, or the child bounces off their own
  // front door. Two half-walls with a gap between them, rotated with the house.
  const c = Math.cos(rot), sn = Math.sin(rot);
  const world = (lx, lz) => [isl.x + ox + lx * c + lz * sn, isl.z + oz - lx * sn + lz * c];
  for (const [lx, lz] of [[-1.5, 0], [1.5, 0], [0, -1.6]]) {
    const [wx, wz] = world(lx, lz);
    isl.solids.push({ x: wx, z: wz, r: 1.5, top: isl.y + 3, stand: false });
  }
  const [dxw, dzw] = world(0, 2.4);
  return addDoor(isl, dxw, dzw, 'house', ox.toFixed(1));
}

// Every way in registers the same way, so the frame loop only has to know about `doors`
// and never about what kind of building it is standing in front of.
function addDoor(isl, wx, wz, kind, tag) {
  const door = { x: wx, z: wz, y: isl.y, r: 1.5, isl, kind,
    key: kind + ':' + isl.x.toFixed(1) + ':' + tag };
  doors.push(door);
  isl.doors = isl.doors || [];
  isl.doors.push(door);
  return door;
}

// QA asked for "mode dalam gua, mode dalam gunung, mode dalam arena perang". Three more
// entrances, each leading to a real room rather than to a texture of a room.
function makeCaveMouth(isl, ox, oz) {
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  const rockMat = new THREE.MeshToonMaterial({ color: 0x74707e });
  const mossMat = new THREE.MeshToonMaterial({ color: 0x5f8f52 });
  // a boulder pile with a dark hole in it, not a decal: the opening is real geometry set
  // back from the rock so it reads as depth from every angle a child will look at it
  for (const [bx, by, bz, br] of [[-1.9, 0.7, 0, 1.5], [1.9, 0.8, 0, 1.6], [0, 2.1, -0.3, 1.9]]) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(br, 0), rockMat);
    b.position.set(bx, by, bz); b.rotation.set(bx, by, bz);
    b.castShadow = true; b.receiveShadow = true; g.add(b);
  }
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 2.3, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x120f1c, side: THREE.DoubleSide }));
  mouth.rotation.x = Math.PI / 2; mouth.position.set(0, 1.15, 0.9); g.add(mouth);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1.1, 12),
    new THREE.MeshBasicMaterial({ color: 0x0d0b14 }));
  cap.position.set(0, 1.15, -0.3); g.add(cap);
  for (const [mx, mz] of [[-1.6, 1.1], [1.7, 1.0]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mossMat);
    m.position.set(mx, 0.25, mz); m.scale.y = 0.4; g.add(m);
  }
  // a crystal glimmer at the lip, so the hole invites rather than just sits there
  const gleam = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0),
    new THREE.MeshBasicMaterial({ color: 0x9ad0ff }));
  gleam.position.set(0.8, 1.9, 1.0); g.add(gleam);
  gleam.add(glowSprite(0x9ad0ff, 1.5));
  isl.group.add(g);
  // the boulders are solid; the gap in the middle is the way in
  for (const [sx, sz] of [[-1.9, 0], [1.9, 0], [0, -0.6]]) {
    isl.solids.push({ x: isl.x + ox + sx, z: isl.z + oz + sz, r: 1.35, top: isl.y + 2.6, stand: false });
  }
  return addDoor(isl, isl.x + ox, isl.z + oz + 1.9, 'cave', ox.toFixed(1));
}

function makeMountain(isl, ox, oz) {
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  const stoneMat = new THREE.MeshToonMaterial({ color: isl.biome.dirt });
  const snowMat = new THREE.MeshToonMaterial({ color: 0xeef6ff });
  const peak = new THREE.Mesh(new THREE.ConeGeometry(4.6, 9.5, 7), stoneMat);
  peak.position.y = 4.75; peak.castShadow = true; peak.receiveShadow = true; g.add(peak);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.1, 7), snowMat);
  snow.position.y = 8.0; g.add(snow);
  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.4, 6), stoneMat);
  shoulder.position.set(3.0, 2.2, 1.1); shoulder.castShadow = true; g.add(shoulder);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 2.6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x161320, side: THREE.DoubleSide }));
  tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 1.3, 3.4); g.add(tunnel);
  const back = new THREE.Mesh(new THREE.CircleGeometry(1.15, 12),
    new THREE.MeshBasicMaterial({ color: 0x100e18 }));
  back.position.set(0, 1.3, 2.2); g.add(back);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 0.6),
    new THREE.MeshToonMaterial({ color: 0x8b8478 }));
  lintel.position.set(0, 2.75, 3.5); g.add(lintel);
  isl.group.add(g);
  // the mountain body is solid all round except the tunnel mouth on the +z side
  for (const [sx, sz] of [[-2.6, 0.4], [2.6, 0.4], [0, -2.4], [-2.2, 2.4], [2.2, 2.4]]) {
    isl.solids.push({ x: isl.x + ox + sx, z: isl.z + oz + sz, r: 1.7, top: isl.y + 5, stand: false });
  }
  return addDoor(isl, isl.x + ox, isl.z + oz + 4.1, 'mountain', ox.toFixed(1));
}

function makeArenaGate(isl, ox, oz) {
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  const stoneMat = new THREE.MeshToonMaterial({ color: 0xbfae90 });
  const trimMat = new THREE.MeshToonMaterial({ color: 0xd8a441 });
  for (const px of [-1.9, 1.9]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 4.4, 12), stoneMat);
    col.position.set(px, 2.2, 0); col.castShadow = true; g.add(col);
    const capital = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 1.7), trimMat);
    capital.position.set(px, 4.5, 0); g.add(capital);
    // a banner on each post, because a gate with no colour reads as rubble
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.1),
      new THREE.MeshToonMaterial({ color: px < 0 ? 0xe8574a : 0x4a8fe8, side: THREE.DoubleSide }));
    flag.position.set(px, 3.1, 0.5); g.add(flag);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.7, 1.1), stoneMat);
  arch.position.y = 5.0; arch.castShadow = true; g.add(arch);
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), trimMat);
  crest.position.y = 5.7; g.add(crest);
  crest.add(glowSprite(0xffd9a0, 2.0));
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.2),
    new THREE.MeshBasicMaterial({ color: 0x1a1526, side: THREE.DoubleSide }));
  dark.position.set(0, 2.1, -0.35); g.add(dark);
  isl.group.add(g);
  for (const px of [-1.9, 1.9]) {
    isl.solids.push({ x: isl.x + ox + px, z: isl.z + oz, r: 0.9, top: isl.y + 4.4, stand: false });
  }
  return addDoor(isl, isl.x + ox, isl.z + oz + 1.4, 'arena', ox.toFixed(1));
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
// collectible halos reuse the same soft radial falloff as the sun (bloom-lite)
const glowTex = radialGlowTex(0.35);
function glowSprite(color, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0.85, fog: false
  }));
  sp.scale.setScalar(size);
  // purely decorative: never let a halo block build placement or the camera ray
  sp.raycast = () => {};
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
  // the Sparkles dial rides here: at 0 a burst is a single puff, at 1.5 it is a shower
  count = Math.max(1, Math.round(count * fxScale()));
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
const savedSettings = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })();
const settings = Object.assign({
  music: 0.5, sfx: 0.8, quality: 'high', sensitivity: 1, invert: false,
  contrast: false, bigText: false, lang: 'id', tut: {},
  // graphics, each one adjustable on its own; touching any of them flips quality to 'custom'
  renderScale: 1, shadows: 'soft', viewDist: 180, effects: 1, fpsCap: 0, showFps: false,
  autoAdjust: true, keys: {}, view: 'tpp'
}, savedSettings);
setLang(settings.lang);
translateDom();
document.documentElement.lang = settings.lang;
function applyA11y() {
  document.body.classList.toggle('hiContrast', !!settings.contrast);
  document.body.classList.toggle('bigText', !!settings.bigText);
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* blocked */ } }
// Five presets, the way every big game ships them. A preset is just a bundle of the
// individual dials below it — pick one and the dials move; move a dial and you are on
// 'custom', which is the only honest label at that point.
const QUALITY_PRESETS = {
  potato: { renderScale: 0.6,  shadows: 'off',   viewDist: 90,  effects: 0.25, fpsCap: 30 },
  low:    { renderScale: 0.8,  shadows: 'off',   viewDist: 120, effects: 0.5,  fpsCap: 0 },
  medium: { renderScale: 1,    shadows: 'soft',  viewDist: 150, effects: 0.75, fpsCap: 0 },
  high:   { renderScale: 1,    shadows: 'soft',  viewDist: 180, effects: 1,    fpsCap: 0 },
  ultra:  { renderScale: 1.35, shadows: 'sharp', viewDist: 300, effects: 1.4,  fpsCap: 0 }
};
function applyPreset(name) {
  const p = QUALITY_PRESETS[name];
  if (!p) return;
  Object.assign(settings, p);
  settings.quality = name;
}
// a save written before the dials existed only knows 'high' or 'low'; expand it into the
// matching preset so the sliders open showing what the child is actually running.
if (!('renderScale' in savedSettings)) applyPreset(QUALITY_PRESETS[settings.quality] ? settings.quality : 'high');
// First run on a phone should not open on Pretty and then visibly stumble down to Fast.
// Guess low and let the child turn it up — a game that starts smooth reads as a better
// game than one that starts pretty and stutters.
if (!savedSettings.quality) {
  const mem = navigator.deviceMemory || 8;
  const modest = mem <= 4 || (matchMedia('(pointer:coarse)').matches && (navigator.hardwareConcurrency || 8) <= 6);
  applyPreset(modest ? 'medium' : 'high');
}
// how many particles a burst/sparkle should spawn right now — every effect scales off this
function fxScale() { return settings.effects; }
function applyQuality() {
  const s = settings;
  renderer.setPixelRatio(Math.max(0.5, Math.min(devicePixelRatio * s.renderScale, 3)));
  const shadowsOn = s.shadows !== 'off';
  renderer.shadowMap.enabled = shadowsOn;
  renderer.shadowMap.type = s.shadows === 'sharp' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  sun.castShadow = shadowsOn;
  const mapSize = s.shadows === 'sharp' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== mapSize) {
    sun.shadow.mapSize.set(mapSize, mapSize);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  // build the world out to match what the child can see, then keep the fog just inside
  // that edge so islands fade in rather than pop in
  const wantGen = streamRadiusFor(s.viewDist);
  if (wantGen !== GEN_R) {
    GEN_R = wantGen; KEEP_R = GEN_R + 1;
    restream();
  }
  const far = Math.min(s.viewDist, fogLimit());
  scene.fog.far = far;
  scene.fog.near = far * 0.34;
  // the camera has to out-reach the fog or islands get clipped before they fade
  camera.far = Math.max(400, far * 1.5);
  camera.updateProjectionMatrix();
  document.body.classList.toggle('showFps', !!s.showFps);
  saveSettings();
}
// push the live settings back into the panel, so a preset pick or an auto-adjust shows up
// on every slider instead of leaving the panel lying about what is running.
function syncGraphicsUI() {
  const s = settings, set = (id, v) => { const el = $(id); if (el) el.value = v; };
  const txt = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('setQuality', s.quality);
  set('setScale', s.renderScale); txt('setScaleV', Math.round(s.renderScale * 100) + '%');
  set('setShadows', s.shadows);
  set('setView', s.viewDist); txt('setViewV', s.viewDist);
  set('setFx', s.effects); txt('setFxV', Math.round(s.effects * 100) + '%');
  set('setFpsCap', String(s.fpsCap));
  const sf = $('setShowFps'); if (sf) sf.checked = !!s.showFps;
  const sa = $('setAuto'); if (sa) sa.checked = !!s.autoAdjust;
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
let progress = { sparks: 0, unlocked: [], biomes: [], treasures: 0, shinies: 0, bops: 0, wonders: [], quest: { i: 0, base: null }, wardrobe: { hat: 'none', cape: 'none', outfit: 'dress' }, berries: 0, seeds: 0, energy: 5, skins: [], dungeonsCleared: 0, energyAt: 0, waypoints: [], riftTier: 1, badges: [] };
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) progress = Object.assign(progress, JSON.parse(raw)); } catch (e) { /* storage blocked */ }
function saveProgress() {
  checkBadges();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* storage blocked */ }
  syncServer();
}

// ---------- badges ----------
// The plainest achievement system there is: a fixed list, each with a test against the save.
// The game already counted every one of these things and showed the child a bare number in
// the journal. A number is not a reward — a named badge with a moment attached is.
const BADGES = [
  { id: 'firstfriend', icon: '🐾', name: 'First Friend',   desc: 'Befriend your first buddy',      at: p => (p.pets || []).length >= 1 },
  { id: 'pack',        icon: '🐾', name: 'Whole Pack',     desc: 'Befriend five buddies',          at: p => (p.pets || []).length >= 5 },
  { id: 'wanderer',    icon: '🗺️', name: 'Wanderer',       desc: 'Discover three regions',         at: p => (p.biomes || []).length >= 3 },
  { id: 'cartograph',  icon: '🧭', name: 'Map Maker',      desc: 'Unlock three waypoints',         at: p => (p.waypoints || []).length >= 3 },
  { id: 'builder',     icon: '🔨', name: 'Builder',        desc: 'Place twenty decorations',       at: p => (p.builds || []).length >= 20 },
  { id: 'gardener',    icon: '🌸', name: 'Moon Gardener',  desc: 'Find ten moonpetals',            at: p => (p.treasures || 0) >= 10 },
  { id: 'shiny',       icon: '✨', name: 'Shiny Hunter',   desc: 'Befriend a shiny slime',         at: p => (p.shinies || 0) >= 1 },
  { id: 'diver',       icon: '🌀', name: 'Rift Diver',     desc: 'Clear your first rift',          at: p => (p.dungeonsCleared || 0) >= 1 },
  { id: 'deepdiver',   icon: '🌀', name: 'Deep Diver',     desc: 'Reach rift depth three',         at: p => (p.riftTier || 1) >= 3 },
  { id: 'abyss',       icon: '👑', name: 'Abyss Walker',   desc: 'Reach the deepest rift',         at: p => (p.riftTier || 1) >= 5 },
  { id: 'listener',    icon: '✦',  name: 'Good Listener',  desc: 'Finish every Skykeeper quest',   at: p => (p.quest ? p.quest.i : 0) >= QUESTS.length },
  { id: 'explorer',    icon: '🪽', name: 'Sky Explorer',   desc: 'Unlock everything',              at: p => (p.unlocked || []).length >= UNLOCKS.length }
];

function checkBadges() {
  try { awardBadges(); } catch (e) { /* start-up: BADGES or the player not built yet */ }
}
function awardBadges() {
  if (!progress.badges) progress.badges = [];
  for (const b of BADGES) {
    if (progress.badges.includes(b.id)) continue;
    let earned = false;
    try { earned = b.at(progress); } catch (e) { earned = false; }
    if (!earned) continue;
    progress.badges.push(b.id);
    // the moment matters more than the list — say it, sparkle it, sound it
    say(L('Badge earned: {name}!', { name: L(b.name) }));
    chime(1320);
    burst(new THREE.Vector3(player.position.x, player.position.y + 2, player.position.z), 0xffe08a, 26);
  }
}

function renderBadges() {
  const box = $('jBadges'); if (!box) return;
  const got = progress.badges || [];
  box.innerHTML = '';
  for (const b of BADGES) {
    const on = got.includes(b.id);
    const d = document.createElement('div');
    d.className = 'badge' + (on ? ' on' : '');
    // never colour-only: a locked badge says so in words for screen readers and for
    // anyone who cannot tell the greyed one from the earned one
    d.innerHTML = '<span class="bIco">' + (on ? b.icon : '🔒') + '</span>' +
      '<span class="bName">' + L(b.name) + '</span>' +
      '<span class="bDesc">' + L(b.desc) + '</span>';
    d.setAttribute('role', 'listitem');
    d.setAttribute('aria-label', L(b.name) + ' — ' + L(b.desc) + ' — ' + L(on ? 'earned' : 'locked'));
    box.appendChild(d);
  }
  const c = $('jBadgeCount');
  if (c) c.textContent = got.length + ' / ' + BADGES.length;
}

// The family board. Twelve children play the same game on twelve phones and until now had no
// idea the others existed. This shows who is playing and one goal they add up to together —
// the shared bar is deliberately first, so the ranking below reads as "we did this", not "I lost".
let familyBusy = false;
function setFamilyNote(msg) {
  const box = $('jFamily'); if (!box) return;
  box.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'jNote'; p.style.cssText = 'font-size:12.5px;color:#6b5f4d;padding:8px 4px;line-height:1.4;';
  p.textContent = msg;
  box.appendChild(p);
}
async function loadFamily() {
  const box = $('jFamily'); if (!box || familyBusy) return;
  familyBusy = true;
  setFamilyNote(L('Looking for the others…'));
  try {
    const r = await fetch('/api/board', { credentials: 'include' });
    if (!r.ok) throw new Error('board ' + r.status);
    renderFamily(await r.json());
  } catch (e) {
    // offline or playing as a guest — say which, plainly, instead of showing an empty box
    setFamilyNote(L('Cannot see the others right now. Sign in and reconnect to the internet.'));
    const bar = $('jGoalFill'); if (bar) bar.style.width = '0%';
    const num = $('jGoalNum'); if (num) num.textContent = '';
  } finally { familyBusy = false; }
}
function renderFamily(d) {
  const box = $('jFamily'); if (!box) return;
  const goal = d.goal || 1, total = d.total || 0;
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const fill = $('jGoalFill'); if (fill) fill.style.width = pct + '%';
  const num = $('jGoalNum');
  if (num) num.textContent = total.toLocaleString() + ' / ' + goal.toLocaleString() + ' ✦';
  const bar = $('jGoalBar');
  if (bar) {
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(goal));
    bar.setAttribute('aria-valuenow', String(total));
    bar.setAttribute('aria-label', L('Family goal') + ' — ' + pct + '%');
  }
  box.innerHTML = '';
  const players = d.players || [];
  if (!players.length) { setFamilyNote(L('Nobody else has started playing yet.')); return; }
  players.forEach((p, i) => {
    const mine = p.username === d.me;
    const row = document.createElement('div');
    row.className = 'fRow' + (mine ? ' me' : '');
    row.setAttribute('role', 'listitem');
    const pos = document.createElement('span'); pos.className = 'fPos'; pos.textContent = (i + 1) + '.';
    const nm = document.createElement('span'); nm.className = 'fName'; nm.textContent = p.username;
    const b = document.createElement('b'); b.textContent = (p.sparks || 0).toLocaleString() + ' ✦';
    row.append(pos, nm);
    if (mine) { const me = document.createElement('span'); me.className = 'fMe'; me.textContent = L('you'); row.appendChild(me); }
    row.appendChild(b);
    row.setAttribute('aria-label', (i + 1) + '. ' + p.username + (mine ? ' (' + L('you') + ')' : '') +
      ' — ' + (p.sparks || 0) + ' ' + L('Sparks'));
    box.appendChild(row);
  });
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
const CELL = 44;
// How far the world is actually built, in cells. This USED TO BE a fixed 3 (132 units)
// while the fog drew to 180, so whole islands — trees, pillars and all — blinked into
// existence a third of the way inside the visible range every time the player crossed a
// cell boundary. That is the "building masih hilang muncul" report. The streamed radius
// now follows the view distance, and applyQuality() pulls the fog in behind it so the
// boundary is always hidden in haze instead of appearing in clear air.
let GEN_R = 3, KEEP_R = 4;
function streamRadiusFor(viewDist) {
  return Math.max(3, Math.min(6, Math.round((viewDist + CELL / 2) / CELL)));
}
// the furthest the fog may reach without exposing the edge of the built world
function fogLimit() { return GEN_R * CELL - 30; }
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
  // a cottage on the roomier islands, always one you can go inside
  if (r > 6 && rand() < 0.45) { const [x, z] = spot(); makeHouse(isl, x, z, rand() * Math.PI * 2); }
  // ...and the other three ways in. Each one is placed where it belongs rather than
  // sprinkled evenly: caves in the rocky and crystal biomes, peaks on the big islands,
  // and an arena rare enough that finding one is an event.
  const rocky = isl.biome === BIOMES[6] || isl.biome === BIOMES[2] || isl.biome === BIOMES[8];
  if (r > 7 && rand() < (rocky ? 0.5 : 0.18)) { const [x, z] = spot(); makeCaveMouth(isl, x, z); }
  if (r > 9 && rand() < 0.3) { const [x, z] = spot(); makeMountain(isl, x, z); }
  if (r > 10 && rand() < 0.14) { const [x, z] = spot(); makeArenaGate(isl, x, z); }
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
    // landmarks: a rift gate to enter a dungeon, and a waypoint to travel back to.
    // Both are keyed off the cell hash, so the same cell always holds the same landmark.
    if (i === 0 && !isWonder) {
      if (hash2(cx * 13 + 7, cz * 17 + 1) % 11 === 0) makeRiftGate(isl);
      else if (hash2(cx * 5 - 9, cz * 23 + 4) % 9 === 0) makeWaypoint(isl, cx, cz);
    }
    list.push(isl);
  }
}

// ---------- world landmarks: rift gates and waypoints ----------
// Standard open-world furniture: a gate you walk into to start a dungeon, and a waypoint
// you touch once to unlock fast travel back to it.
const gates = [], waypoints = [];

function makeRiftGate(isl) {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0x8f7fd0 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.28, 8, 24), mat);
  arch.position.y = 2.0; arch.castShadow = true; g.add(arch);
  // The portal reads as a *hole*, not a lamp. An additive disc over the pale daytime sky
  // saturates to white and looks like a grey sticker pasted behind the arch (this was the
  // exact bug a screenshot caught). So: a dark indigo disc for contrast, with a small
  // additive swirl on top for the glow. Dark-on-light is what makes it legible to a child.
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1.62, 28),
    new THREE.MeshBasicMaterial({
      color: 0x241a4a, transparent: true, opacity: 0.88, fog: false,
      depthWrite: false, side: THREE.DoubleSide
    }));
  portal.position.y = 2.0; portal.raycast = () => {}; g.add(portal);
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.45, 24),
    new THREE.MeshBasicMaterial({
      map: glowTex, color: 0x7fd0ff, transparent: true, opacity: 0.55, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
  swirl.position.set(0, 2.0, 0.02); swirl.raycast = () => {}; g.add(swirl);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.1, 7), mat);
    leg.position.set(s * 1.72, 1.05, 0); leg.castShadow = true; g.add(leg);
  }
  // small, dim rim halo — a 4.5-unit one blew out into a giant pale square over the sky
  const halo = glowSprite(0xa8c8ff, 2.4);
  halo.material.opacity = 0.45; halo.position.y = 2.0; g.add(halo);
  g.position.set(isl.x, isl.y, isl.z);
  scene.add(g);
  isl.gate = { x: isl.x, y: isl.y, z: isl.z, group: g, portal, swirl };
  gates.push(isl.gate);
}

function makeWaypoint(isl, cx, cz) {
  const g = new THREE.Group();
  const stone = new THREE.MeshToonMaterial({ color: 0xd9d2c4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.5, 0.4, 10), stone);
  base.position.y = 0.2; base.receiveShadow = true; g.add(base);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 2.6, 8), stone);
  pillar.position.y = 1.6; pillar.castShadow = true; g.add(pillar);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6),
    new THREE.MeshBasicMaterial({ color: 0x8fd0f5 }));
  crystal.position.y = 3.4; g.add(crystal);
  const halo = glowSprite(0x8fd0f5, 3);
  halo.position.y = 3.4; g.add(halo);
  g.position.set(isl.x, isl.y, isl.z);
  scene.add(g);
  const name = (isl.biome && isl.biome.name ? isl.biome.name : 'Waypoint') + ' ' + cx + ',' + cz;
  isl.waypoint = { x: isl.x, y: isl.y, z: isl.z, name, group: g, crystal, halo };
  waypoints.push(isl.waypoint);
  refreshWaypointLook(isl.waypoint);
}

function isWaypointOn(w) {
  return (progress.waypoints || []).some(p => Math.abs(p.x - w.x) < 0.5 && Math.abs(p.z - w.z) < 0.5);
}

// dormant waypoints are dull grey; activated ones glow blue
function refreshWaypointLook(w) {
  const on = isWaypointOn(w);
  w.crystal.material.color.set(on ? 0x8fd0f5 : 0x9aa0ab);
  w.halo.visible = on;
}

function despawnIsland(isl) {
  if (isl.gate) {
    scene.remove(isl.gate.group);
    const gi = gates.indexOf(isl.gate); if (gi >= 0) gates.splice(gi, 1);
  }
  if (isl.waypoint) {
    scene.remove(isl.waypoint.group);
    const wi = waypoints.indexOf(isl.waypoint); if (wi >= 0) waypoints.splice(wi, 1);
  }
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
  for (const d of isl.doors || []) { const di = doors.indexOf(d); if (di >= 0) doors.splice(di, 1); }
  const ii = islands.indexOf(isl); if (ii >= 0) islands.splice(ii, 1);
}

let lastCX = 1e9, lastCZ = 1e9;
// force the next ensureChunks to do a full pass — used when the streamed radius changes
function restream() { lastCX = 1e9; lastCZ = 1e9; }
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

// Nearest buddy in range, but a ride-ready one always wins over a smaller one:
// with a Lv8 friend and a brand-new Lv1 friend both nearby, pressing R should ride,
// not refuse because the little one happened to be a step closer.
function nearestPet(maxDist) {
  let best = null, bd = maxDist;          // best ride-ready buddy
  let any = null, ad = maxDist;           // best buddy of any level
  for (const p of pets) {
    const d = Math.hypot(p.g.position.x - player.position.x, p.g.position.z - player.position.z);
    if (d < ad) { ad = d; any = p; }
    if (p.level >= RIDE_LEVEL && d < bd) { bd = d; best = p; }
  }
  return best || any;
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
  progress = Object.assign({ sparks: 0, unlocked: [], biomes: [], pets: [], builds: [], treasures: 0, shinies: 0, bops: 0, wonders: [], quest: { i: 0, base: null }, wardrobe: { hat: 'none', cape: 'none', outfit: 'dress' }, berries: 0, seeds: 0, energy: 5, skins: [], dungeonsCleared: 0, energyAt: 0, waypoints: [], riftTier: 1, badges: [] }, p);
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
    berries: num('berries'), fed: num('fed'),
    // shop economy: keep the larger purse, the fuller energy, and every skin ever bought
    seeds: num('seeds'),
    energy: Math.max(a.energy ?? 5, b.energy ?? 5),
    skins: union('skins'),
    dungeonsCleared: num('dungeonsCleared'),
    energyAt: Math.max(a.energyAt || 0, b.energyAt || 0),
    waypoints: longer('waypoints'),
    riftTier: num('riftTier') || 1,
    // a badge earned on either device is earned, full stop — never take one back
    badges: union('badges'),
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
  const jr = $('jRifts'); if (jr) jr.textContent = progress.dungeonsCleared || 0;
  checkBadges(); renderBadges();
  el.classList.add('on');
  loadFamily();
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
    treasures: progress.treasures || 0,
    rifts: progress.dungeonsCleared || 0,
    waypoints: (progress.waypoints || []).length,
    fed: progress.fed || 0
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
  // Six was a day's work for a fast child, and then the Skykeeper had nothing left to say.
  // These six lean on the parts of the world that came later: rifts, waypoints, buddies.
  { give: 'The isles crack open sometimes — a rift. Step into one and clear what waits inside.',
    done: 'You came back from a rift! Not everyone does that on the first try.', reward: 20,
    prog: b => L('{n}/1 rift', { n: Math.min(1, (progress.dungeonsCleared || 0) - (b.rifts || 0)) }),
    ok: b => (progress.dungeonsCleared || 0) - (b.rifts || 0) >= 1 },
  { give: 'Standing stones remember you. Wake 3 of them so you never have to walk the long way again.',
    done: 'Three stones humming. The sky is smaller for you now.', reward: 20,
    prog: b => L('{n}/3 waypoints', { n: Math.min(3, (progress.waypoints || []).length - (b.waypoints || 0)) }),
    ok: b => (progress.waypoints || []).length - (b.waypoints || 0) >= 3 },
  { give: 'A buddy who eats well grows strong. Feed your slimes 5 berries.',
    done: 'Look how bright they are! You are a good friend.', reward: 20,
    prog: b => L('{n}/5 berries', { n: Math.min(5, (progress.fed || 0) - (b.fed || 0)) }),
    ok: b => (progress.fed || 0) - (b.fed || 0) >= 5 },
  { give: 'Gather 5 buddies around you — a whole little troop.',
    done: 'A troop of your own! They follow you everywhere now.', reward: 25,
    prog: b => L('{n}/5 buddies', { n: Math.min(5, pets.length) }),
    ok: () => pets.length >= 5 },
  { give: 'Go deeper. There is a rift down at depth three, and it is not gentle.',
    done: 'Depth three, and you walked out. The old gardeners would be proud.', reward: 30,
    prog: b => L('{n}/3 depth', { n: Math.min(3, progress.riftTier || 1) }),
    ok: () => (progress.riftTier || 1) >= 3 },
  { give: 'Last one, truly. Find 10 moonpetals and the isles will remember your name forever.',
    done: 'Ten moonpetals. You are a Sky Explorer, and this garden is yours. Thank you, little gardener.', reward: 50,
    prog: () => L('{n}/10 moonpetals', { n: Math.min(10, progress.treasures || 0) }),
    ok: () => (progress.treasures || 0) >= 10 },
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
  progress.fed = (progress.fed || 0) + 1; // the Skykeeper asks for this later on
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

// A slime befriended by accident used to be permanent. This is the way out — framed as
// sending it home rather than deleting it, and it asks first, because a child will tap it
// by mistake at least once.
function releaseBuddy(pet) {
  if (!confirm(L('Send {name} home? You can befriend another slime any time.', { name: pet.name }))) return;
  const i = pets.indexOf(pet); if (i < 0) return;
  pets.splice(i, 1);
  heartBurst(pet.g.position);
  scene.remove(pet.g);
  pet.g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !o.material.userData.shared) o.material.dispose();
  });
  chime(660);
  say(L('{name} went home happy. 👋', { name: pet.name }));
  savePets(); updateBuddyHud(); renderBuddyPanel();
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
    const go = document.createElement('button'); go.className = 'bdBtn go'; go.textContent = L('Send home');
    go.setAttribute('aria-label', L('Send home') + ' — ' + p.name);
    go.addEventListener('click', () => releaseBuddy(p));
    row.appendChild(rn); row.appendChild(fd); row.appendChild(go);
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
  // landmarks: rift gates and waypoints, so they can be spotted from a distance
  for (const g of gates) { const [gx, gy] = toXY(g.x, g.z); mapCtx.fillText('🌀', gx, gy); }
  for (const w of waypoints) { const [wx, wy] = toXY(w.x, w.z); mapCtx.fillText(isWaypointOn(w) ? '🔷' : '🔹', wx, wy); }
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
    { id: 'star',   name: 'Starlight Robe', need: () => (progress.wonders || []).length >= 1, req: 'Find a Great Tree' },
    // bought in the Seed Shop with Seeds earned in game (never with real money)
    { id: 'aurora',  name: 'Aurora Skin',  need: () => ownsSkin('aurora'),  req: 'Buy in the Seed Shop' },
    { id: 'lantern', name: 'Lantern Skin', need: () => ownsSkin('lantern'), req: 'Buy in the Seed Shop' },
    { id: 'comet',   name: 'Comet Skin',   need: () => ownsSkin('comet'),   req: 'Buy in the Seed Shop' }
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
    star:   { body: 0x8f8ff0, skirt: 0x6f6fd8, trim: 0xfff2a0 },
    aurora:  { body: 0x7fe8d0, skirt: 0x5fc9c0, trim: 0xdfffff },
    lantern: { body: 0xffb066, skirt: 0xef8f4a, trim: 0xfff0c0 },
    comet:   { body: 0x5f6f9f, skirt: 0x46527a, trim: 0xa8d8ff }
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
      const worn = cur === item.id;
      b.textContent = (worn ? '✓ ' : ok ? '' : '🔒 ') + L(item.name);
      b.title = ok ? L(item.name) : L('Locked — {req}', { req: L(item.req) });
      // never colour-only: "worn" and "locked" are both said in words for a screen reader
      b.setAttribute('aria-pressed', worn ? 'true' : 'false');
      b.setAttribute('aria-label', L(item.name) + ' — ' +
        (ok ? L(worn ? 'worn' : 'not worn') : L('Locked — {req}', { req: L(item.req) })));
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

// ---------- Seed Shop ----------
// Seeds are earned by playing; there is no way to buy them with real money. The open
// world costs nothing — Seeds only pay for looks and for optional dungeon trips.
const ENERGY_MAX = 5;
const REFILL_COST = 12;
const SHOP_SKINS = [
  { id: 'aurora',  name: 'Aurora Skin',  price: 30 },
  { id: 'lantern', name: 'Lantern Skin', price: 45 },
  { id: 'comet',   name: 'Comet Skin',   price: 60 }
];

function ownsSkin(id) { return (progress.skins || []).includes(id); }

// Energy refills on its own, the way stamina/resin does in every open-world game:
// one point per interval, tracked by timestamp so it keeps ticking while the game is
// closed. Paying Seeds is only ever a shortcut, never the only way back up.
const ENERGY_REGEN_MS = 6 * 60 * 1000;

function tickEnergy() {
  const now = Date.now();
  let e = progress.energy ?? ENERGY_MAX;
  if (e >= ENERGY_MAX) { progress.energyAt = now; return; }
  if (!progress.energyAt) progress.energyAt = now;
  const gained = Math.floor((now - progress.energyAt) / ENERGY_REGEN_MS);
  if (gained > 0) {
    const before = e;
    e = Math.min(ENERGY_MAX, e + gained);
    progress.energy = e;
    progress.energyAt = e >= ENERGY_MAX ? now : progress.energyAt + gained * ENERGY_REGEN_MS;
    if (e > before) { updateShopHud(); saveProgress(); }
  }
}

// milliseconds until the next energy point, or 0 when full
function energyEta() {
  if ((progress.energy ?? ENERGY_MAX) >= ENERGY_MAX) return 0;
  return Math.max(0, (progress.energyAt || Date.now()) + ENERGY_REGEN_MS - Date.now());
}

function etaText() {
  const ms = energyEta();
  if (!ms) return '';
  const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
  return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

function updateShopHud() {
  const s = $('cSeed'); if (s) s.textContent = progress.seeds || 0;
  const e = $('cEnergy');
  if (e) e.textContent = (progress.energy ?? ENERGY_MAX) + '/' + ENERGY_MAX;
  const ss = $('shopSeeds'); if (ss) ss.textContent = progress.seeds || 0;
  const se = $('shopEnergy');
  if (se) se.textContent = (progress.energy ?? ENERGY_MAX) + '/' + ENERGY_MAX;
  const et = $('shopEta');
  if (et) et.textContent = energyEta() ? L('next in {t}', { t: etaText() }) : L('full');
}

// ---------- purchases ----------
// Two paths on purpose.
//
// Logged in, the server is the authority: it holds the prices, checks the balance and
// moves it, and writes a receipt on Solana devnet. A child editing `seeds` in devtools
// then buying a crown gets a 402, because the shop the client draws is not the shop the
// server bills. Twelve children will absolutely try this.
//
// Logged out -- the static host, a school tablet with no account yet, devnet having an
// afternoon -- the game still works exactly as it always has, locally. A shop that only
// works when the network does is a shop that is closed when a child gets home.
let lastReceipt = null;
function serverBuy(item, onLocal) {
  if (!serverUser) { onLocal(); return; }
  fetch('/api/buy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item })
  }).then(r => r.json().then(d => ({ ok: r.ok, status: r.status, d })))
    .then(({ ok, status, d }) => {
      if (!ok) {
        if (status === 402) say(L('Not enough Seeds yet — keep exploring!'));
        else if (status === 409) say(L('You already own that one.'));
        else onLocal();   // an unknown server problem must not cost a child their purchase
        return;
      }
      // take the server's word for what was bought, rather than guessing alongside it
      progress.seeds = d.seeds;
      if (Array.isArray(d.skins)) progress.skins = d.skins;
      if (typeof d.energy === 'number') progress.energy = d.energy;
      saveProgress(); updateShopHud(); renderShop();
      lastReceipt = d.receipt || null;
      showReceipt(d.receipt, d.receiptNote);
    })
    .catch(() => onLocal());   // offline: fall back rather than swallowing the purchase
}

// An on-chain receipt is only worth showing if a person can click it and land on the
// explorer looking at their own transaction. Anything less is a badge that says "trust me".
function showReceipt(receipt, note) {
  const box = $('shopReceipt');
  if (!box) return;
  if (receipt && receipt.explorer) {
    box.innerHTML = '';
    const a = document.createElement('a');
    a.href = receipt.explorer;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = L('View receipt on Solana devnet ↗');
    box.appendChild(a);
    const small = document.createElement('div');
    small.className = 'receiptNote';
    small.textContent = L('Devnet only — no real money.');
    box.appendChild(small);
    box.style.display = 'block';
  } else if (note) {
    box.textContent = '';
    box.style.display = 'none';
  }
}

function buyRefill() {
  const cost = REFILL_COST;
  if ((progress.energy ?? ENERGY_MAX) >= ENERGY_MAX) { say(L('Your energy is already full.')); return; }
  if ((progress.seeds || 0) < cost) { say(L('Not enough Seeds yet — keep exploring!')); return; }
  serverBuy('refill', buyRefillLocal);
}
function buyRefillLocal() {
  const cost = REFILL_COST;
  progress.seeds -= cost;
  progress.energy = Math.min(ENERGY_MAX, (progress.energy ?? ENERGY_MAX) + 1);
  saveProgress(); chime(980); updateShopHud(); renderShop();
  say(L('Energy refilled! {n} left in the purse.', { n: progress.seeds }));
}

function buySkin(item) {
  if (ownsSkin(item.id)) { say(L('You already own that one.')); return; }
  if ((progress.seeds || 0) < item.price) { say(L('Not enough Seeds yet — keep exploring!')); return; }
  serverBuy(item.id, () => buySkinLocal(item));
}
function buySkinLocal(item) {
  progress.seeds -= item.price;
  progress.skins = [...(progress.skins || []), item.id];
  saveProgress(); chime(1180); updateShopHud(); renderShop();
  burst(player.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 0xffe08a, 18);
  say(L('{name} unlocked! Put it on in the 👒 wardrobe.', { name: L(item.name) }));
}

function shopRow(label, priceText, btnLabel, enabled, onBuy, owned) {
  const row = document.createElement('div');
  row.className = 'shopRow' + (owned ? ' owned' : '');
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = label;
  const pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = priceText;
  row.append(nm, pr);
  if (!owned) {
    const b = document.createElement('button');
    b.className = 'shopBuy'; b.textContent = btnLabel;
    if (enabled) b.addEventListener('click', onBuy);
    else { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    row.appendChild(b);
  }
  return row;
}

function renderShop() {
  updateShopHud();
  const eBox = $('shopEnergyBox');
  if (eBox) {
    eBox.innerHTML = '';
    const full = (progress.energy ?? ENERGY_MAX) >= ENERGY_MAX;
    const afford = (progress.seeds || 0) >= REFILL_COST;
    eBox.appendChild(shopRow(
      L('Refill 1 energy'),
      full ? L('Full') : REFILL_COST + ' 🌰',
      L('Refill'), !full && afford, buyRefill, false
    ));
  }
  const sBox = $('shopSkinBox');
  if (sBox) {
    sBox.innerHTML = '';
    for (const item of SHOP_SKINS) {
      const owned = ownsSkin(item.id);
      sBox.appendChild(shopRow(
        L(item.name),
        owned ? L('Owned') : item.price + ' 🌰',
        L('Buy'), (progress.seeds || 0) >= item.price, () => buySkin(item), owned
      ));
    }
  }
}

// keep energy (and the shop countdown) honest while the tab is open
tickEnergy();
setInterval(() => {
  tickEnergy();
  const sh = $('shop');
  if (sh && sh.classList.contains('on')) { updateShopHud(); }
}, 1000);

function openShop() { renderShop(); const el = $('shop'); if (el) el.classList.add('on'); }
function closeShop() { const el = $('shop'); if (el) el.classList.remove('on'); }
const shopBtn = $('shopBtn');
if (shopBtn) shopBtn.addEventListener('click', openShop);
const shopCloseBtn = $('shopClose');
if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);
updateShopHud();

// ---------- Sky Rift dungeons ----------
// A dungeon is a calm collection challenge, not a fight: no enemies, no timer, no way to
// lose. It sits far outside the streamed world so entering never disturbs the open world;
// chunk streaming is frozen while inside and the player is teleported straight back out.
const DUNGEON_X = 100000, DUNGEON_Z = 100000;
const DUNGEON_CRYSTALS = 6;
const RIFT_TIER_MAX = 5;
let inDungeon = false;
let dungeonGroup = null, dungeonIsland = null;
let dungeonFound = 0, dungeonReturn = null, dungeonChest = null;
let dungeonNeed = DUNGEON_CRYSTALS, dungeonTier = 1;
let gatePrompted = null;

// Deeper tiers ask for more crystals, spread them over a different shape, and pay more.
// Ordinary difficulty tiers — the same ladder every open-world game uses.
function riftPlan(tier) {
  const t = Math.max(1, Math.min(RIFT_TIER_MAX, tier | 0));
  return {
    tier: t,
    need: 4 + t * 2,                       // 6, 8, 10, 12, 14
    reward: 15 + t * 10,                   // 25, 35, 45, 55, 65
    layout: ['ring', 'spiral', 'double', 'scatter', 'tower'][t - 1],
    radius: 13 + t
  };
}

// Where each crystal sits, per layout. Only the floor is standable — pillars are scenery —
// so every crystal is kept inside jump-and-reach height. Variety lives in the floor plan,
// not in vertical platforming the collision system cannot support.
const RIFT_Y_MIN = 1.6, RIFT_Y_MAX = 3.0;
function riftPositions(plan) {
  const out = [], R = plan.radius;
  const y = f => RIFT_Y_MIN + (RIFT_Y_MAX - RIFT_Y_MIN) * f;
  for (let i = 0; i < plan.need; i++) {
    const f = i / plan.need, a = f * Math.PI * 2;
    if (plan.layout === 'ring') out.push([Math.cos(a) * (R - 4), y((i % 3) / 2), Math.sin(a) * (R - 4)]);
    else if (plan.layout === 'spiral') {
      const rr = 3 + f * (R - 5);
      out.push([Math.cos(a * 1.6) * rr, y(f), Math.sin(a * 1.6) * rr]);
    } else if (plan.layout === 'double') {
      const inner = i % 2 === 0, rr = inner ? R * 0.42 : R - 3.5;
      out.push([Math.cos(a) * rr, y(inner ? 1 : 0), Math.sin(a) * rr]);
    } else if (plan.layout === 'scatter') {
      const rr = 4 + ((i * 37) % 90) / 90 * (R - 6);
      out.push([Math.cos(a * 2.3) * rr, y(((i * 53) % 5) / 4), Math.sin(a * 2.3) * rr]);
    } else { // 'tower': a tight helix you circle on foot
      out.push([Math.cos(a * 2) * (R * 0.55), y((i % 4) / 3), Math.sin(a * 2) * (R * 0.55)]);
    }
  }
  return out;
}

function clearDungeon() {
  if (dungeonGroup) {
    dungeonGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.userData.shared) o.material.dispose();
    });
    scene.remove(dungeonGroup);
  }
  dungeonGroup = null; dungeonChest = null;
  // drop any dungeon pickups still lying around
  for (let i = collect.length - 1; i >= 0; i--) {
    if (collect[i].kind === 'dcrystal') { scene.remove(collect[i].mesh); collect.splice(i, 1); }
  }
  if (dungeonIsland) {
    const ix = islands.indexOf(dungeonIsland);
    if (ix >= 0) islands.splice(ix, 1);
    dungeonIsland = null;
  }
}

function buildDungeon(plan) {
  const g = new THREE.Group();
  g.position.set(DUNGEON_X, 0, DUNGEON_Z);
  const R = plan.radius;
  // each tier gets its own palette so deeper runs read as a different place
  const tone = [0x6a5f9a, 0x5f7a9a, 0x7a5f8a, 0x5f9a7a, 0x9a6f5f][plan.tier - 1];
  const trim = [0x8f7fd0, 0x7fa8d0, 0xb07fc0, 0x7fd0a8, 0xd0a07f][plan.tier - 1];
  const floorMat = new THREE.MeshToonMaterial({ color: tone });
  const rimMat = new THREE.MeshToonMaterial({ color: trim });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.9, 1.2, 32), floorMat);
  floor.position.y = -0.6; floor.receiveShadow = true; g.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.5, 8, 40), rimMat);
  rim.rotation.x = Math.PI / 2; g.add(rim);
  // A wall, because a cave without one is a disc floating in the dark: the child walked
  // straight off the edge and fell out of the room. That is the "dungeon tembus" report.
  // Open-topped and rendered from the inside, so the camera still looks down into the room.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.5, R + 0.5, 9, 32, 1, true),
    new THREE.MeshToonMaterial({ color: tone, side: THREE.BackSide }));
  wall.position.y = 4.2; g.add(wall);
  // a glowing core in the middle so the room always has a warm focal point
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: 0x9ad8ff }));
  core.position.y = 3.4; g.add(core);
  core.add(new THREE.PointLight(0x9ad8ff, 1.4, 26));
  core.add(glowSprite(0x9ad8ff, 6));
  // a pillar under every crystal, placed by this tier's layout
  const riftSolids = [];
  for (const [px, py, pz] of riftPositions(plan)) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, py, 8), rimMat);
    p.position.set(px, py / 2, pz); p.castShadow = true; g.add(p);
    // the pillars are climbable platforms, not scenery you stroll through
    riftSolids.push({ x: DUNGEON_X + px, z: DUNGEON_Z + pz, r: 0.9, top: py, stand: true });
    const cm = new THREE.Mesh(new THREE.OctahedronGeometry(0.45),
      new THREE.MeshBasicMaterial({ color: 0xa8f0ff }));
    cm.position.set(DUNGEON_X + px, py + 0.9, DUNGEON_Z + pz);
    cm.add(glowSprite(0xa8f0ff, 2.2));
    scene.add(cm);
    collect.push({ mesh: cm, kind: 'dcrystal', r: 1.3, worth: 2 });
  }
  scene.add(g);
  dungeonGroup = g;
  // register as ground so the existing collision keeps Miru standing on the floor
  // `solids` is not optional — the ground and collision code walks it on every island,
  // and the room used to ship without one.
  dungeonIsland = { x: DUNGEON_X, z: DUNGEON_Z, y: 0, r: R, group: g,
    biome: BIOMES[6], collect: [], slimes: [], solids: riftSolids, wall: R };
  islands.push(dungeonIsland);
}

// ---------- interiors ----------
// Built the same way the rift is: a room parked far outside the streamed world, so the
// outside world never has to be torn down to show an inside. Reusing that machinery means
// interiors inherit the collision, camera and streaming behaviour that is already tested.
const HOUSE_X = 200000, HOUSE_Z = 200000;
let insideHouse = false, houseGroup = null, houseIsland = null, houseReturn = null;
let insideKind = 'house';
let nearDoorKind = 'house';
// Four rooms, one machine. Each entry says how big the room is, where you arrive, what
// it is called and how to furnish it; everything else -- collision, the camera, the way
// out, the streaming -- is the code the cottage already proved.
const INTERIORS = {
  house: {
    R: 5.2, spawnZ: 3.4,
    enter: 'ENTER', msg: 'You are inside. Make yourself at home!',
    tip: 'Tap ENTER to go inside the house!'
  },
  cave: {
    R: 7.6, spawnZ: 5.6,
    enter: 'GO IN', msg: 'Inside the cave. The crystals are glowing!',
    tip: 'Tap GO IN to explore the cave!'
  },
  mountain: {
    R: 8.4, spawnZ: 6.4,
    enter: 'CLIMB IN', msg: 'Inside the mountain. Climb the ledges to the top!',
    tip: 'Tap CLIMB IN to go inside the mountain!'
  },
  arena: {
    R: 9.2, spawnZ: 7.0,
    enter: 'ENTER ARENA', msg: 'The arena! Stand on the podium and take a bow.',
    tip: 'Tap ENTER ARENA to step into the arena!'
  }
};

// ---- the cottage: a hearth, a bed, a table ----
function furnishHouse(g, R, solid) {
  const floorMat = new THREE.MeshToonMaterial({ color: 0x9a7350 });
  const wallMat = new THREE.MeshToonMaterial({ color: 0xf6ead5, side: THREE.BackSide });
  const woodMat = new THREE.MeshToonMaterial({ color: 0x7a4a30 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.6, R * 2), floorMat);
  floor.position.y = -0.3; floor.receiveShadow = true; g.add(floor);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 6, R * 2), wallMat);
  walls.position.y = 2.7; g.add(walls);
  const hearth = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 0.8),
    new THREE.MeshToonMaterial({ color: 0x8a8f96 }));
  hearth.position.set(0, 0.7, -R + 0.5); g.add(hearth);
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshBasicMaterial({ color: 0xffa34a }));
  fire.position.set(0, 0.9, -R + 0.9); g.add(fire);
  fire.add(glowSprite(0xffb45c, 3.2));
  fire.add(new THREE.PointLight(0xffb45c, 1.8, 22));
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.16, 14), woodMat);
  table.position.set(1.6, 0.95, 1.2); table.castShadow = true; g.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.95, 8), woodMat);
  leg.position.set(1.6, 0.47, 1.2); g.add(leg);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.6),
    new THREE.MeshToonMaterial({ color: 0xd8e6f2 }));
  bed.position.set(-3.2, 0.25, -0.6); bed.castShadow = true; g.add(bed);
  const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.5),
    new THREE.MeshToonMaterial({ color: 0xff9ec6 }));
  quilt.position.set(-3.2, 0.58, 0.1); g.add(quilt);
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.05, 20),
    new THREE.MeshToonMaterial({ color: 0xa06bf0 }));
  rug.position.set(0, 0.03, 0.8); g.add(rug);
  g.add(new THREE.HemisphereLight(0xfff0d8, 0x6a5340, 0.85));
  solid(1.6, 1.2, 1.15, 1.03, true);
  solid(-3.2, -0.6, 1.1, 0.5, true);
  solid(0, -R + 0.5, 1.1, 1.4, false);
}

// ---- the cave: stalagmites you walk around, crystals that light the room ----
function furnishCave(g, R, solid) {
  const rockMat = new THREE.MeshToonMaterial({ color: 0x4a4358 });
  const floorMat = new THREE.MeshToonMaterial({ color: 0x3a3348 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 26), floorMat);
  floor.position.y = -0.3; floor.receiveShadow = true; g.add(floor);
  // a rounded shell rather than a box: caves are not rooms with square corners
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshToonMaterial({ color: 0x4a4358, side: THREE.BackSide }));
  g.add(shell);
  const CRYSTALS = [[3.4, -2.2, 0xa48fe0], [-4.1, 1.6, 0x8fd0ff], [1.2, 4.6, 0xff9ec6],
                    [-2.4, -4.4, 0x9affd0]];
  for (const [cx, cz, col] of CRYSTALS) {
    const cl = new THREE.Group(); cl.position.set(cx, 0, cz);
    for (let i = 0; i < 3; i++) {
      const h = 1.1 + (i % 2) * 0.8;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.3, h, 6),
        new THREE.MeshBasicMaterial({ color: col }));
      sh.position.set((i - 1) * 0.42, h / 2, (i % 2) * 0.3);
      sh.rotation.z = (i - 1) * 0.16; cl.add(sh);
    }
    cl.add(glowSprite(col, 3.4));
    const lamp = new THREE.PointLight(col, 1.5, 16); lamp.position.y = 1.4; cl.add(lamp);
    g.add(cl);
    solid(cx, cz, 0.85, 1.9, false);
  }
  // stalactites hanging from the roof -- no collision, they are above head height
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, d = 1.6 + (i % 3) * 1.7;
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.5 + (i % 3) * 0.6, 6), rockMat);
    st.position.set(Math.cos(a) * d, 4.6, Math.sin(a) * d);
    st.rotation.x = Math.PI; g.add(st);
  }
  // a rock you can climb onto, so the cave is somewhere to play and not just to look at
  const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), rockMat);
  boulder.position.set(-1.4, 0.5, 0.4); boulder.castShadow = true; g.add(boulder);
  solid(-1.4, 0.4, 1.45, 1.45, true);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.0, 22),
    new THREE.MeshBasicMaterial({ color: 0x3f7fa8, transparent: true, opacity: 0.75 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(3.2, 0.03, 2.4); g.add(pool);
  g.add(new THREE.HemisphereLight(0x8fa8d8, 0x241f38, 0.42));
}

// ---- the mountain: a hollow peak with a spiral of ledges up to the daylight ----
function furnishMountain(g, R, solid) {
  const stoneMat = new THREE.MeshToonMaterial({ color: 0x6f7a86 });
  const ledgeMat = new THREE.MeshToonMaterial({ color: 0x8b9aa8 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 28), stoneMat);
  floor.position.y = -0.3; floor.receiveShadow = true; g.add(floor);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 20, 28, 1, true),
    new THREE.MeshToonMaterial({ color: 0x6f7a86, side: THREE.BackSide }));
  shaft.position.y = 9.5; g.add(shaft);
  // a spiral of standable ledges. This is the one interior that is a climb rather than a
  // room, which is rather the point of putting one inside a mountain.
  for (let i = 0; i < 8; i++) {
    const a = i * 0.85, d = R - 2.1, y = 1.2 + i * 1.35;
    const lx = Math.cos(a) * d, lz = Math.sin(a) * d;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 2.2), ledgeMat);
    slab.position.set(lx, y, lz); slab.rotation.y = -a;
    slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    solid(lx, lz, 1.25, y + 0.22, true);
  }
  // daylight from the open summit, so "up" reads as somewhere to go
  const sky = new THREE.Mesh(new THREE.CircleGeometry(3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xdfeeff }));
  sky.rotation.x = Math.PI / 2; sky.position.y = 19.2; g.add(sky);
  sky.add(glowSprite(0xdfeeff, 9));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.0, 18, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14,
      side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 10; g.add(beam);
  const top = new THREE.PointLight(0xdfeeff, 1.6, 40); top.position.y = 16; g.add(top);
  g.add(new THREE.HemisphereLight(0xdfeeff, 0x5a6470, 0.7));
}

// ---- the arena: a ring, a podium, four braziers ----
function furnishArena(g, R, solid) {
  const sandMat = new THREE.MeshToonMaterial({ color: 0xdcc38b });
  const stoneMat = new THREE.MeshToonMaterial({ color: 0xbfae90 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 30), sandMat);
  floor.position.y = -0.3; floor.receiveShadow = true; g.add(floor);
  // tiered seating, which is what makes an arena feel watched rather than empty
  for (let t = 0; t < 3; t++) {
    const rr = R + 0.5 + t * 0.9;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 1.1, 30, 1, true),
      new THREE.MeshToonMaterial({ color: t % 2 ? 0xb0a084 : 0xc8b895, side: THREE.DoubleSide }));
    tier.position.y = 0.55 + t * 1.0; g.add(tier);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 1.4, 0.12, 8, 40),
    new THREE.MeshToonMaterial({ color: 0xd8a441 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.9, 20), stoneMat);
  podium.position.set(0, 0.45, 0); podium.castShadow = true; g.add(podium);
  solid(0, 0, 1.85, 0.9, true);
  for (const [bx, bz] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.2, 10), stoneMat);
    post.position.set(bx, 1.1, bz); post.castShadow = true; g.add(post);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: 0xffa34a }));
    flame.position.set(bx, 2.4, bz); g.add(flame);
    flame.add(glowSprite(0xffb45c, 2.6));
    flame.add(new THREE.PointLight(0xffb45c, 1.1, 18));
    solid(bx, bz, 0.55, 2.2, false);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6),
      new THREE.MeshToonMaterial({ color: [0xe8574a, 0x4a8fe8, 0x6fce4e, 0xd8a441][i % 4],
        side: THREE.DoubleSide }));
    flag.position.set(Math.cos(a) * (R + 1.2), 4.2, Math.sin(a) * (R + 1.2));
    flag.rotation.y = -a; g.add(flag);
  }
  g.add(new THREE.HemisphereLight(0xffe6bd, 0x7a6440, 0.95));
}

const FURNISH = { house: furnishHouse, cave: furnishCave, mountain: furnishMountain, arena: furnishArena };

function buildInterior(kind) {
  const spec = INTERIORS[kind] || INTERIORS.house;
  const R = spec.R;
  const g = new THREE.Group();
  g.position.set(HOUSE_X, 0, HOUSE_Z);
  const solids = [];
  // furnishers place things in room-local coordinates and this converts them once, so a
  // room's furniture cannot drift out of step with its collision
  const solid = (lx, lz, r, top, stand) =>
    solids.push({ x: HOUSE_X + lx, z: HOUSE_Z + lz, r, top, stand });
  (FURNISH[kind] || furnishHouse)(g, R, solid);
  scene.add(g);
  houseGroup = g;
  houseIsland = {
    x: HOUSE_X, z: HOUSE_Z, y: 0, r: R, group: g, biome: BIOMES[0],
    collect: [], slimes: [], doors: [], solids,
    wall: R - 0.3
  };
  islands.push(houseIsland);
}

function clearInterior() {
  if (houseGroup) {
    houseGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.userData.shared) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
    scene.remove(houseGroup);
  }
  houseGroup = null;
  if (houseIsland) {
    const ix = islands.indexOf(houseIsland);
    if (ix >= 0) islands.splice(ix, 1);
    houseIsland = null;
  }
}
function enterHouse(kind) {
  if (insideHouse || inDungeon) return false;
  const k = INTERIORS[kind] ? kind : 'house';
  const spec = INTERIORS[k];
  insideKind = k;
  houseReturn = player.position.clone();
  insideHouse = true;
  buildInterior(k);
  riding = null;
  // arrive just inside the doorway, facing the room, never in the middle of the furniture
  player.position.set(HOUSE_X, 0, HOUSE_Z + spec.spawnZ);
  spawn.set(HOUSE_X, 0, HOUSE_Z + spec.spawnZ);
  camSnap = true;
  const b = $('houseLeave'); if (b) b.style.display = 'block';
  chime(640);
  say(L(spec.msg));
  return true;
}
function leaveHouse() {
  if (!insideHouse) return;
  insideHouse = false;
  insideKind = 'house';
  clearInterior();
  const back = houseReturn || new THREE.Vector3(0, 0, 3);
  // step out in FRONT of the door, never on top of it, or you walk straight back in
  player.position.copy(back).add(new THREE.Vector3(0, 0.5, 0));
  spawn.copy(back);
  camSnap = true;
  restream();
  ensureChunks(player.position.x, player.position.z);
  const b = $('houseLeave'); if (b) b.style.display = 'none';
  say(L('Back outside.'));
}

function spawnDungeonChest() {
  if (dungeonChest || !dungeonGroup) return;
  const chest = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.1),
    new THREE.MeshToonMaterial({ color: 0xc9954e }));
  box.position.y = 0.55; chest.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.2),
    new THREE.MeshToonMaterial({ color: 0xffd98a }));
  lid.position.y = 1.2; chest.add(lid);
  chest.add(glowSprite(0xffd98a, 4));
  chest.position.set(0, 0, 0);
  dungeonGroup.add(chest);
  dungeonChest = chest;
  say(L('The rift chest opened! Walk into it.'));
}

function onDungeonCrystal() {
  dungeonFound++;
  updateDungeonHud();
  if (dungeonFound >= dungeonNeed) {
    spawnDungeonChest();
    chime(1400);
  } else {
    say(L('Sky crystal {n} of {t}!', { n: dungeonFound, t: dungeonNeed }));
  }
}

function claimDungeonReward() {
  const pay = riftPlan(dungeonTier).reward;
  progress.seeds = (progress.seeds || 0) + pay;
  progress.dungeonsCleared = (progress.dungeonsCleared || 0) + 1;
  // clearing your deepest tier unlocks the next one, the usual ladder
  if (dungeonTier >= (progress.riftTier || 1) && dungeonTier < RIFT_TIER_MAX) {
    progress.riftTier = dungeonTier + 1;
    setTimeout(() => say(L('Rift depth {n} unlocked!', { n: progress.riftTier })), 900);
  }
  saveProgress(); updateShopHud();
  burst(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffd98a, 26);
  chime(1500);
  say(L('Rift cleared! +{n} Seeds. Well done!', { n: pay }));
  // Claiming the chest must not eject the child. It used to yank them out 1.8s later,
  // in the middle of their own celebration and with no say in it — which is how a
  // cleared room came to feel broken. Leaving is its own choice, via the LEAVE button,
  // the way every open-world dungeon does it.
  setTimeout(() => say(L('Take your time. Tap LEAVE when you are ready.')), 2600);
}

function updateDungeonHud() {
  const box = $('dungeonHud');
  if (!box) return;
  box.classList.toggle('on', inDungeon);
  const c = $('dgCount');
  if (c) c.textContent = dungeonFound + '/' + dungeonNeed;
  const t = $('dgTier');
  if (t) t.textContent = L('Depth {n}', { n: dungeonTier });
}

function enterDungeon(tier) {
  if (inDungeon) return;
  tickEnergy();
  if ((progress.energy ?? ENERGY_MAX) < 1) {
    say(L('No energy left — it refills on its own, or top up in the 🌰 shop.'));
    return;
  }
  const plan = riftPlan(Math.min(tier || 1, progress.riftTier || 1));
  progress.energy = (progress.energy ?? ENERGY_MAX) - 1;
  if (!progress.energyAt) progress.energyAt = Date.now();
  saveProgress(); updateShopHud();
  closeGatePrompt();
  dungeonReturn = player.position.clone();
  inDungeon = true; dungeonFound = 0;
  dungeonTier = plan.tier; dungeonNeed = plan.need;
  buildDungeon(plan);
  riding = null;
  player.position.set(DUNGEON_X, 0, DUNGEON_Z + plan.radius - 4);
  spawn.set(DUNGEON_X, 0, DUNGEON_Z + plan.radius - 4);
  camSnap = true;
  updateDungeonHud();
  chime(720);
  say(L('You stepped into a Sky Rift. Find {n} sky crystals!', { n: plan.need }));
}

function exitDungeon(cleared) {
  if (!inDungeon) return;
  inDungeon = false;
  clearDungeon();
  const back = dungeonReturn || new THREE.Vector3(0, 0, 3);
  player.position.copy(back).add(new THREE.Vector3(0, 1, 0));
  spawn.copy(back);
  camSnap = true;
  lastCX = 1e9; lastCZ = 1e9;                 // force the world to stream back in
  ensureChunks(player.position.x, player.position.z);
  updateDungeonHud();
  if (!cleared) say(L('You slipped back out of the rift.'));
}

// ---------- gate prompt: pick a depth before spending energy ----------
// Walking into a gate never costs anything on its own — the child confirms first, so a
// stray step can't burn energy.
function openGatePrompt() {
  const el = $('gatePanel'); if (!el) return;
  tickEnergy();
  const box = $('gateTiers'); if (!box) return;
  box.innerHTML = '';
  const maxT = Math.min(RIFT_TIER_MAX, progress.riftTier || 1);
  for (let t = 1; t <= RIFT_TIER_MAX; t++) {
    const plan = riftPlan(t);
    const locked = t > maxT;
    const row = document.createElement('div');
    row.className = 'gateRow' + (locked ? ' locked' : '');
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = L('Depth {n}', { n: t }) + ' · ' + plan.need + ' 💎';
    const pr = document.createElement('span');
    pr.className = 'pr';
    pr.textContent = locked ? '🔒' : '+' + plan.reward + ' 🌰';
    row.append(nm, pr);
    const b = document.createElement('button');
    b.className = 'gateGo';
    b.textContent = locked ? L('Locked') : L('Enter');
    if (locked) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    else b.addEventListener('click', () => enterDungeon(t));
    row.appendChild(b);
    box.appendChild(row);
  }
  const c = $('gateCost');
  if (c) c.textContent = L('Costs 1 energy · you have {n}', { n: progress.energy ?? ENERGY_MAX });
  el.classList.add('on');
}
function closeGatePrompt() { const el = $('gatePanel'); if (el) el.classList.remove('on'); }
const gateCloseBtn = $('gateClose');
if (gateCloseBtn) gateCloseBtn.addEventListener('click', closeGatePrompt);

// ---------- fast travel ----------
// Touch a waypoint once, then jump back to it from the map. Ordinary open-world travel.
function renderTravel() {
  const box = $('travelList'); if (!box) return;
  box.innerHTML = '';
  const list = progress.waypoints || [];
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'travelEmpty';
    p.textContent = L('No waypoints yet — find a glowing stone pillar out in the world and walk up to it.');
    box.appendChild(p);
    return;
  }
  for (const w of list) {
    const b = document.createElement('button');
    b.className = 'travelGo';
    const d = Math.round(Math.hypot(player.position.x - w.x, player.position.z - w.z));
    b.innerHTML = '';
    const n = document.createElement('span'); n.className = 'nm'; n.textContent = w.name;
    const s = document.createElement('span'); s.className = 'ds'; s.textContent = d + 'm';
    b.append(n, s);
    b.addEventListener('click', () => travelTo(w));
    box.appendChild(b);
  }
}

function travelTo(w) {
  if (inDungeon) return;
  // land beside the pillar, not inside it — the base is 1.5 wide and the player would
  // otherwise arrive standing in the stone
  player.position.set(w.x, w.y + 1, w.z + 2.5);
  spawn.set(w.x, w.y, w.z + 2.5);
  vel.set(0, 0, 0);
  riding = null;
  camSnap = true;
  lastCX = 1e9; lastCZ = 1e9;
  ensureChunks(w.x, w.z);
  closeTravel();
  chime(1080);
  burst(new THREE.Vector3(w.x, w.y + 1.2, w.z), 0x8fd0f5, 20);
  say(L('Travelled to {name}.', { name: w.name }));
}

function openTravel() { renderTravel(); const el = $('travel'); if (el) el.classList.add('on'); }
function closeTravel() { const el = $('travel'); if (el) el.classList.remove('on'); }
const travelBtn = $('travelBtn');
if (travelBtn) travelBtn.addEventListener('click', openTravel);
const travelCloseBtn = $('travelClose');
if (travelCloseBtn) travelCloseBtn.addEventListener('click', closeTravel);

// test hook: lets the headless suite inspect dungeon state without guessing
window.__sky = {
  state: () => ({
    inDungeon,
    found: dungeonFound,
    player: [player.position.x, player.position.y, player.position.z].map(n => +n.toFixed(2)),
    yaw: +camYaw.toFixed(3),
    camera: [camera.position.x, camera.position.y, camera.position.z].map(n => +n.toFixed(2)),
    roomAt: dungeonGroup ? [dungeonGroup.position.x, dungeonGroup.position.y, dungeonGroup.position.z] : null,
    crystals: collect.filter(c => c.kind === 'dcrystal').length,
    ground: groundHeight(player.position.x, player.position.z),
    view: settings.view,
    insideHouse,
    insideKind: insideHouse ? insideKind : null,
    avatarVisible: player.visible,
    padSeen
  }),
  // what the renderer is actually doing right now, so a graphics setting can be proved
  // to have landed instead of merely being stored
  gfx: () => ({
    quality: settings.quality,
    presets: Object.keys(QUALITY_PRESETS),
    renderScale: settings.renderScale,
    pixelRatio: +renderer.getPixelRatio().toFixed(3),
    shadows: settings.shadows,
    shadowsOn: renderer.shadowMap.enabled && sun.castShadow,
    shadowMap: sun.shadow.mapSize.x,
    viewDist: settings.viewDist,
    fogFar: scene.fog.far,
    // how far the world is actually built. The fog must never reach past this, or islands
    // appear out of clear air instead of fading in.
    streamEdge: fogLimit(),
    genR: GEN_R,
    cameraFar: camera.far,
    effects: settings.effects,
    fpsCap: settings.fpsCap,
    fps: +fpsNow.toFixed(1),
    showFps: settings.showFps,
    meterText: ($('fpsMeter') || {}).textContent,
    autoAdjust: settings.autoAdjust
  }),
  // interiors: how many doors are loaded, and a way to reach one without hunting
  doors: () => doors.length,
  insideHouse: () => insideHouse,
  toDoor: () => {
    if (!doors.length) return null;
    const d = doors[0];
    player.position.set(d.x, d.y + 0.05, d.z);
    vel.set(0, 0, 0); camSnap = true;
    return { x: +d.x.toFixed(2), z: +d.z.toFixed(2), y: d.y };
  },
  enterHouse: (kind) => enterHouse(kind),
  // what kinds of way-in exist out there, and how many of each
  doorKinds: () => {
    const n = {};
    for (const d of doors) n[d.kind] = (n[d.kind] || 0) + 1;
    return n;
  },
  interiorKinds: () => Object.keys(INTERIORS),
  interiorSpec: (k) => INTERIORS[k] || null,
  // the shop the child sees, so a test can hold it against the server's price list
  shopCatalog: () => ({
    refill: REFILL_COST,
    skins: SHOP_SKINS.map(s2 => ({ id: s2.id, price: s2.price }))
  }),
  lastReceipt: () => lastReceipt,
  insideKind: () => (insideHouse ? insideKind : null),
  leaveHouse: () => leaveHouse(),

  // the live binding table, so a test can prove a rebind reached the movement code
  binds: () => Object.assign({}, binds),
  // solid props: how many there are near the child, and a switch to turn them off so a
  // test can show the before and the after rather than asserting against itself
  solids: () => islands.reduce((n, i) => n + i.solids.length, 0),
  nearestSolid: () => {
    let best = null;
    for (const isl of islands) for (const s of isl.solids) {
      const d = Math.hypot(player.position.x - s.x, player.position.z - s.z);
      if (!best || d < best.d) best = { d: +d.toFixed(3), x: s.x, z: s.z, r: s.r, top: +s.top.toFixed(2), stand: s.stand };
    }
    return best;
  },
  // put the child on flat open ground a set distance from a chosen prop, facing it
  atSolid: (want = 'stand', back = 3) => {
    for (const isl of islands) for (const s of isl.solids) {
      if (want === 'stand' && !s.stand) continue;
      if (want === 'block' && s.stand) continue;
      // stand on the +z side and look down -z, because forward is away from the camera:
      // with camYaw 0 the movement basis sends W toward -z, straight at the prop
      player.position.set(s.x, isl.y + 0.05, s.z + s.r + back);
      vel.set(0, 0, 0); camYaw = 0; camPitch = 0.32; camSnap = true;
      return { x: s.x, z: s.z, r: s.r, top: +s.top.toFixed(2), islandY: isl.y, stand: !!s.stand };
    }
    return null;
  },
  setNoclip: v => { noclip = !!v; return noclip; },
  // drop the child at a chosen spot with no momentum, for falling tests.
  // height comes last because that is how you say it: "over there, this high up".
  dropAt: (x, z, height) => {
    player.position.set(x, height, z);
    vel.set(0, 0, 0); camSnap = true;
    return [player.position.x, player.position.y, player.position.z];
  },
  setGfx: (id, value) => {
    const el = $(id);
    if (!el) return false;
    if (el.type === 'checkbox') { el.checked = !!value; el.dispatchEvent(new Event('change', { bubbles: true })); }
    else { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  },
  // graphics triage: hide a category to find out what an on-screen artefact actually is
  hide: what => {
    if (what === 'clouds') clouds.forEach(c => (c.visible = false));
    if (what === 'falls') islands.forEach(i => i.group.traverse(o => {
      if (o.material === fallMat) o.visible = false;
    }));
    if (what === 'gates') gates.forEach(g => (g.group.visible = false));
  },
  world: () => ({
    gates: gates.length,
    waypoints: waypoints.length,
    unlocked: (progress.waypoints || []).length,
    tier: progress.riftTier || 1,
    energy: progress.energy, energyAt: progress.energyAt, eta: energyEta()
  }),
  // drop the player onto the nearest gate / waypoint so travel can be tested without walking
  // stand a normal approach away, not on top of the arch — inside the trigger, but
  // at the distance a child actually walks up to it
  toGate: () => {
    if (!gates.length) return false;
    const g = gates[0];
    player.position.set(g.x, g.y + 0.5, g.z + 2.5); camSnap = true; return true;
  },
  toWaypoint: () => {
    if (!waypoints.length) return false;
    const w = waypoints[0];
    player.position.set(w.x, w.y + 0.5, w.z + 2.5); camSnap = true; return true;
  },
  // wind the energy clock back so regeneration can be tested without waiting
  ageEnergy: mins => { progress.energyAt = Date.now() - mins * 60000; tickEnergy(); },
  setEnergy: n => { progress.energy = n; progress.energyAt = Date.now(); updateShopHud(); },
  // teleport onto a crystal so pickup can be tested without pathfinding
  toCrystal: () => {
    const c = collect.find(c => c.kind === 'dcrystal');
    if (!c) return false;
    player.position.set(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z);
    return true;
  },
  toChest: () => { player.position.set(DUNGEON_X, 0, DUNGEON_Z); },
  // Put the child on open ground with the camera at a known angle, so a control test
  // measures the direction the game sends them and not whatever tree they walked into.
  // Returns the widest island's centre so the caller knows where it landed them.
  // What is the third-person camera actually resting against? A camera that sits at its
  // minimum distance looks identical whether a tree is in the way or the collision code is
  // broken, and only one of those is a bug.
  camProbe: () => {
    const head = new THREE.Vector3(player.position.x, player.position.y + 1.6, player.position.z);
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const target = new THREE.Vector3(
      player.position.x + Math.sin(camYaw) * cp * camDist,
      player.position.y + 1.6 + sp * camDist,
      player.position.z + Math.cos(camYaw) * cp * camDist);
    const toCam = target.clone().sub(head);
    const want = toCam.length();
    camRay.set(head, toCam.multiplyScalar(1 / want));
    camRay.far = want;
    let blocker = null;
    for (const h of camRay.intersectObjects(scene.children, true)) {
      if (camRayBlocks(h.object)) { blocker = { name: h.object.name || h.object.type, dist: +h.distance.toFixed(2) }; break; }
    }
    return { camDist, want: +want.toFixed(2), blocker,
      actual: +camera.position.distanceTo(head).toFixed(2) };
  },
  clearGround: () => {
    let best = islands[0];
    for (const i of islands) if (i.r > best.r) best = i;
    player.position.set(best.x, best.y + 0.2, best.z);
    vel.set(0, 0, 0);
    camYaw = 0; camPitch = 0.32; camSnap = true;
    return { x: best.x, z: best.z, r: best.r };
  }
};

const dungeonBtn = $('dungeonBtn');
if (dungeonBtn) dungeonBtn.addEventListener('click', () => inDungeon ? exitDungeon(false) : openGatePrompt());
const dgLeave = $('dgLeave');
if (dgLeave) dgLeave.addEventListener('click', () => exitDungeon(false));
updateDungeonHud();

// ---------- PWA: register the service worker (installable app) ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* optional */ });
}

// ---------- input ----------
// Every key the game reads goes through this table, so a child can move any of them and
// nothing anywhere else has to know. The arrow keys and right Shift stay wired underneath
// as permanent alternates — rebinding W should not cost you the arrow keys.
const DEFAULT_KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', punch: 'KeyF', interact: 'KeyE',
  pet: 'KeyP', ride: 'KeyR', journal: 'KeyJ', wardrobe: 'KeyK',
  buddies: 'KeyN', map: 'KeyM', shop: 'KeyT', camLeft: 'KeyQ', view: 'KeyV'
};
const ALT_KEYS = {
  forward: ['ArrowUp'], back: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  sprint: ['ShiftRight']
};
const binds = Object.assign({}, DEFAULT_KEYS, settings.keys || {});
const keys = {};
// is the key for this action down right now?
function held(action) {
  if (keys[binds[action]]) return true;
  const alts = ALT_KEYS[action];
  if (alts) for (const k of alts) if (keys[k]) return true;
  return false;
}
// which action does this physical key run? built fresh whenever a binding changes
let keyToAction = {};
function rebuildKeyMap() {
  keyToAction = {};
  for (const a in binds) keyToAction[binds[a]] = a;
  for (const a in ALT_KEYS) for (const k of ALT_KEYS[a]) if (!keyToAction[k]) keyToAction[k] = a;
}
rebuildKeyMap();
function setBind(action, code) {
  if (!(action in DEFAULT_KEYS) || !code) return false;
  // one key, one job: whatever held this code before falls back to nothing rather than
  // silently firing two actions at once
  for (const a in binds) if (a !== action && binds[a] === code) binds[a] = '';
  binds[action] = code;
  settings.keys = Object.assign({}, binds);
  rebuildKeyMap(); saveSettings(); renderBinds();
  return true;
}
function resetBinds() {
  Object.assign(binds, DEFAULT_KEYS);
  settings.keys = {};
  rebuildKeyMap(); saveSettings(); renderBinds();
}
// the one-shot actions, kept apart from the held ones above
const TAP_ACTIONS = {
  jump: () => { jumpPressed = true; },
  punch: () => { punchPressed = true; },
  interact: () => { interactPressed = true; },
  pet: () => { petPressed = true; },
  ride: () => { if (!buildMode) toggleRide(); },
  journal: () => { const j = $('journal'); if (j && j.classList.contains('on')) closeJournal(); else openJournal(); },
  wardrobe: () => { const w = $('wardrobe'); if (w && w.classList.contains('on')) closeWardrobe(); else openWardrobe(); },
  buddies: () => { const bp = $('buddyPanel'); if (bp && bp.classList.contains('on')) closeBuddyPanel(); else openBuddyPanel(); },
  map: () => { const mp = $('mapWrap'); if (mp) mp.classList.toggle('big'); },
  view: () => setViewMode(settings.view === 'fpp' ? 'tpp' : 'fpp'),
  shop: () => { const sh = $('shop'); if (sh && sh.classList.contains('on')) closeShop(); else openShop(); }
};
// ---- the rebinding panel ----
const BIND_LABELS = {
  forward: 'Walk forward', back: 'Walk back', left: 'Step left', right: 'Step right',
  jump: 'Jump', sprint: 'Run', punch: 'Pow', interact: 'Talk', pet: 'Pet buddy',
  ride: 'Ride buddy', journal: 'Journal', wardrobe: 'Wardrobe', buddies: 'Buddies',
  map: 'Map', shop: 'Shop', camLeft: 'Turn camera', view: 'Eyes or camera'
};
// KeyW reads as gibberish to a seven-year-old; show the letter on the cap instead
function keyLabel(code) {
  if (!code) return L('none');
  if (code === 'Space') return L('Space');
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { Up: '↑', Down: '↓', Left: '←', Right: '→' }[code.slice(5)] || code;
  if (code === 'ShiftLeft') return L('Shift');
  if (code === 'ShiftRight') return L('Shift') + ' R';
  return code;
}
let awaitingBind = null;
function endBindCapture() {
  awaitingBind = null;
  renderBinds();
}
function renderBinds() {
  const host = $('bindList');
  if (!host) return;
  host.textContent = '';
  for (const action in BIND_LABELS) {
    const row = document.createElement('div');
    row.className = 'bindRow';
    const name = document.createElement('span');
    name.textContent = L(BIND_LABELS[action]);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bindKey' + (awaitingBind === action ? ' listening' : '') + (binds[action] ? '' : ' clash');
    btn.id = 'bind_' + action;
    btn.textContent = awaitingBind === action ? L('Press a key...') : keyLabel(binds[action]);
    btn.setAttribute('aria-label', L(BIND_LABELS[action]) + ': ' + keyLabel(binds[action]));
    btn.addEventListener('click', () => {
      awaitingBind = awaitingBind === action ? null : action;
      renderBinds();
      const live = $('bind_' + action);
      if (live && awaitingBind) live.focus();
    });
    row.append(name, btn);
    host.appendChild(row);
  }
}
const bindResetBtn = $('bindReset');
if (bindResetBtn) bindResetBtn.addEventListener('click', () => { awaitingBind = null; resetBinds(); });

let jumpPressed = false, punchPressed = false;
addEventListener('keydown', e => {
  // while the panel is waiting for a new binding, the key belongs to the panel, not the game
  if (awaitingBind) { e.preventDefault(); setBind(awaitingBind, e.code); endBindCapture(); return; }
  keys[e.code] = true;
  if (e.repeat) return;
  const action = keyToAction[e.code];
  if (!action) return;
  if (action === 'jump') e.preventDefault();
  const tap = TAP_ACTIONS[action];
  if (tap) tap();
});
addEventListener('keyup', e => { keys[e.code] = false; });

// --- free-look camera state ---
let camYaw = 0, camPitch = 0.32, camDist = 9;
// set true whenever the player is teleported, so the camera lands instead of flying there
let camSnap = false;
const isTouch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
// CSS alone used `(pointer:coarse)`, which hides the stick on a touchscreen laptop that
// also reports a mouse. Drive it from a body class instead, using the same test the rest
// of the game uses, so what a child sees matches what actually responds to their finger.
document.body.classList.toggle('touchUI', isTouch);
// remembered so a tap on the world does not ask for pointer lock, which only suits a mouse
let lastPointerType = 'mouse';
renderer.domElement.addEventListener('pointerdown', e => { lastPointerType = e.pointerType; }, true);
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
  // pointer lock is a mouse idea; on a finger it does nothing but swallow the tap
  if (lastPointerType !== 'mouse') return;
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

// The stick and the action buttons run on Pointer Events, not touch events. One code path
// then serves a finger, a stylus, and a mouse — a touchscreen laptop and a plain desktop
// browser both work, where the old touch-only listeners left the controls completely dead.
// Sizes are read from the live element instead of hardcoded, so the landscape layout
// (which shrinks the stick) still centres its knob correctly.
const stickVec = { x: 0, y: 0 };
const stickEl = $('stick'), knob = $('knob');
if (stickEl) {
  let sid = null;
  const centreKnob = () => {
    const rad = stickEl.offsetWidth / 2;
    knob.style.left = (rad - knob.offsetWidth / 2) + 'px';
    knob.style.top = (rad - knob.offsetHeight / 2) + 'px';
  };
  const aim = e => {
    const r = stickEl.getBoundingClientRect();
    const rad = r.width / 2, reach = rad * 0.82;
    let dx = (e.clientX - (r.left + rad)) / reach, dy = (e.clientY - (r.top + rad)) / reach;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    stickVec.x = dx; stickVec.y = dy;
    knob.style.left = (rad - knob.offsetWidth / 2 + dx * rad * 0.53) + 'px';
    knob.style.top = (rad - knob.offsetHeight / 2 + dy * rad * 0.53) + 'px';
  };
  const release = e => {
    if (sid !== null && e.pointerId !== sid) return;
    sid = null; stickVec.x = stickVec.y = 0; centreKnob();
    stickEl.classList.remove('pressed'); knob.classList.remove('pressed');
  };
  stickEl.addEventListener('pointerdown', e => {
    if (sid !== null) return;
    e.preventDefault();
    sid = e.pointerId;
    // capture so a thumb that slides off the circle keeps steering instead of freezing
    try { stickEl.setPointerCapture(sid); } catch (_) {}
    // the ring brightens and the knob grows, so the stick looks grabbed while it is held
    stickEl.classList.add('pressed'); knob.classList.add('pressed');
    buzz(8);
    aim(e);
  });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === sid) aim(e); });
  stickEl.addEventListener('pointerup', release);
  stickEl.addEventListener('pointercancel', release);
  // a lost pointer must not leave the child walking forever
  addEventListener('blur', release);
  addEventListener('resize', centreKnob);
  centreKnob();
}
// A press has to be *felt*, not just registered. QA's complaint was that the buttons never
// moved, so a child could not tell a working tap from a dead one. Every press now shrinks
// the button, pulses a ring out of it, and buzzes the phone for 12 ms.
function buzz(ms) {
  // some browsers throw on vibrate inside a non-user gesture; never let that kill a jump
  try { if (navigator.vibrate && !matchMedia('(prefers-reduced-motion:reduce)').matches) navigator.vibrate(ms); } catch (_) {}
}
function flash(el, ms = 130) {
  if (!el) return;
  el.classList.remove('pressed');
  // reading offsetWidth restarts the ring animation on a rapid double tap
  void el.offsetWidth;
  el.classList.add('pressed');
  clearTimeout(el._flashT);
  el._flashT = setTimeout(() => el.classList.remove('pressed'), ms);
}
// ---------- gamepad ----------
// A Windows controller had no support here at all, which is why QA could not test one.
// The left stick reports the same way the on-screen stick does -- x right, y DOWN -- so it
// feeds the same two numbers into the same movement line, and cannot end up inverted
// relative to the touch controls without both being wrong together.
const padVec = { x: 0, y: 0 };
let padSprint = false, padSeen = false;
const padPrev = {};
const DEADZONE = 0.18;
function padAxis(v) {
  if (!v || Math.abs(v) < DEADZONE) return 0;
  // rescale past the dead zone so the stick starts at zero rather than jumping to 0.18
  return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}
// fire once per press, not once per frame
function padTap(pad, index) {
  const down = !!(pad.buttons[index] && pad.buttons[index].pressed);
  const was = padPrev[index];
  padPrev[index] = down;
  return down && !was;
}
function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const g of pads) if (g && g.connected) { pad = g; break; }
  if (!pad) {
    if (padSeen) { padSeen = false; padVec.x = padVec.y = 0; padSprint = false; }
    return;
  }
  if (!padSeen) { padSeen = true; say(L('Controller connected!')); chime(720); }
  padVec.x = padAxis(pad.axes[0]);
  padVec.y = padAxis(pad.axes[1]);
  const sens = settings.sensitivity;
  camYaw -= padAxis(pad.axes[2]) * dt * 2.8 * sens;
  camPitch = Math.min(1.15, Math.max(-0.35,
    camPitch + padAxis(pad.axes[3]) * dt * 2.0 * sens * (settings.invert ? -1 : 1)));
  const b = pad.buttons;
  padSprint = !!((b[10] && b[10].pressed) || (b[6] && b[6].value > 0.5) || (b[7] && b[7].value > 0.5));
  // the standard layout every console teaches: bottom face jumps, left face hits
  if (padTap(pad, 0)) jumpPressed = true;
  if (padTap(pad, 2)) punchPressed = true;
  if (padTap(pad, 1)) interactPressed = true;
  if (padTap(pad, 3)) petPressed = true;
  if (padTap(pad, 4)) TAP_ACTIONS.journal();
  if (padTap(pad, 5)) TAP_ACTIONS.map();
  if (padTap(pad, 9)) setPaused(!paused);
  if (padTap(pad, 8)) setViewMode(settings.view === 'fpp' ? 'tpp' : 'fpp');
}

// ---------- first person / third person ----------
// The avatar is hidden in first person rather than part-hidden: a VRM head scaled away
// leaves a neck stump in view, and a child should see the world, not the inside of a face.
function setViewMode(mode) {
  settings.view = mode === 'fpp' ? 'fpp' : 'tpp';
  saveSettings();
  player.visible = settings.view === 'tpp';
  camSnap = true;
  const btn = $('viewBtn');
  if (btn) btn.textContent = settings.view === 'fpp' ? L('1st') : L('3rd');
  say(settings.view === 'fpp' ? L('First person. Look around!') : L('Back to third person.'));
}

// pointerdown fires for mouse, touch and pen; the click fallback (detail 0) is the
// keyboard path, so Tab + Enter on the buttons works for a child using a keyboard.
function pressBtn(el, fn) {
  if (!el) return;
  // a real button is focusable and announces itself; these started life as bare divs
  if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  if (!el.getAttribute('role')) el.setAttribute('role', 'button');
  if (!el.querySelector('.ring')) {
    const ring = document.createElement('span');
    ring.className = 'ring';
    el.appendChild(ring);
  }
  const fire = () => { flash(el); buzz(12); fn(); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); fire(); });
  el.addEventListener('click', e => { if (e.detail === 0) fire(); });
  el.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); fire(); }
  });
}
// Every HUD button gets the same acknowledgement. These already carry their own click
// handlers, so this only adds the feel — press, shrink, buzz — without touching behaviour.
for (const id of ['pauseBtn', 'journalBtn', 'wardrobeBtn', 'photoBtn', 'dungeonBtn', 'buildBtn', 'careBtn', 'rideBtn', 'viewBtn']) {
  const el = $(id);
  if (!el) continue;
  el.addEventListener('pointerdown', () => {
    el.classList.add('hudTap'); buzz(10);
    clearTimeout(el._tapT);
    el._tapT = setTimeout(() => el.classList.remove('hudTap'), 130);
  });
}
pressBtn($('jumpBtn'), () => { jumpPressed = true; });
const punchBtn = $('punchBtn');
pressBtn(punchBtn, () => { punchPressed = true; });

// ---------- physics + loop ----------
const vel = new THREE.Vector3();
let onGround = false, jumps = 0, running = false;
// only the test harness sets this, to show the difference solid props actually make
let noclip = false;
let punchTime = -1; // >=0 while punch anim plays
let trailTick = 0, bondT = 0;
let coyoteT = 0, jumpBufT = 0, footT = 0, wasAirborne = false, airTime = 0;
const skyTmp = new THREE.Color(), fogTmp = new THREE.Color();
const spawn = new THREE.Vector3(0, 0, 3);
// WALK/SPRINT/JUMP/GRAV/MAXJUMPS/GLIDE/MAGNET live in the progression block above

// How wide the child is, for bumping into things. Generous rather than exact: a collider
// that hugs the mesh reads as "I got stuck on nothing" every time a shoulder clips a trunk.
const BODY_R = 0.34;

// The floor under a point. Islands are flat discs; a pillar cap is a small disc on top of
// one. `feet` is where the child currently is: a platform only counts as floor when they
// are at or above it, otherwise standing beside a pillar would teleport them onto it.
// The default is deliberately -Infinity: existing callers (pets, slimes, the flight
// ceiling) want the island floor and nothing else. Only the player passes real feet and
// so is the only thing that can stand on a pillar.
function groundHeight(x, z, feet = -Infinity) {
  let best = -Infinity;
  for (const isl of islands) {
    if (Math.hypot(x - isl.x, z - isl.z) < isl.r) best = Math.max(best, isl.y);
    for (const s of isl.solids) {
      if (!s.stand || s.top <= best) continue;
      // slightly inside the cap, so you cannot stand on the very lip of thin air
      if (Math.hypot(x - s.x, z - s.z) > s.r - 0.1) continue;
      if (feet >= s.top - 0.35) best = s.top;
    }
  }
  return best;
}

// Push the child out of anything solid. Circle against circle, resolved along the shortest
// way out, so walking into a tree slides you around it instead of stopping you dead.
// Props were pure decoration before this — QA filed that as "properti palsu", and they
// were right: you could stroll straight through every trunk and pillar in the world.
function pushOutOfSolids(pos, feet) {
  // `feet` is where the child stood at the start of the frame -- see the call site
  // a walled room (the rift) keeps you inside it: the wall is the boundary of the island
  for (const isl of islands) {
    if (!isl.wall) continue;
    const dx = pos.x - isl.x, dz = pos.z - isl.z;
    const d = Math.hypot(dx, dz), limit = isl.wall - BODY_R;
    if (d > limit && d > 1e-4) { pos.x = isl.x + dx / d * limit; pos.z = isl.z + dz / d * limit; }
  }
  for (const isl of islands) {
    if (Math.hypot(pos.x - isl.x, pos.z - isl.z) > isl.r + 4) continue;
    for (const s of isl.solids) {
      // above it? then it is a floor, not a wall
      if (feet >= s.top - 0.2) continue;
      const dx = pos.x - s.x, dz = pos.z - s.z;
      const need = s.r + BODY_R;
      let d = Math.hypot(dx, dz);
      if (d >= need) continue;
      if (d < 1e-4) { pos.x += need; continue; } // dead centre: shove it somewhere definite
      pos.x = s.x + dx / d * need;
      pos.z = s.z + dz / d * need;
    }
  }
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
  bindSetting('setQuality', el => {
    if (el.value !== 'custom') applyPreset(el.value); else settings.quality = 'custom';
    govSteps = 0; applyQuality(); syncGraphicsUI();
  });
  // any individual dial moving means the preset name no longer describes what you see
  const dial = (id, read) => bindSetting(id, el => { read(el); settings.quality = 'custom'; applyQuality(); syncGraphicsUI(); });
  dial('setScale', el => { settings.renderScale = +el.value; });
  dial('setShadows', el => { settings.shadows = el.value; });
  dial('setView', el => { settings.viewDist = +el.value; });
  dial('setFx', el => { settings.effects = +el.value; });
  dial('setFpsCap', el => { settings.fpsCap = +el.value; });
  const sfps = $('setShowFps');
  if (sfps) sfps.addEventListener('change', () => {
    settings.showFps = sfps.checked; saveSettings();
    document.body.classList.toggle('showFps', settings.showFps);
  });
  const sauto = $('setAuto');
  if (sauto) sauto.addEventListener('change', () => { settings.autoAdjust = sauto.checked; govSteps = 0; saveSettings(); });
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
syncGraphicsUI();
applyQuality();
renderBinds();
setViewMode(settings.view);
const viewBtn = $('viewBtn');
if (viewBtn) viewBtn.addEventListener('click', () => setViewMode(settings.view === 'fpp' ? 'tpp' : 'fpp'));

// ---------- photo mode: frame a shot, snap it, save it (a sharing hook for siblings) ----------
function setPhotoMode(on) {
  document.body.classList.toggle('photo', on);
  if (on) tip('photo', L('Move the camera to frame your shot, then tap Snap!'));
}
const houseEnterBtn = $('houseEnter');
if (houseEnterBtn) pressBtn(houseEnterBtn, () => enterHouse(nearDoorKind));
const houseLeaveBtn = $('houseLeave');
if (houseLeaveBtn) pressBtn(houseLeaveBtn, () => leaveHouse());

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

// FPS governor: if the frame rate stays low, step down one preset at a time rather than
// dropping straight to the floor, and only while the child has left auto-adjust on.
const PRESET_LADDER = ['ultra', 'high', 'medium', 'low', 'potato'];
// Measured on the wall clock, never on the frame delta: the delta is clamped to 50 ms so
// a stall cannot fling the player across the map, and counting frames against a clamped
// delta reports a comfortable 20 FPS on a device that is really managing one. That lie is
// why the old governor never rescued anybody -- it was watching a number that could not fall.
let fpsMark = 0, fpsN = 0, fpsNow = 0, govSteps = 0;
function governFps() {
  const now = performance.now();
  if (!fpsMark) { fpsMark = now; return; }
  fpsN++;
  if (now - fpsMark < 1000) return;
  fpsNow = fpsN * 1000 / (now - fpsMark);
  fpsMark = now; fpsN = 0;
  const fpsEl = $('fpsMeter');
  if (fpsEl && settings.showFps) fpsEl.textContent = Math.round(fpsNow) + ' FPS';
  if (!settings.autoAdjust || govSteps >= 2) return;
  const at = PRESET_LADDER.indexOf(settings.quality);
  if (fpsNow < 28 && at >= 0 && at < PRESET_LADDER.length - 1) {
    govSteps++;
    applyPreset(PRESET_LADDER[at + 1]);
    applyQuality(); saveSettings(); syncGraphicsUI();
    say(L('Smoothing things out for your device!'));
  }
}

let paused = false;

let capCarry = 0;
function animate() {
  requestAnimationFrame(animate);
  // an FPS cap is a battery setting on a phone, not a throttle: skip the frame but keep
  // the clock's delta so the world moves at the same speed either way.
  if (settings.fpsCap) {
    capCarry += clock.getDelta();
    if (capCarry < 1 / settings.fpsCap - 0.001) return;
  }
  const rawDt = Math.min(settings.fpsCap ? capCarry : clock.getDelta(), 0.05);
  capCarry = 0;
  const dt = paused ? 0 : rawDt;
  const t = clock.elapsedTime;
  governFps();
  if (started) pollGamepad(rawDt);

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
  if (held('camLeft')) camYaw += dt * 2.2;

  if (started) {
    // Camera-relative movement. `iz` is FORWARD-positive: pushing W, or the stick up,
    // walks away from the camera, into the world. It used to be built backward-positive
    // while the vectors below were written forward-positive, so W drove the child
    // backwards and the stick answered every thumb with the opposite direction.
    // Screen-down on the stick (stickVec.y > 0) means "come back", hence the minus.
    // the pad's left stick joins the same line as the on-screen stick, with the same sign,
    // so the two can never disagree about which way is forward
    let ix = (held('right') ? 1 : 0) - (held('left') ? 1 : 0) + stickVec.x + padVec.x;
    let iz = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0) - stickVec.y - padVec.y;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    running = len > 0.05;

    // riding is faster, and a winged buddy is faster still
    const rideBoost = riding ? (riding.wings ? 1.85 : 1.5) : 1;
    const speed = ((held('sprint') || padSprint) ? SPRINT : WALK) * rideBoost;
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
    if (riding && riding.wings && held('jump')) {
      // winged buddy: hold jump to fly. A soft ceiling eases the climb to nothing near the top
      // so a child drifts to a gentle hover instead of vanishing into empty sky.
      const gh = groundHeight(player.position.x, player.position.z);
      const floor = gh > -Infinity ? gh : 0;
      const room = Math.max(0, 1 - (player.position.y - floor) / 34);
      vel.y = Math.min(vel.y + 46 * dt * room, 8.5 * Math.max(0.12, room));
      if (Math.random() < 0.25) burst(riding.g.position.clone(), 0xffffff, 2);
    } else if (vel.y < 0 && held('jump')) {
      vel.y = Math.max(vel.y, riding ? GLIDE * 0.55 : GLIDE); // a mount always softens the fall
    }

    // sit height on the mount, eased so mounting looks smooth
    const wantLift = riding ? 0.72 + (riding.level - 1) * 0.05 : 0;
    rideLift += (wantLift - rideLift) * Math.min(1, dt * 8);

    // where the feet were before this step — the floor test below sweeps between the two,
    // so a fast fall cannot pass straight through a platform in a single frame
    const prevY = player.position.y;
    player.position.x += vel.x * dt;
    player.position.z += vel.z * dt;
    player.position.y += vel.y * dt;
    // `prevY`, not the lowest point of the frame. Whether a platform is a wall or a floor
    // is decided by where the feet were when the frame BEGAN: if they started above the
    // cap, this is a landing. Using the lower of the two meant that on the exact frame a
    // child touched down, they were judged to be below the cap and shoved sideways off it
    // -- which looked precisely like falling through a solid pillar.
    if (!noclip) pushOutOfSolids(player.position, prevY);

    // stream new islands in / far ones out, and greet new biomes.
    // inside a dungeon the world is frozen: the room sits far outside the streamed
    // area, so generating chunks around it would build a whole second world.
    if (!inDungeon) {
      ensureChunks(player.position.x, player.position.z);
      checkBiome(player.position.x, player.position.z);
    }
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

    // standing in a doorway: prompt, and let the same TALK button take you in, so a child
    // on a phone never needs a keyboard to get through a door
    if (!inDungeon && !insideHouse) {
      let atDoor = null;
      for (const d of doors) {
        if (Math.hypot(player.position.x - d.x, player.position.z - d.z) < d.r) { atDoor = d; break; }
      }
      if (atDoor) nearDoorKind = atDoor.kind;
      const hb = $('houseEnter');
      if (hb) {
        hb.style.display = atDoor ? 'block' : 'none';
        // a cave mouth that says ENTER reads as a bug; the label follows the doorway
        if (atDoor) {
          const spec = INTERIORS[atDoor.kind] || INTERIORS.house;
          const label = L(spec.enter);
          if (hb.textContent !== label) hb.textContent = label;
        }
      }
      if (atDoor && interactPressed) { interactPressed = false; enterHouse(atDoor.kind); }
      if (atDoor) tip('door_' + atDoor.kind, L((INTERIORS[atDoor.kind] || INTERIORS.house).tip));
    }

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

    // Sweep, do not sample. Asking only "am I below the floor right now" lets a fast fall
    // step over a thin platform between two frames -- the child lands on nothing and keeps
    // going, which is exactly the floor they reported falling through. Testing the span
    // the feet actually travelled catches it.
    const gh = groundHeight(player.position.x, player.position.z, Math.max(prevY, player.position.y));
    if (gh > -Infinity && player.position.y <= gh && prevY >= gh - 0.001 && vel.y <= 0) {
      player.position.y = gh; vel.y = 0; onGround = true; jumps = 0;
      spawn.set(player.position.x, gh, player.position.z);
    } else if (gh > -Infinity && player.position.y <= gh && vel.y <= 0) {
      // already below it when the frame began: settle onto the island floor, not the cap
      const floor = groundHeight(player.position.x, player.position.z, -Infinity);
      if (floor > -Infinity && player.position.y <= floor) {
        player.position.y = floor; vel.y = 0; onGround = true; jumps = 0;
        spawn.set(player.position.x, floor, player.position.z);
      } else onGround = false;
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
        footT = (held('sprint') || padSprint) ? 0.22 : 0.3;
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
        // rarer pickups also pay Seeds — the shop purse. Never bought with real money.
        const seedPay = c.kind === 'petal' ? 5 : c.kind === 'star' ? 2 : c.kind === 'ring' ? 1 : 0;
        if (seedPay) { progress.seeds = (progress.seeds || 0) + seedPay; updateShopHud(); }
        if (c.kind === 'dcrystal') onDungeonCrystal();

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

    // touching a waypoint unlocks it for fast travel; walking into a gate offers a run
    if (!inDungeon) {
      // slow swirl + breathing glow so a gate reads as alive from across the island
      for (const g of gates) {
        g.swirl.rotation.z += dt * 0.5;
        g.swirl.material.opacity = 0.45 + Math.sin(t * 1.8) * 0.14;
      }
      for (const w of waypoints) if (w.halo.visible) w.crystal.rotation.y += dt * 0.8;
      for (const w of waypoints) {
        if (isWaypointOn(w)) continue;
        if (Math.hypot(player.position.x - w.x, player.position.z - w.z) < 3) {
          progress.waypoints = [...(progress.waypoints || []), { x: w.x, y: w.y, z: w.z, name: w.name }];
          refreshWaypointLook(w); saveProgress(); chime(1320);
          burst(new THREE.Vector3(w.x, w.y + 3.4, w.z), 0x8fd0f5, 18);
          say(L('Waypoint unlocked! Travel here from the map (M).'));
        }
      }
      let nearGate = null;
      for (const g of gates) {
        if (Math.hypot(player.position.x - g.x, player.position.z - g.z) < 3) { nearGate = g; break; }
      }
      if (nearGate && !gatePrompted) { gatePrompted = nearGate; openGatePrompt(); }
      else if (!nearGate && gatePrompted) { gatePrompted = null; closeGatePrompt(); }
    }

    // walking into the rift chest claims the reward (once)
    if (inDungeon && dungeonChest && !dungeonChest.userData.claimed) {
      const cx = DUNGEON_X, cz = DUNGEON_Z;
      if (Math.hypot(player.position.x - cx, player.position.z - cz) < 2.2) {
        dungeonChest.userData.claimed = true;
        claimDungeonReward();
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
  if (started && settings.view === 'fpp') {
    // First person. In third person the camera sits at +(sin yaw, cos yaw) behind the
    // child and looks back at them, so the direction they walk is exactly -(sin, cos) --
    // the same vector the movement code already uses. First person just puts the camera
    // at eye height and points it down that same vector, so forward stays forward and the
    // two modes can never disagree about which way the child is facing.
    const cp = Math.cos(camPitch);
    const eye = new THREE.Vector3(player.position.x, player.position.y + 1.5, player.position.z);
    camera.position.copy(eye);
    camera.lookAt(
      eye.x - Math.sin(camYaw) * cp,
      eye.y - Math.sin(camPitch),
      eye.z - Math.cos(camYaw) * cp
    );
  } else if (started) {
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
    else if (cgh === -Infinity) {
      // the camera has drifted off the island edge into the void. Nothing to stand on there,
      // so it used to sink below the rim and film the player through the island's rock body
      // (a full-screen brown wall — caught by a fast-travel screenshot). Keep it at least as
      // high as the ground the player is standing on.
      const pgh = groundHeight(player.position.x, player.position.z);
      if (pgh > -Infinity && target.y < pgh + 0.7) target.y = pgh + 0.7;
    }
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
    // normally the camera eases toward its target, but after a teleport it must land
    // instantly — otherwise it slides across the whole gap in view of the player
    if (camSnap) { camera.position.copy(target); camSnap = false; }
    else camera.position.lerp(target, 0.35);
    camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);
  } else {
    camera.position.set(Math.sin(t * 0.15) * 22, 10, Math.cos(t * 0.15) * 22);
    camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);
  }

  renderer.render(scene, camera);
}
animate();
