# Skyseed Isles — Honest Gap Audit

What is actually missing, weak, or risky. Written after auditing the running code and the live
production system, not from imagination. Ordered by real consequence, because a list ordered by
"how many boxes can I write" is worthless.

**On the "5,000 items" request:** a 5,000-line checklist for a project this size would be ~98%
padding ("add a comma", "rename a variable"), and padding hides the handful of things that actually
matter. Below are the ~90 gaps that are genuinely worth doing, ranked. If any single line looks too
big, say the word and I will explode that one into its own detailed checklist.

Legend: 🔴 blocks handing this to children · 🟠 hurts the experience · 🟡 polish · 🔵 nice to have

---

## 🔴 Critical — status

1. ✅ **~~Guest progress destroyed on sign-up~~ — FIXED & VERIFIED.**
   Proven on production: a guest with 240 sparks / 2 buddies / 2 builds / 4 quests was reset to
   zero on account creation. Now the richer save always wins and is carried up to the server.
   Re-verified after the fix: all 240/2/2/4 survived.
2. ✅ **~~The whole game is in English~~ — FIXED & VERIFIED across the whole site.**
   Full Bahasa Indonesia, now the **default**, on every surface a child or parent sees:
   - **Game:** every HUD label, menu, button, journal row, wardrobe item, tutorial tip, quest line,
     Skykeeper dialogue, plus the desktop keyboard-help line. Language toggle in the pause menu.
   - **Account/sign-in page** (the first screen a child meets): tabs, labels, hints, buttons,
     Terms & Privacy popups, and every status message.
   - **Landing page:** hero, all six feature cards, the three how-to steps, all five FAQ answers,
     stats and marquee.
   - **Family dashboard:** headings, add-a-child form, bulk-add, table headers, and all confirm dialogs.
   Verified live: `Mulai Petualangan`, `Kilau`, `Teman`, `Jurnal Langit`, `Dunia mungil`,
   `Dasbor Keluarga`, `Tambah anak`, plus a clean round-trip back to English in-game.
3. ✅ **~~No parent-driven child account creation~~ — FIXED & VERIFIED.**
   "Add a child" on the family dashboard. Children never type an email — a placeholder is minted
   server-side. Verified on production: parent created a child, child logged in successfully.
   *(The 12 real accounts still need to be created by you — one minute of typing, see below.)*
4. ✅ **~~No recovery for the parent account~~ — FIXED.**
   `npm run reset-parent` with `NEW_PASSWORD` in the environment. Requires database access, which
   only the parent has. No email provider needed.
5. ✅ **~~No rate limiting on `/api/login`~~ — FIXED & VERIFIED.**
   8 wrong tries per IP+username, then a 10-minute cool-off. Verified live: `401 ×8` then `429 ×2`.
   Honest limitation: the counter is per serverless instance, so it is a speed bump against online
   guessing, not a hard lockout. A shared store (Redis/Postgres) would be needed for that.
6. ✅ **~~No tests in the repository~~ — FIXED.**
   Four end-to-end suites now live in `test/`, each documented with the real bug it caught, plus a
   GitHub Actions workflow that syntax-checks everything and fails the build if a secret is committed.
7. ✅ **~~You must create the 12 child accounts~~ — deliberately not doing this.** The parent chose
   to let the children create their own accounts when they get home from school, rather than hand
   them pre-made ones. So the work moved to the sign-up screen instead: see #40. The family
   dashboard "Add a child" route still exists as a fallback for any child who gets stuck.
8. ✅ **~~The Neon database password has not been rotated~~ — rotated by the parent.**
9. ✅ **~~Two devices can overwrite each other~~ — FIXED & VERIFIED.**
   Replaced the whole-save "winner" with a **per-field merge**: sparks/treasures/bops take the max,
   unlocked/biomes/wonders take the union, pets/builds keep the richer list, a chosen cosmetic beats
   "none". On login both saves are merged and the result pushed back up, so neither device can wipe
   the other's work.

## 🟠 Important — real gaps in the experience

8. Quest snapshots (`quest.base`) are device-local; switching devices mid-quest can show odd
   progress like "0/10 sparks" after already collecting some.
