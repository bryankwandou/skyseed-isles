# Skyseed Isles — Living Checklist

Granular, executable task list. Every checked item was verified in a real browser or against the real database before being marked done. This file grows with the project — quality over raw count.

Legend: `[x]` done + verified · `[ ]` open · `[~]` in progress · `[!]` blocked (reason noted)

---

## 0. Foundation — world, character, gameplay

### 0.1 Rendering & scene
- [x] WebGL renderer with antialiasing and capped pixel ratio
- [x] PCF soft shadow mapping (2048px sun shadow)
- [x] Hemisphere + directional lighting
- [x] Fog + sky color per biome, smoothly lerped as the player travels
- [x] Cloud parallax layer (14 drifting clusters)
- [x] Resize handling for any viewport

### 0.2 Endless world
- [x] Deterministic cell hash → RNG (same cell always generates the same island)
- [x] Chunk streaming: generate cells in radius 3, despawn beyond radius 4
- [x] Full geometry/material dispose on despawn (no VRAM leak)
- [x] 5 biome rings: Meadow, Sunset Grove, Snow, Starfall, Candy Reef
- [x] Biome-colored grass/dirt/tufts/tree leaves
- [x] Decorations parented to island groups (single-remove despawn)
- [x] Waterfall ribbons, pillars, trees placed procedurally
- [x] Home island always at origin with guaranteed ground at spawn
- [x] Biome discovery announcement + persisted list
- [ ] More biomes (desert, caverns, autumn, aurora)
- [ ] Landmark wonder islands
- [ ] Day/night cycle
- [ ] Weather particles per biome

### 0.3 Character
- [x] VRM anime avatar loads, replaces primitive rig
- [x] Primitive fallback if VRM fails (kids never see a broken model)
- [x] Run animation: arms + legs swing, spine lean
- [x] Punch animation on right arm
- [x] Idle breathing/sway
- [x] Cast shadows on all avatar meshes
- [ ] Loading progress bar for the 11.5MB VRM
- [ ] Compressed VRM (meshopt/Draco) to cut load time
- [ ] Cosmetic outfits/colors

### 0.4 Movement & camera
- [x] Camera-relative WASD/joystick movement
- [x] Sprint (Shift), jump, double jump, glide
- [x] Pointer-lock mouse-look (desktop)
- [x] Touch drag camera (mobile right side)
- [x] Scroll zoom (5–16 units)
- [x] Q key camera rotate fallback
- [x] Fall recovery: wind carries you back, zero punishment
- [ ] Camera collision with terrain
- [ ] Coyote time + jump buffering
- [ ] Landing dust/squash feedback

### 0.5 Combat-lite & slimes
- [x] Punch via F / click / POW button
- [x] Forward-cone hit detection
- [x] Slime hop-and-wander AI with island bounds
- [x] Squash/stretch hop animation
- [x] Harmless bop: burst + giggle message + 6s respawn
- [x] 4 slime color variants
- [ ] Rare shiny slime variants
- [ ] Ambient critters (butterflies, birds)

### 0.6 Progression
- [x] Sparks currency (seed=1, ring=2, star=3)
- [x] 7-step unlock ladder: Springy Boots → Feather Glide → Triple Hop → Spark Magnet → Wind Runner → Sparkle Trail → Cloud Steps
- [x] Unlock announcements with burst + chime
- [x] HUD shows next goal + sparks remaining
- [x] localStorage persistence
- [x] Server persistence when logged in
- [x] Spark Magnet actually attracts collectibles
- [x] Sparkle Trail cosmetic renders while running
- [ ] Journal/Codex screen
- [ ] Rare treasures per biome

### 0.7 Buddies (pets)
- [x] Befriend by lingering near a slime (0.8s, heart particles)
- [x] Conga-line follow via breadcrumb trail
- [x] Hop animation + ground snapping + level-based scale
- [x] Names from a friendly pool
- [x] Level up (max 8) fed by spark pickups
- [x] Persisted to save (local + server)
- [x] HUD buddy counter
- [ ] Feed/pet care interactions
- [ ] More buddy species
- [ ] Buddy tricks

### 0.8 Build mode
- [x] Toggle via button or B key
- [x] 5 piece types: tree, flower, mushroom, lantern, crystal
- [x] Placement ghost ring showing target spot
- [x] Place via button/click, undo via button/U key
- [x] Number keys 1–5 select pieces
- [x] Persisted (local + server), restored on load
- [x] Lantern/crystal emit real light
- [ ] Grid snap + rotate + stacking
- [ ] More piece types + recolor
- [ ] Redo stack

## 1. Accounts & backend

### 1.1 Database (Neon Postgres)
- [x] `users` table: username, email, bcrypt hash, is_admin, JSONB progress, timestamps
- [x] Unique constraints on username + email (verified: duplicates rejected)
- [x] Schema setup script (`npm run setup-db`), idempotent
- [x] Admin QA account seeded with max progress (999,999 sparks, 7 skills, 5 biomes, 4 max-level buddies)
- [x] Admin password stored ONLY as bcrypt hash, never logged
- [ ] Rotate the Neon password that was exposed in chat (**parent action required**)
- [ ] Backup/restore runbook

