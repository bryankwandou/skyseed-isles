import * as THREE from 'three';

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
const islands = []; // { x, z, y (top), r }
const grassMat = new THREE.MeshToonMaterial({ color: 0x6fce4e });
const dirtMat = new THREE.MeshToonMaterial({ color: 0x9a6b4f });
const stoneMat = new THREE.MeshToonMaterial({ color: 0xb9c4cf });

function makeIsland(x, y, z, r) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.2, 24), grassMat);
  top.position.y = -0.6;
  top.receiveShadow = true;
  g.add(top);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 1.6, 10), dirtMat);
  rock.rotation.x = Math.PI;
  rock.position.y = -1.2 - r * 0.8;
  g.add(rock);
  // grass tufts
  const tuft = new THREE.ConeGeometry(0.16, 0.55, 5);
  const n = Math.floor(r * r * 0.9);
  const inst = new THREE.InstancedMesh(tuft, new THREE.MeshToonMaterial({ color: 0x8fe06a }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (r - 0.6);
    m.makeRotationY(Math.random() * Math.PI);
    m.setPosition(Math.cos(a) * d, 0.25, Math.sin(a) * d);
    inst.setMatrixAt(i, m);
  }
  g.add(inst);
  g.position.set(x, y, z);
  scene.add(g);
  islands.push({ x, z, y, r });
  return g;
}

function makePillar(island, ox, oz, h) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), stoneMat);
  p.position.set(island.x + ox, island.y + h / 2, island.z + oz);
  p.castShadow = true; p.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.9), stoneMat);
  cap.position.set(island.x + ox, island.y + h + 0.25, island.z + oz);
  cap.castShadow = true;
  scene.add(p, cap);
}

function makeTree(island, ox, oz) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
    new THREE.MeshToonMaterial({ color: 0x8a5a3b }));
  trunk.position.set(island.x + ox, island.y + 1.1, island.z + oz);
  trunk.castShadow = true;
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0),
    new THREE.MeshToonMaterial({ color: 0xff9ec6 }));
  leaf.position.set(island.x + ox, island.y + 3.1, island.z + oz);
  leaf.castShadow = true;
  scene.add(trunk, leaf);
}

makeIsland(0, 0, 0, 10);
makeIsland(18, 2, -8, 6);
makeIsland(30, 4.5, 4, 5);
makeIsland(14, 1, 14, 5.5);
makeIsland(-16, 2.5, 10, 6);
makeIsland(-26, 5, -4, 5);
makeIsland(-10, 1.5, -18, 6);
makeIsland(6, 3.5, -24, 5);
makeIsland(24, 6.5, -20, 4.5);
makeIsland(38, 8, -8, 4);

makePillar(islands[0], -6, -4, 4); makePillar(islands[0], 6, -4, 4);
makePillar(islands[0], 0, -7, 6);
makeTree(islands[0], 5, 5); makeTree(islands[0], -5, 5);
makeTree(islands[3], 0, 2); makeTree(islands[4], 1, -1);
makeTree(islands[6], -2, 2); makePillar(islands[2], 0, 0, 3);
makePillar(islands[9], 0, 0, 2.5);

// waterfalls (soft glowing columns off island edges)
const fallMat = new THREE.MeshBasicMaterial({ color: 0xcdefff, transparent: true, opacity: 0.45 });
[[islands[1], 5.4, 0], [islands[4], -5.4, 1], [islands[6], 0, 5.4]].forEach(([isl, ox, oz]) => {
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 14, 10, 1, true), fallMat);
  f.position.set(isl.x + ox, isl.y - 7, isl.z + oz);
  scene.add(f);
});

// clouds
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

// ---------- character: Miru, the sky gardener ----------
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
// hair: back volume + bangs + two long twin-tails
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
// eyes
[-1, 1].forEach(s => {
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x2a2f45 }));
  e.position.set(0.16 * s, 1.98, 0.37); body.add(e);
});
// arms
const arms = [];
[-1, 1].forEach(s => {
  const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), skin);
  a.position.set(0.4 * s, 1.15, 0);
  a.rotation.z = 0.5 * s;
  a.castShadow = true; body.add(a); arms.push(a);
});
// flower crown accent
const crown = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 16),
  new THREE.MeshToonMaterial({ color: 0xffc2dd }));
crown.rotation.x = Math.PI / 2.4; crown.position.y = 2.38; body.add(crown);

player.position.set(0, 0, 3);
scene.add(player);

// ---------- collectibles ----------
const $ = id => document.getElementById(id);
const collect = [];
const seedMat = new THREE.MeshBasicMaterial({ color: 0xfff08a });
const starMat = new THREE.MeshBasicMaterial({ color: 0xffd6f2 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x8af0d8 });

function addSeed(x, y, z) {
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), seedMat);
  s.position.set(x, y + 1, z);
  const glow = new THREE.PointLight(0xffe98a, 0.6, 4);
  s.add(glow);
  scene.add(s);
  collect.push({ mesh: s, kind: 'seed', r: 1.1 });
}
function addStar(x, y, z) {
  const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4), starMat);
  s.position.set(x, y + 1.2, z);
  scene.add(s);
  collect.push({ mesh: s, kind: 'star', r: 1.1 });
}
function addRing(x, y, z) {
  const s = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 10, 28), ringMat);
  s.position.set(x, y + 2.2, z);
  scene.add(s);
  collect.push({ mesh: s, kind: 'ring', r: 1.4 });
}