9. Bopping a slime writes to the server on every single bop — noisy and wasteful.
10. No "are you sure?" when a child hits Undo repeatedly — builds vanish silently.
11. ✅ ~~No way to see which buddy is which level~~ — the 🐾 Buddies panel lists each one with level, mood and happiness bar.
12. ✅ ~~No feeding action~~ — feed buddies berries (found in seeds) from the 🐾 panel; raises happiness and grants XP.
13. ✅ ~~Buddies cannot be renamed~~ — rename any buddy from the 🐾 panel.
14. ✅ ~~No way to release a buddy~~ — **Pulangkan** in the 🐾 panel sends a slime home. It is
    the quietest button in the row and asks for confirmation first, because a child will hit it by
    mistake at least once.
15. Wardrobe has only 2 slots (hat, cape). No shoes, wings, colours, or face accessories.
16. Miru's own colours cannot be changed — no character customisation at all.
17. ✅ ~~No fast travel~~ — waypoint pillars unlock on touch and the 🧭 panel teleports you back to any of them.
18. ✅ ~~No map or compass~~ — a round minimap (bottom-right) shows islands, home 🏠, the Skykeeper ✦ and a home-compass when you wander off; M enlarges it.
19. Partly closed — rift gates and waypoint pillars are now two more landmark types, but the promised waterfall ring and lighthouse are still missing.
20. Weather (mist, petals, snow) was planned and never built.
21. ✅ ~~After 6 quests the Skykeeper has nothing new to say.~~ — **12 quests now.** The six new
    ones lean on the systems that arrived later: clear a rift, wake three waypoints, feed five
    berries, gather five buddies, reach rift depth three, find ten moonpetals. The risky part was
    the saved snapshot: a child mid-quest today has a save with none of the new counters, which
    would have turned into `NaN` and made the quest impossible to finish forever. Guarded, and
    `test/quests.test.mjs` loads exactly such an old save to prove it. Still one chain, still one
    NPC (#22).
22. No side quests from other NPCs — there are no other NPCs at all.
23. No cutscenes or story beats beyond dialogue boxes.
24. Journal counts things but shows no pictures — a codex without images is dull for pre-readers.
25. ✅ ~~No achievements/badges surface~~ — **12 badges** in the Sky Journal, each with an icon, an
    Indonesian name and a one-line "how to get it". Locked ones read *belum terbuka* in words, not
    just a grey colour. A badge is announced the moment it is earned (message + chime + burst),
    saved with progress, and merged across devices so it is never lost. Covered by
    `test/badges.test.mjs`.
26. Slimes only wander; no varied creature behaviours or personalities.
27. Nothing to do at night specifically, despite building a day/night cycle.
28. No seasonal events.
29. ✅ ~~No photo mode~~ — 📷 hides the HUD to frame a shot, Snap saves a PNG.
30. No local co-op, so 12 siblings can never play together.
31. Children cannot see each other's islands at all.
32. No family leaderboard/shared goal, despite the family dashboard existing.

## 🟠 Safety, privacy, and parental control

33. No playtime tracking or limits for parents.
34. No "last played" detail beyond a date — no session lengths.
35. No audit log of parent actions (password resets, deletions).
36. Deleting a child is irreversible with no export/backup of their world first.
37. No data export ("give me my child's data") despite promising a right to delete.
38. ✅ ~~Terms/Privacy live in alert() popups~~ — real, readable, bilingual pages (terms.html, privacy.html).
39. No age gate or parent-consent step at sign-up.
40. ✅ ~~Children must type an email at sign-up~~ — **email is now optional.** A child who does not
    have one leaves it blank and the server mints the same `@child.skyseed.local` placeholder the
    family dashboard uses. The password field is single (no hidden confirm) with a Show/Hide
    button, and errors arrive one at a time with focus moved to the field that needs fixing.
    Covered by `test/signup.test.mjs`, driven at a 420 px phone width.
    *Honest consequence:* a blank email means no email password recovery — the parent resets it,
    which was already the only recovery path.
41. ✅ ~~No security headers.~~ — `vercel.json` sets CSP, `X-Frame-Options: DENY`, nosniff,
    `Referrer-Policy`, HSTS and a `Permissions-Policy`, plus `no-store` on `/api/`. The CSP was
    narrowed to the hosts actually used (`unpkg.com` for three.js) after checking — a guessed CSP
    would have broken the whole game for every child at once.
42. Session cookies never rotate and cannot be revoked server-side (no logout-everywhere).
43. Password rules are minimal (8 chars, nothing else) and there is no strength meter.
44. No lockout/backoff after repeated failed logins (see #5).
45. ✅ ~~The Neon database password was pasted into a chat.~~ — rotated by you.

## 🎨 Graphics pass (from real screenshots this session)
- [x] Flat single-colour sky → gradient sky dome (zenith=sky, horizon=fog) that follows the camera and blends into the fog, plus a soft sun disc + glow that fades at night.
- [x] Great Tree canopy was one huge faceted pink icosahedron (ugly up close) → a full rounded canopy of many smooth overlapping blobs in two shades.
- [x] Regular tree leaves rounder (subdivided) + a second smaller blob for a fuller silhouette.
- [x] Fixed visible English leaks caught in the screenshots: HUD "next goal" unlock names, buddy count ("2 friends" → "2 teman"), and the title-screen help line.
- [x] **Camera clipping into trees — FIXED.** Added a camera→player raycast that pulls the camera in front of any blocking decoration. Two follow-up bugs were caught by screenshots and fixed: (a) an over-eager minimum distance produced an uncomfortable face-closeup, (b) clamping *up* to a minimum could place the camera **behind** the obstacle and render its interior as a full-screen blob.
- [x] **Title screen now shows the live drifting-island world.** The menu scrim became translucent, so the real orbiting world (islands, cherry canopies, waterfalls) renders behind the title instead of a flat gradient. Title text turned white with a shadow to stay legible.
- [x] **Grass varies per blade** — randomised height, lean, spin, and a colour blend between the biome's tuft and grass tones, so the field no longer looks stamped.
- [x] **Bloom-lite on collectibles.** Additive radial-gradient halos on seeds, stars, rings and moonpetals — the glow a post-processing bloom would give, at a fraction of the cost.
- [x] **Sun was a hard-edged flat disc washing out the screen — FIXED.** A `CircleGeometry` sun+glow rendered as a giant pale sticker over the world (caught in a screenshot). Replaced with soft radial-gradient additive planes that fade out naturally.
- [x] **Decorative sprites no longer break raycasts.** The new halos were being hit by the camera and build raycasters — this spammed console errors and **broke build placement entirely**. Halos, sun and sky dome are now excluded from all raycasts. *(Caught by the regression suite, not by eye.)*
- [x] **Sun no longer washes out the scene** *(see the sun entry above)*.
- [x] **Teleport camera fixed.** Entering a rift left the camera easing across the whole gap — measured **7,542 units behind the player**, so the room rendered as an empty screen. The camera now snaps on teleport (re-measured: 8.5). Found by probing real state through a test hook, not by guessing.
- [x] **Rift gate rendered as a grey sticker — FIXED.** The portal was an additive disc plus a 4.5-unit additive halo; over the pale daytime sky both saturated to white and read as a large grey slab pasted behind the arch. Now a dark indigo disc (a *hole*, not a lamp) with a small cyan swirl. Dark-on-light is what makes a gateway legible.
- [x] **Camera filmed the player through solid rock — FIXED.** Fast travel could leave the camera off the island edge over the void, where there is no ground to clamp against, so it sank below the rim and rendered the island's underside as a full-screen brown wall. It now falls back to the player's own ground height when over the void.
- [x] **Fast travel landed the player inside the waypoint pillar — FIXED.** You now arrive beside it.
- [ ] Water/waterfalls are static ribbons — no flow animation.
- [ ] No wind motion on grass or canopies (variation is static).
- [ ] Shadows are only cast by the sun light; no ambient occlusion contact shading.

## 🖥️ Graphics options — the "as complete as Genshin" request

The old menu offered two words, *Pretty* and *Fast*, wired to three lines of code. That is not a
graphics menu, and QA was right to say so. It is now a real one, and every dial is checked against
the live renderer rather than against the value it stored.

- [x] **Five presets** — Hemat Banget / Cepat / Seimbang / Cantik / Ultra, plus **Atur Sendiri**,
  which is what the label switches to the moment you move any single dial. Each preset is a bundle
  of the dials below it, so nothing is hidden.
- [x] **Sharpness (render scale) 50–200 %** — multiplies the device pixel ratio. Measured: the
  renderer's own `getPixelRatio()` moves from `0.6` on Potato to `1.35` on Ultra.
- [x] **Shadows: Off / Soft / Sharp** — off truly disables the shadow map *and* the sun's caster;
  sharp raises the map from 1024² to 2048². Measured on the renderer, not on the setting.
- [x] **View distance 90–320** — drives the fog, and now also drives how much world is built
  (see the pop-in fix below).
- [x] **Sparkles 0–150 %** — scales every particle burst.
- [x] **Frame limit: none / 30 / 45 / 60** — a real battery setting. Frames are skipped, but the
  accumulated delta is carried, so the world moves at the same speed at any cap.
- [x] **Show FPS** — an on-screen readout.
- [x] **Auto-adjust for my device** — the governor, now stepping down **one preset at a time**
  instead of dropping everything at once, and it stops after two steps so it can never spiral.
- [x] **Everything persists** and the panel re-reads itself, so after an auto-adjust the sliders
  show what is actually running instead of what you last chose.

### The FPS counter caught a real bug in the old governor
The frame-rate governor measured itself against the **clamped** frame delta. `dt` is capped at
50 ms so a stall cannot fling a child across the map — which means counting frames against it
reports a comfortable 20 FPS on a machine genuinely managing one, and the number can never fall
far enough to trigger anything. Measured in headless: the governor reported **21 FPS while the
browser was really running at 1.2**. That is why "auto-adjust" never rescued anyone. It now reads
`performance.now()`, and the test asserts the reported number matches an independently measured
one.

## 🧱 Solid world — "lantai tembus dan properti palsu"

Both complaints were the same complaint: nothing in the world pushed back.

- [x] **Trees and pillars were pure decoration.** You could walk through every trunk and every
  pillar in the game. They now carry cylinder colliders and resolve along the shortest way out, so
  you slide around a trunk instead of stopping dead on it.
- [x] **Pillars are platforms now.** A pillar *looks* like something to jump on; children jumped
  and fell straight through. Pillar caps are standable ground. This is most of what "lantai tembus"
  was describing.
- [x] **The floor test sweeps instead of sampling.** Asking only "am I below the floor right now"
  lets a fast fall step over a thin platform between two frames — the child lands on nothing and
  keeps going. The test now covers the span the feet actually travelled.
- [x] **The rift had no walls.** The cave was a disc of floor with a decorative ring around it and
  nothing else, so walking to the edge dropped you out of the room into the void — the
  "dungeon/gua tembus, tidak bisa dimasuki" report. It now has a real wall, rendered from the
  inside so the camera still looks down into the room, and the child is kept inside it.
- [x] **The rift room shipped without a `solids` list**, which the ground code walks on every
  island. Adding colliders to the rest of the world would have thrown on every frame inside a
  dungeon. Caught before it shipped, by the dungeon suite.
- [x] **Rift pillars are climbable** rather than scenery you walk through.

## 🎮 Controller and camera modes

- [x] **Windows controller support — ADDED.** There was no gamepad code in the project at
  all, which is the real reason QA could not test a controller: not that it was inverted,
  but that it was never read. The left stick now feeds **the same two numbers into the same
  movement line as the on-screen stick**, with the same sign, so the two physically cannot
  disagree about which way is forward. Right stick looks, bottom face button jumps, left
  face hits, shoulder buttons open the journal and map, Start pauses, Select flips the
  camera mode. Dead zone is rescaled rather than cut, so the stick starts at zero instead
  of jumping to 0.18.
- [x] **First person and third person — ADDED.** `V`, the on-screen button, or Select on a
  pad. Third person places the camera at `+(sin yaw, cos yaw)` behind the child, so the
  direction they walk is exactly `-(sin, cos)`; first person puts the camera at eye height
  and points it down that same vector. Forward means the same thing in both modes by
  construction, not by coincidence — and the test measures it in both. The avatar is hidden
  in first person rather than part-hidden, because a VRM head scaled away leaves a neck
  stump in shot.
- [x] Both are covered by `test/pad-view.test.mjs`, which installs a fake `getGamepads`
  reporting axes the way the Gamepad API specifies (x right, **y down**). If the game ever
  gets that sign wrong, the test walks the child backwards and fails.

## 🌍 Pop-in — "building masih hilang muncul"

Found, and it was arithmetic, not graphics. The world streamed islands out to `GEN_R 3` — 132
units — while the fog drew to **180**, and despawned them at 176, still inside clear view. So whole
islands, trees and pillars included, blinked in and out a third of the way inside the visible range
every time the player crossed a cell boundary.

- [x] The streamed radius now follows the view distance (3–6 cells), and the fog is pulled in
  behind the edge of the built world, so islands **fade in** instead of appearing.
- [x] A first run on a modest phone opens on *Seimbang*, not *Cantik*. A game that starts smooth
  reads as better than one that starts pretty and stumbles.

## 🎮 Controls — feel and key bindings

- [x] **Press feedback.** "Kontroller tidak ada animasi sama sekali" was accurate: a button that
  does not move under a thumb reads as broken even when it fired. Every control now shrinks on
  press, pulses a ring, and buzzes the phone for 12 ms — `:active` alone is not enough once
  pointer capture is involved, so the state is driven from the input code as well.
- [x] **Full key rebinding.** All sixteen actions are re-bindable from the pause menu, showing the
  letter on the cap (`W`, not `KeyW`). One key holds one job — rebinding onto a taken key releases
  the old one. Arrow keys and right Shift stay wired underneath as permanent alternates, so
  rebinding W never costs you the arrows. Reset restores everything, and choices survive a reload.
  Measured: after binding forward to `I`, `I` walks `0.35` and `W` walks `0.00`.
- [x] Every action a child needs on a phone already had a touch button, including TALK; the
  rebinding panel is for the desktop children, not a substitute for that.

## 🛒 Economy & dungeons (new direction — replaces the scrapped time-token)

**Decision:** an on-chain *play-time* token was designed and then **scrapped** — metering or
selling a child's play-time carries real legal risk. The main open world stays free and
unlimited. Only optional extras cost anything, and only in devnet test currency.

- [x] **SEED shop currency proven on devnet** — full loop executed on-chain: starter grant → buy a skin (transfer) → refill dungeon energy (burn). Balances reconcile. See [`PROOF-DEVNET.md`](PROOF-DEVNET.md).
- [x] **In-game shop (Seed Shop, key `T`)** — wallet strip, energy refill, three buyable skins, plain kid wording. Bought skins unlock as wearable outfits in the wardrobe. Covered by `test/shop.test.mjs`.
- [x] **Seeds have a source** — rarer pickups pay out (ring 1, star 2, moonpetal 5). There is no real-money path, by design.
- [x] **Energy meter in the HUD**, spent only on entering a rift.
- [x] **Sky Rift dungeons exist** — a room outside the streamed world with six crystals, a glowing core, and a reward chest (+25 Seeds). No enemies, no timer, no losing. Covered by `test/dungeon.test.mjs`.
- [x] **Five rift depths with different rooms** — depth 1–5, each with its own crystal layout (ring, spiral, double ring, scatter, helix), its own colour palette, and its own cost/reward (4→12 crystals, 15→55 Seeds). Clearing the deepest depth unlocks the next, so a child is never shown five locked doors at once. Standard tier ladder, nothing invented.
- [x] **Rift gates exist in the world** — a purple arch with a portal you walk into, scattered through the islands, showing a depth picker when you reach it. The HUD button still works as a shortcut.
- [x] **Waypoints + fast travel** — stone pillars you touch once to unlock (grey → glowing blue), then travel to from the 🧭 panel with the distance shown. The plain checkpoint/teleport convention every open world uses.
- [x] **Energy refills on its own** — one point every 6 minutes, tracked by timestamp so it keeps filling while the game is closed. The shop refill is now the impatient option, not the only option. A child who runs out is never stuck waiting on a purchase.
- [ ] Skin ownership is local only; not yet recorded as an on-chain attestation.
- [ ] Shop purchases in game are local — the proven devnet loop is not yet wired to the buy buttons.
- [ ] Parent-side spending limits and purchase history in the family dashboard.

## 🟡 Performance and robustness

46. VRM is still 6.7 MB — the single biggest download. Mesh compression untried (texture-only so far).
47. No skeleton/placeholder for the world while chunks stream in.
48. ✅ **~~No FPS display or diagnostics~~ — ADDED.** *Show FPS* in the pause menu, reading the
    wall clock. It immediately earned its keep: it proved the auto-adjust governor had been
    measuring a clamped delta and reporting 21 FPS on a machine running at 1.2.
49. `game.js` is now ~3,000 lines in a single file — hard to maintain, no modules. Growing, not shrinking.
50. No error monitoring: if the game throws on a child's phone, nobody ever finds out.
51. No offline indicator when the server sync fails (only a transient toast).
52. Service worker never notifies about a new version; a stale shell can persist.
53. ~~PWA icon is a single SVG.~~ ✅ Real 192/512 PNG icons generated and precached by the
    service worker, so the home-screen icon is crisp on Android.
54. ~~Manifest forces `landscape`.~~ ✅ Now `any`. This exposed a worse bug: on a phone held
    upright the journal, wardrobe and pause cards were taller than the screen with no scroll,
    so the top was cut off and Close could not be reached. All three now scroll.
55. No handling for localStorage being full or blocked (private mode).
56. Progress payload has a 200 KB cap but the game never warns before hitting it.
57. Many builds in one place will still hurt low-end phones — no instancing for placed pieces.
58. No lazy loading of the VRM; it downloads even for a player who never presses Start.

## 🟡 Accessibility

59. No keyboard-only path for building/riding on desktop without a mouse.
60. ~~Colour is the only signal for wardrobe state.~~ ✅ Locked items already showed a reason;
    the item you are *wearing* now says so too (✓ plus `aria-pressed` and a spoken label).
61. No screen-reader landmarks on the game HUD.
62. Dialogue cannot be re-read once dismissed — no log.
63. No subtitles/visual cue for audio events for deaf players.
64. No dyslexia-friendly font option.
65. High-contrast mode covers the HUD only, not menus, journal, or wardrobe.
66. No text-size control for the dialogue box specifically.
67. Touch buttons are fixed-position and can collide on very small screens.

## 🔵 Product and polish

68. No onboarding for the parent (how to make 12 accounts, what the dashboard does).
69. ~~Landing page still describes the old, smaller game.~~ ✅ Rewritten in Indonesian, false
    "no accounts / progress resets on close / ten islands" claims corrected to match reality.
70. No changelog for children ("what's new this week") — a real returning hook.
71. No sound settings per-category beyond music/sfx (no ambience slider).
72. Music is generative and can get repetitive over long sessions.
73. No haptics beyond pickup.
74. No credits screen.
75. ~~No 404 page.~~ ✅ Indonesian 404 with a way back to the game and to the front page.
76. No favicon set beyond the emoji SVG.
77. No analytics at all, so there is no evidence about where children get bored.
78. No A/B or telemetry on unlock pacing — spark thresholds are guesses.
79. Unlock names are English puns that will not translate.
80. No difficulty/assist options (e.g. bigger collect radius for younger children).
81. No "reset my world" option for a child who wants a fresh start.
82. Build pieces cannot be moved after placing, only undone in order.
83. No copy/paste or blueprints for builds.
84. No naming of islands.
85. No indicator of which island is "home".

## 🔵 Engineering hygiene

86. No CI: nothing runs the checks automatically on push.
87. No linter or formatter config.
88. No TypeScript or JSDoc types on a 1,600-line file.
89. No database migration system — schema changes are manual.
90. No database backup or restore runbook.
91. No staging environment; every deploy goes straight to production.
92. `.env.local` holds real credentials on one machine with no documented recovery.

---

## Scoreboard

- **Closed this pass:** 6 of the 7 critical items (guest data loss, Indonesian, parent-created child
  accounts, parent recovery, rate limiting, tests + CI). Also #40 (children no longer type an email)
  and #44 (login backoff).
- **Closed since:** fast travel + waypoints, rift gates in the world, five dungeon depths, energy
  regeneration, two graphics artefacts, self-service child sign-up, 12 badges, the family board,
  a 12-quest Skykeeper chain, releasing a buddy, security headers, real PWA icons, and a 404 page.
- **Closed from the QA report:** the inverted stick, dead controls on desktop, and the complete
  absence of a landscape layout. See below.
- **Found by testing, not by eye:** allowing portrait in the manifest revealed that the journal,
  wardrobe and pause cards were taller than a phone screen with no scroll — the top was cut off and
  Close was unreachable. Fixed. This is the second time this pass a headless screenshot caught
  something that reading the code would not have.
- **Still open:** ~70 items, **none of which need you rather than me.** Nothing blocks handing the
  game to a child this afternoon.

## 🎮 Controls — the QA report, item by item

- ✅ **~~Joystick and keys inverted~~ — FIXED & MEASURED.** `iz` was built backward-positive while
  the vectors that consume it were written forward-positive, so W and stick-up drove the child
  *toward* the camera. Every direction is now measured against where the camera actually looks:
  W `+0.34` (was `−0.30`), S `−0.35`, D `+0.35`, A `−0.35`, stick-up `+0.83`, stick-right `+0.83`.
- ✅ **~~Buttons not integrated / controls dead on desktop~~ — FIXED.** The stick and the JUMP/POW
  buttons listened for `touchstart` only, so a mouse or a touchscreen laptop got nothing. They now
  run on Pointer Events — one path for finger, stylus and mouse — plus a keyboard path (`click`
  with `detail 0`) so Tab + Enter works. The knob also releases on window blur, so a lost pointer
  can no longer leave a child walking forever.
- ✅ **~~No landscape layout at all~~ — ADDED.** A landscape block for short screens shrinks the
  stick and buttons, tightens the side columns, and tucks everything inside
  `env(safe-area-inset-*)` (with `viewport-fit=cover`) so a notch or home bar never covers the
  stick. Measured at 780×390: all 9 controls on screen, none under 40 px, none overlapping.
- ✅ **~~Controls never appear on mobile~~ — NOT REPRODUCED, and hardened anyway.** On an emulated
  phone the stick is present and nothing covers it (`elementFromPoint` → `stick`). The old CSS
  gated visibility on `(pointer:coarse)` alone, which hides the controls on a touchscreen laptop
  that also reports a mouse; visibility is now driven by a `body.touchUI` class set from the same
  check the input code uses, so what a child sees always matches what responds.
- ✅ **~~Floor fall-through ("lantai tembus")~~ — FOUND AND FIXED.** The earlier pass looked for
  a tunnelling bug and found none, which was the wrong question. There was no floor to fall
  through: **pillars had no collision at all**. A child jumps at a pillar because it looks like a
  platform, and passes straight down through it. The rift room was worse — a disc of floor with no
  walls, so walking to the edge dropped you into the void. Pillar caps are now standable ground,
  the rift has a wall, and the floor test sweeps the span the feet travelled instead of sampling a
  single instant. See the **Solid world** section above.
- ✅ **~~A cleared rift ejected the child~~ — FIXED.** Found by the test suite disagreeing with the
  code: claiming the chest ran `setTimeout(exitDungeon, 1800)`, so the child was yanked out of the
  room 1.8 seconds after opening the treasure, mid-celebration, with no say in it. The room now
  stays open and LEAVE is the child's own choice. **This test had been passing by luck** — under
  heavy load the timer fired late enough to look correct, which is why it was previously written
  off as a flaky test rather than the real bug it was pointing at.
- ✅ **~~Buildings flickering~~ — FOUND AND FIXED.** Arithmetic, not graphics: the world was built
  to 132 units while the fog drew to 180, so islands popped in and out well inside clear view. See
  **Pop-in** above.
- ✅ **~~Dungeon walls passable~~ — FIXED.** The room had no walls at all. See **Solid world**.
- ✅ **~~Interiors (house / cave / mountain / arena)~~ — ALL FOUR SHIPPED.** Every one is a room
  you walk into through a doorway that exists in the world, not a menu that swaps the screen.

  - **Cottage** — hearth with a live fire, bed, table, rug. Standable furniture.
  - **Cave** — a domed rock shell, four crystal clusters that actually light the room, hanging
    stalactites, a pool, and a boulder you can climb onto.
  - **Mountain** — the one that is a climb rather than a room: a hollow peak with a spiral of
    eight standable ledges rising to daylight at the open summit.
  - **Arena** — a sand ring with three tiers of seating, a podium you can stand on, four lit
    braziers and eight banners.

  They share one machine. `INTERIORS` describes each room's size, arrival point and name; a
  furnisher places its geometry in room-local coordinates and declares its collision through the
  same `solid()` call, so a room's furniture cannot drift out of step with what you bump into.
  Everything else — collision, camera, the way out, the streaming — is the code the cottage
  already proved, which is why these inherited working behaviour instead of repeating the rift's
  two bugs.

  Entrances are placed where they belong rather than sprinkled evenly: cave mouths favour the
  rocky and crystal biomes, peaks need a big island, and an arena is rare enough that finding one
  is an event. The ENTER button relabels itself for the doorway you are standing in front of —
  a cave mouth that says ENTER reads as a bug.

  `interior.test.mjs` walks into a real cottage door and, for each of the other three, checks the
  floor holds, then walks hard at all four walls and confirms the child is still inside and still
  above the void, then leaves and lands back on the doorstep.
- 🟡 **In-game purchase on Solana devnet — BUILT, one step from provable.** The shop now has a
  server-authoritative purchase path (`api/buy.js`) that holds the prices, checks the balance,
  moves it, and writes a receipt to Solana devnet as a memo transaction. The child gets a link
  straight to the explorer showing their own transaction.

  Three decisions worth stating plainly, because an auditor will ask about each:

  1. **The cluster is pinned in code**, not read from the environment. Devnet with a
     zero-value token is the only setting in which the rest of this design is acceptable, so
     moving to mainnet is deliberately not a dashboard edit. See the note at the top of
     `api/_solana.mjs`.
  2. **The treasury key is custodial and server-side.** Twelve children have no wallets, and
     devnet SOL cannot be earned without one. This is defensible *only* because the key guards
     nothing: devnet SOL is free, and SKY has zero monetary value by design. On mainnet the same
     design would be a real custody problem and a different product with different law attached.
  3. **The chain is not in the critical path.** Seeds move in the database first; the receipt is
     written afterwards, and every failure in it is reported as a missing receipt rather than a
     failed purchase. A child who earned a hat gets the hat even when devnet is having an
     afternoon.

  **What is not yet proven:** a live devnet submission. That needs a funded devnet keypair in
  `SOLANA_TREASURY_KEY`, and this machine has none — the public faucet meters by IP and is
  exhausted. `purchase.test.mjs` therefore proves everything up to the send: the cluster is
  pinned, a malformed key stands the feature down instead of crashing the shop, the receipt
  serialises to a real signed memo transaction carrying the purchase, the explorer link points
  at devnet, and — the one that would actually bite — the server's price list matches the shop
  the child is looking at, item by item. A catalogue that has drifted rejects honest purchases,
  which reads to a child as a broken game and to an auditor as a fake shop.

  Set `SOLANA_TREASURY_KEY` (base58/JSON array of a funded devnet keypair) in the Vercel
  environment and receipts start appearing with no code change.

- ❌ **Real-time co-op with sub-4 ms latency — NOT POSSIBLE AS SPECIFIED.** Under 4 ms round trip
  over the internet is ruled out by the speed of light in fibre (Jakarta–Singapore alone is ~5 ms),
  independent of code quality. Real-time play is worth building (#31); the 4 ms figure is not a
  target that any implementation can meet and should be corrected with whoever set it.

## Test suite

`i18n`, `world`, `dungeon`, `shop`, `badges`, `family`, `signup`, `quests`, `portrait`, `controls`
all pass headless. `browser` reports CHECK locally because `/api/*` has no server on a static file
host — that is expected, not a failure.

`controls` is new: it never reads the code, it presses a key or drags the knob and then measures
which way the body moved relative to where the camera is looking. It also drives the phone layout
through a real touchscreen on a fresh mobile page — an earlier version resized the desktop page
instead and reported the stick dead when it was fine, so the test was wrong, not the game.

## Suggested order of work

**Needs you: nothing is blocking any more.** The database password is rotated, and the twelve
accounts are deliberately left for the children to create themselves — which is why the sign-up
screen was rebuilt around a child working alone (#40).

**Needs you, one line:** where does a child fall through the floor? Island edge, after a double
jump, or leaving a dungeon? Two causes are already ruled out and that sentence narrows the rest
far faster than guessing would.

**Next up for me, highest value first:**
1. Children seeing each other's islands (#31) — the family board proves they exist; this would let
   them visit. The single biggest remaining thing for twelve siblings playing at once.
2. Journal with pictures (#24) — the codex is numbers only, which is dull for a child who cannot
   read fluently yet.
3. A second NPC with side quests (#22) — there is still exactly one voice in the world.
4. Waterfall and lighthouse landmarks (#19) — promised, still missing.
5. Weather (#20) and something to do at night (#27) — the day/night cycle currently changes nothing.
6. Error monitoring (#50) — if the game throws on a child's phone this afternoon, nobody finds out.
7. VRM size (#46) — 6.7 MB is still the biggest download on a slow connection.