### 1.2 API (Vercel serverless)
- [x] POST /api/register — validation: username regex, email format, min-8 password, confirm match, terms + privacy required
- [x] POST /api/login — accepts username or email; verified 401 on wrong password
- [x] GET /api/me — session check, returns profile + progress
- [x] GET/PUT /api/progress — load/save with 200KB payload guard
- [x] POST /api/logout — clears cookie
- [x] Sessions: signed JWT in httpOnly Secure SameSite cookie, 30-day expiry
- [x] AUTH_SECRET: 96-char random, stored only in Vercel env + gitignored .env.local
- [x] Live production test PASSED: register → me → save → load → wrong-pw 401 → logout
- [x] Live admin login PASSED: isAdmin true, full progress returned
- [x] QA test users deleted after verification
- [ ] Rate limiting on auth endpoints
- [ ] Password reset via email magic link
- [ ] Google sign-in (button present as "coming soon")

### 1.3 Account UI (`play/account.html`)
- [x] Tabbed login / sign-up
- [x] Register: username, email, password, confirm password
- [x] Required checkboxes: Terms & Conditions + Privacy agreement (with readable popups)
- [x] Google button visible, disabled, "coming soon"
- [x] Proper labels, autocomplete attributes, focus rings, aria-live error messages
- [x] Already-logged-in detection → redirect to game
- [x] Inline errors from server shown to the user
- [ ] Password strength meter
- [ ] Show/hide password toggle

### 1.4 Game ↔ server sync
- [x] On boot: /api/me → apply server progress (rebuild buddies, builds, unlocks)
- [x] Debounced (1.2s) progress PUT on every save
- [x] Account bar: greeting + logout, or login/signup link
- [x] Guest mode still fully works via localStorage
- [ ] "Saved" toast + offline indicator
- [ ] Guest → account progress migration prompt
- [ ] Conflict handling between devices

## 2. Security & privacy
- [x] No secrets in the repo (checked: only .env.example tracked)
- [x] .env.local gitignored; AUTH_SECRET generated fresh, never displayed
- [x] Passwords bcrypt-hashed (cost 10)
- [x] httpOnly cookies (JS cannot read the session)
- [x] SQL via parameterized tagged templates (no injection)
- [x] Progress payload size cap
- [!] Neon DB password rotation — BLOCKED on parent (was pasted into chat; treat as leaked)
- [ ] Rate limiting / lockout backoff
- [ ] Input sanitation audit round 2
- [ ] COPPA-minded data minimization review
- [ ] Right-to-delete flow

## 3. Deploy & ops
- [x] Vercel production deploy with serverless functions
- [x] DATABASE_URL via Neon integration; AUTH_SECRET added to Production
- [x] Live URL serves game + API: https://skyseed-isles.vercel.app
- [!] GitHub push — BLOCKED: account `nayrbryanGaming` suspended; commits queued locally (see §5)
- [ ] Push queued commits when GitHub access is restored (or to alt repo once provided)
- [ ] Error monitoring + alerts
- [ ] Load test

## 4. Verification log (what was actually tested)
- [x] Node syntax check on every JS file after every edit
- [x] Pure-logic harness: deterministic worldgen, RNG bounds, biome rings, unlock ordering — ALL PASS
- [x] Headless-browser (real Edge) run: game renders, HUD wired, chunk streaming while walking, zero page errors
- [x] Headless-browser: saved buddy loads from localStorage; live befriending observed
- [x] Headless-browser: build mode — 3 pieces placed, persisted, undo verified
- [x] Real Neon DB test: admin verify, wrong-pw reject, register, duplicate block, progress save, cleanup — ALL PASS
- [x] Production API test (live URL): full auth + progress round-trip — ALL PASS
- [x] Production admin login: 200, isAdmin, 999,999 sparks, 7 skills, 4 pets

## 5. Queued for GitHub (local commits awaiting push)
1. `feat(game): endless procedural world + biomes + persistent unlock ladder (Tahap 1)`
2. `feat(game): befriendable pet slimes that follow in a conga line and level up (Tahap 2)`
3. `feat(game): build mode — place & decorate islands ... (Tahap 3)`
4. `feat(auth): Neon-backed accounts — register/login/logout, server-synced progress, account UI`
5. (pending) `docs: 100-day plan + living checklist`

## 6. Phase 1 — Days 1–11 (verified in headless browser)
- [x] Day 1: Camera collision — camera clamped above island tops
- [x] Day 2: Coyote time (0.12s) + jump buffering (0.14s)
- [x] Day 3: Landing dust (scaled by fall time) + run dust + landing thud
- [x] Day 4: Footstep/jump/land SFX (filtered-noise synth, zero audio files)
- [x] Day 5: Generative ambient music — pentatonic pad, root note per biome, volume control
- [~] Day 6: Bloom — deferred (post-processing postponed for perf; collectibles glow via point lights)
- [x] Day 7: VRM loading progress bar on the title screen
- [x] Day 8: Settings menu — music/sfx volume, quality (Pretty/Fast), camera speed, invert look; persisted
- [x] Day 9: Mobile polish — 72px touch buttons, haptic tick on pickup
- [x] Day 10: Pause menu — Esc / gear button, resume, account & home links (verified open/close headless)
- [x] Day 11: FPS governor — auto drop pixel ratio + shadows if fps < 28 for 2s
- [x] Bonus: "Saved ✓ / Offline" sync toast + 4 new biomes (Desert, Crystal Caverns, Autumn, Aurora)

