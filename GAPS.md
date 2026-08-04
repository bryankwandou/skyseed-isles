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
7. 🔴 **Still open — you must create the 12 child accounts.** The database holds one account.
   Use the family dashboard → "Add a child". Nothing is handed to any child until you do.
8. 🔴 **Still open — the Neon database password has not been rotated.** It was pasted into a chat.
   Only you can do this: Neon Console → Reset password → update `DATABASE_URL` in Vercel.
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
14. No way to dismiss/release a buddy, so a mis-befriended slime is permanent.
15. Wardrobe has only 2 slots (hat, cape). No shoes, wings, colours, or face accessories.
16. Miru's own colours cannot be changed — no character customisation at all.
17. ✅ ~~No fast travel~~ — waypoint pillars unlock on touch and the 🧭 panel teleports you back to any of them.
18. ✅ ~~No map or compass~~ — a round minimap (bottom-right) shows islands, home 🏠, the Skykeeper ✦ and a home-compass when you wander off; M enlarges it.
19. Partly closed — rift gates and waypoint pillars are now two more landmark types, but the promised waterfall ring and lighthouse are still missing.
20. Weather (mist, petals, snow) was planned and never built.
21. Only one quest chain; after 6 quests the Skykeeper has nothing new to say.
22. No side quests from other NPCs — there are no other NPCs at all.
23. No cutscenes or story beats beyond dialogue boxes.
24. Journal counts things but shows no pictures — a codex without images is dull for pre-readers.
25. No achievements/badges surface, despite plenty of trackable milestones.
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
40. Children type their own email at sign-up; for a family flow the parent should create accounts
    and children should never enter an email.
41. No CSP or security headers (`X-Frame-Options`, `Referrer-Policy`, etc.).
42. Session cookies never rotate and cannot be revoked server-side (no logout-everywhere).
43. Password rules are minimal (8 chars, nothing else) and there is no strength meter.
44. No lockout/backoff after repeated failed logins (see #5).
45. The Neon database password was pasted into a chat and **still has not been rotated**.

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
48. No FPS display or diagnostics for debugging a slow device.
49. `game.js` is ~1,600 lines in a single file — hard to maintain, no modules.
50. No error monitoring: if the game throws on a child's phone, nobody ever finds out.
51. No offline indicator when the server sync fails (only a transient toast).
52. Service worker never notifies about a new version; a stale shell can persist.
53. PWA icon is a single SVG — Android prefers 192/512 PNG icons for a crisp home-screen icon.
54. Manifest forces `landscape`, which fights portrait-holding children.
55. No handling for localStorage being full or blocked (private mode).
56. Progress payload has a 200 KB cap but the game never warns before hitting it.
57. Many builds in one place will still hurt low-end phones — no instancing for placed pieces.
58. No lazy loading of the VRM; it downloads even for a player who never presses Start.

## 🟡 Accessibility

59. No keyboard-only path for building/riding on desktop without a mouse.
60. Colour is the only signal for locked wardrobe items (plus a lock emoji) — no text state.
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
75. No 404 page.
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
- **Still open:** ~84 items, of which **2 need you rather than me**: create the 12 child accounts,
  and rotate the Neon password.

## Suggested order of work

**Needs you (5 minutes):**
1. Family dashboard → "Add a child" × 12.
2. Neon Console → reset the database password → update `DATABASE_URL` in Vercel.

**Next up for me, highest value first:**
1. ~~Translate account, dashboard and landing pages.~~ ✅ Done — whole site is Indonesian.
2. Buddy naming + feeding (#12, #13) — naming a pet is the strongest attachment lever we are missing.
3. Map / compass (#18) — children currently get lost in an endless world with no way to orient.
4. Real Terms & Privacy pages instead of `alert()` popups (#38).
5. Per-field save merge (#9) to close the last data-loss path.
6. Photo mode (#29) — the sharing hook siblings will actually use.