islands.forEach((isl, i) => {
  if (i === 0) return;
  addSeed(isl.x + 1, isl.y, isl.z);
  if (i % 2 === 0) addSeed(isl.x - 2, isl.y, isl.z + 1.5);
});
addSeed(4, 0, -4); addSeed(-4, 0, 4);
addStar(islands[2].x, islands[2].y + 3.6, islands[2].z);
addStar(islands[8].x, islands[8].y, islands[8].z);
addStar(islands[9].x, islands[9].y + 3.1, islands[9].z);
addRing(9, 1.5, -4); addRing(-8, 2, 6); addRing(15, 3.5, 3);
addRing(-2, 3, -21); addRing(31, 7.5, -14);

const totals = { seed: 0, star: 0, ring: 0 };
collect.forEach(c => totals[c.kind]++);
const got = { seed: 0, star: 0, ring: 0 };
$('tSeed').textContent = totals.seed;
$('tStar').textContent = totals.star;
$('tRing').textContent = totals.ring;

let msgTimer;
function say(text) {
  const el = $('msg');
  el.textContent = text; el.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// sparkle burst on pickup
const bursts = [];
function burst(pos, color) {
  const geo = new THREE.BufferGeometry();
  const n = 20, arr = new Float32Array(n * 3), velArr = [];
  for (let i = 0; i < n; i++) {
    arr.set([pos.x, pos.y, pos.z], i * 3);
    velArr.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 6, (Math.random() - 0.5) * 6));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.22, transparent: true }));
  scene.add(pts);
  bursts.push({ pts, vel: velArr, life: 0.8 });
}

// soft chime via WebAudio
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

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') jumpPressed = true; });
addEventListener('keyup', e => { keys[e.code] = false; });

let jumpPressed = false;
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

// ---------- physics + loop ----------
const vel = new THREE.Vector3();
let onGround = false, jumps = 0, running = false;
const spawn = new THREE.Vector3(0, 0, 3);
const SPEED = 7, JUMP = 9.5, GRAV = -22;

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
  say('Find the glowing seeds!');
});

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  for (const c of clouds) {
    c.position.x += c.userData.v * dt;
    if (c.position.x > 90) c.position.x = -90;
  }

  if (started) {
    // camera-relative input direction
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stickVec.x;
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stickVec.y;
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    running = len > 0.05;

    const camAngle = Math.atan2(camera.position.x - player.position.x, camera.position.z - player.position.z);
    const dirX = ix * Math.cos(camAngle) + iz * Math.sin(camAngle);
    const dirZ = -ix * Math.sin(camAngle) + iz * Math.cos(camAngle);

    vel.x = dirX * SPEED;
    vel.z = dirZ * SPEED;
    if (running) {
      const target = Math.atan2(vel.x, vel.z);
      let d = target - body.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      body.rotation.y += d * Math.min(1, dt * 12);
    }

    if (jumpPressed) {
      if (onGround) { vel.y = JUMP; jumps = 1; chime(520); }
      else if (jumps === 1) { vel.y = JUMP * 0.9; jumps = 2; chime(620); }
    }
    jumpPressed = false;

    vel.y += GRAV * dt;
    // gentle glide while falling and holding jump
    if (vel.y < 0 && keys.Space) vel.y = Math.max(vel.y, -3.5);

    player.position.x += vel.x * dt;
    player.position.z += vel.z * dt;
    player.position.y += vel.y * dt;

    const gh = groundHeight(player.position.x, player.position.z);
    if (gh > -Infinity && player.position.y <= gh && vel.y <= 0) {
      player.position.y = gh; vel.y = 0; onGround = true; jumps = 0;
      spawn.set(player.position.x, gh, player.position.z);
    } else {
      onGround = false;
    }

    // fell off the world — soft respawn, no fail state
    if (player.position.y < -25) {
      player.position.copy(spawn).add(new THREE.Vector3(0, 6, 0));
      vel.set(0, 0, 0);
      say('Whoops! The wind carried you back.');
      chime(330);
    }

    // run/idle animation
    if (running && onGround) {
      const s = Math.sin(t * 14);
      arms[0].rotation.x = s * 0.9; arms[1].rotation.x = -s * 0.9;
      body.position.y = Math.abs(Math.sin(t * 14)) * 0.12;
      dress.rotation.y = s * 0.08;
    } else {
      arms[0].rotation.x *= 0.85; arms[1].rotation.x *= 0.85;
      body.position.y = Math.sin(t * 2.4) * 0.05 + 0.02;
    }
    tails.forEach((tail, i) => { tail.rotation.x = Math.sin(t * 3 + i) * 0.18 - (onGround ? 0 : 0.5); });

    // collectibles
    for (const c of collect) {
      if (c.done) continue;
      c.mesh.rotation.y += dt * 2;
      const d = c.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      if (d < c.r) {
        c.done = true;
        burst(c.mesh.position, c.mesh.material.color);
        scene.remove(c.mesh);
        got[c.kind]++;
        $('cSeed').textContent = got.seed;
        $('cStar').textContent = got.star;
        $('cRing').textContent = got.ring;
        chime(c.kind === 'seed' ? 880 : c.kind === 'ring' ? 740 : 990);
        const left = collect.filter(x => !x.done).length;
        if (left === 0) say("You found everything! Miru's garden will bloom again!");
        else if (c.kind === 'star') say('A wishing star! ' + left + ' treasures left.');
        else if (c.kind === 'ring') say('Sky ring! Nice jump!');
      }
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

  // camera: orbit on title screen, smooth follow in game
  if (started) {
    camTarget.set(player.position.x, player.position.y + 4.5, player.position.z + 9);
    camera.position.lerp(camTarget, 0.06);
  } else {
    camera.position.set(Math.sin(t * 0.15) * 22, 10, Math.cos(t * 0.15) * 22);
  }
  camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);

  renderer.render(scene, camera);
}
animate();