## 7. Days 12–15 + Phase 2 slice + Phase 3 slice (this pass)
- [x] Day 12: High-contrast HUD + Bigger-text modes (settings, persisted, body classes)
- [x] Day 13: First-run contextual tutorial tips (befriend / build / glide / talk) — each shows once, ever
- [x] Day 15: QA pass (syntax + headless run)
- [x] P2: Gentle day/night — 5-min cycle, never darker than dusk; sun/hemi/sky/fog all follow
- [x] P2: Moonpetal rare treasure (worth 5, ~8% spawn) + journal count
- [x] P2: Shiny golden slimes (6%) + journal count on befriend
- [x] P2: Great Tree wonder islands (1 per ~23 cells, deterministic, guaranteed rewards, discovery fanfare, persisted)
- [x] P2: Sky Journal / Codex overlay (J key / 📖 button) — 8 tracked stats
- [x] P3: Skykeeper NPC (glowing figure, float animation, point light) on the home island
- [x] P3: 6-quest story chain with warm dialogue, rewards, and per-quest progress snapshots
- [x] P3: RPG dialog panel + quest tracker line in HUD + TALK button (touch) / E key (desktop)
- [x] Bops now persisted in progress (survives reload/server sync)

## 8. Phase 2/4/5/6 slice (this pass)
- [x] P2: Buddy care — pet your buddies (♥ Pet button / P key / E away from Skykeeper): hearts, bounce animation, +2 XP, haptic, one-time tip
- [x] P4: Build 2.0 — R key / ↻ Rotate button (22.5° steps, rotation saved per piece), 4 new pieces: Fence, Bench, Arch, Path (9 total, number keys 1–9)
- [x] P5: Family dashboard — /api/family (admin-only, admin re-verified against DB) + family.html: per-child sparks/buddies/builds/quests/regions/last-played, family totals, double-confirm delete, parent accounts protected
- [x] P6: PWA — manifest.webmanifest + service worker (network-first shell cache, API never cached, GET only) + theme/apple meta tags → installable on phones
- [x] E key is context-aware: talk to the Skykeeper when near, pet a buddy otherwise

## 9. Final list clear-out (this pass)
- [x] **Cosmetic wardrobe** — 👒 button / K key. 3 hats (Flower Crown, Star Hat, Party Hat) + 2 capes (Sky, Starlight), each unlocked by a real milestone (sparks, Great Tree, quests, regions, moonpetal). Locked items show what to do. Attaches to the VRM head/spine bones (survives the avatar swap) and falls back to the primitive rig. Saved locally + server.
- [x] **Parent-managed password reset** — chosen over email reset because children have no email address. Parent clicks "Reset password" in the family dashboard; PATCH /api/family re-verifies admin against the DB, enforces 8+ chars, bcrypt-hashes, and refuses to touch another parent's password.
- [x] **Google sign-in** — full OAuth 2.0 authorization-code flow implemented in api/google.js (verifies the id_token with Google, checks `aud` + `email_verified`, creates or links the account). Returns 503 and the UI stays "coming soon" until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set; the button auto-enables the moment they are.
- [x] **VRM compressed 11.48 MB → 6.71 MB (−41.6%)** — standard gltf-transform pipelines were tested first and **rejected**: they silently dropped the VRM extension (verified: avatar failed to load). Shipped a custom GLB texture-only re-encode that rewrites just the image bufferViews, leaving the VRM extension, rig and meshes byte-identical. Verified: 6/6 humanoid bones, 9/9 textured meshes — identical to the original.

## 10. 🐉 Buddy riding + wings (the surprise)
The emotional payoff for the care system — and the honest answer to "my child prefers RDR's horse".
- [x] **Ride your buddy** — press R (or the RIDE button) next to a buddy at Lv 4+. You sit on them, they carry you, movement is 1.5× faster.
- [x] **Wings at Lv 8** — a buddy you raised to max level grows wings permanently (kept between sessions). Riding a winged buddy: 1.85× speed and **hold Space to fly**, with a gentle climb cap so a child never loses sight of the ground.
- [x] Mount reads correctly: buddy scales up, bobs while running, wings flap faster in the air, and softens every landing.
- [x] Progressive UI: the button shows "Lv2/4" while the buddy is too small, "RIDE" when ready, "HOP OFF" while mounted — so the goal is always visible.
- [x] Ties the loop shut: pet your buddy → they level → they carry you → they fly.

## 11. Next up
- [ ] Buddy feeding (berries as a second care action)
- [ ] More wardrobe slots (shoes, wings)
- [ ] Seasonal events
- [ ] Local co-op experiment
