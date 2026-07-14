# Skyseed Isles — 100-Day Development Plan

A realistic, phased roadmap toward a genuinely engaging, safe, AAA-*feeling* experience that competes with the open-world games kids are drawn to (RDR/Roblox) — without mature content, dark patterns, or addiction mechanics.

Guiding rules for every phase:
- **Safe by design.** No punishing fail states, no anxiety timers, no loot-box gambling, no ads, no data selling. A parent supervises accounts.
- **Ship small, ship verified.** Every item is testable in a real browser before it's called done.
- **Phones first.** Stay tiny enough for a 16GB phone; watch bundle size and draw calls each phase.
- **Intrinsic motivation.** Autonomy (free exploration), mastery (skill growth), relatedness (buddies, family co-op later) — the healthy engine that actually makes games sticky.

Each "day" is a working unit, not a literal calendar day. Reorder freely.

---

## Phase 0 — Foundation (DONE)
- Endless procedural world with biome rings (Meadow, Sunset, Snow, Starfall, Candy).
- Persistent unlock ladder (sparks → 7 abilities).
- Befriendable, levelling pet buddies that follow in a conga line.
- Build/decorate mode (5 piece types) with saved placements + undo.
- Rigged VRM anime avatar with run/punch/idle animation and primitive fallback.
- Neon Postgres accounts: register (terms + privacy consent), login, logout, session cookies (httpOnly, JWT), bcrypt-hashed passwords, server-synced progress, admin QA account with max progress.
- Live on Vercel with serverless API functions.

## Phase 1 (Days 1–15) — Feel & polish: "it plays like a real game"
1. Camera collision — camera never clips through islands/terrain.
2. Coyote-time + jump buffering for forgiving platforming.
3. Landing squash + dust puff; run dust; glide wind streaks.
4. Footstep / jump / land sound effects; gentle ambient wind per biome.
5. Background music: calm loop per biome, crossfade on biome change, mute toggle.
6. Soft bloom on sparks/crystals/lanterns (performance-gated, off on low-end).
7. Loading screen with progress bar while the VRM avatar streams in.
8. Settings menu: music/sfx volume, quality preset (shadows, grass density, draw distance), invert-look, camera sensitivity.
9. Mobile control polish: bigger hit areas, optional haptic tick on pickup, auto camera-follow assist while running.
10. Pause menu: resume, settings, how-to-play, log out, back to title.
11. Frame-rate governor: auto-reduce grass instances/draw distance when FPS dips below 30.
12. Accessibility: high-contrast HUD option, larger-text option, `prefers-reduced-motion` respected everywhere.
13. First-run contextual tutorial prompts (appear once, skippable, saved to profile).
14. "Progress saved" micro-toast on server sync success; offline badge when sync fails.
15. Phase QA pass on low-end Android + desktop; fix list burned down.

## Phase 2 (Days 16–30) — Content depth: reasons to keep exploring
16. Three or four new biomes: desert dunes, crystal caverns, autumn woods, aurora peaks.
17. Landmark "wonder" islands (a giant tree, a waterfall ring, a lighthouse) that anchor navigation and memory.
18. Day/night cycle + light weather (drifting mist, falling petals/snow); night reveals glow-collectibles.
19. Rare biome-specific treasures (moonpetals, sunshards) with distinct pickup fanfare.
20. Journal/Codex screen: creatures befriended, biomes discovered, treasures collected — the completionist hook.
21. Hidden mini-caves and secret ledges with a guaranteed reward.
22. Gentle traversal challenges: floating ring courses, updraft glide corridors (no fail state — retry instantly).
23. Cosmetic wardrobe for Miru: outfits/colors earned by exploration, never paid.
24. Buddy care: feed and pet interactions raise happiness; happy buddies do tricks and find bonus sparks.
25. Two or three new buddy species with unique silhouettes and idle animations.
26. Spark economy tuning across the whole unlock ladder.
27. Slime variety: rare shiny variants for the Journal.
28. Ambient critters (butterflies, birds) that flee/react — world feels alive.
29. Landmark fast-travel: unlock "sky gates" between visited wonders.
30. Phase QA pass; balance from real play sessions with the kids.

## Phase 3 (Days 31–45) — Light story & world identity
31. A friendly guide NPC — the **Skykeeper** — with short, warm dialogue and a distinct silhouette.
32. Main quest spine: *the islands are drifting apart; help the Skykeeper reconnect them* (hopeful stakes, no villains that frighten).
33. Quest system + tracker UI: current objective, gentle hint arrow, zero timers.
34. Six to eight side quests from island NPCs: fetch, photograph, plant-a-garden, befriend-N-buddies.
35. Quest rewards that matter: a new traversal ability, a cosmetic, a buddy egg, a rebuilt bridge that permanently changes the world.
36. Minimal cutscene framework: scripted camera moves + dialogue boxes, skippable.
37. Environmental storytelling: ruins, murals, tiny picture-notes (light reading, image-supported for pre-readers).
38. Named regions with a one-line lore blurb on first discovery.
39. A "home island" the child restores step by step across the story — ownership + visible progress.
40. Dialogue localization scaffold (English + Indonesian from day one).
41. Story beats reviewed for age-appropriateness (no death, no dread).
42. Music stingers for quest complete / discovery moments.
43. NPC idle animations and greeting waves.
44. Save story state server-side alongside progress.
45. Phase QA: full story playthrough on mobile + desktop.

## Phase 4 (Days 46–60) — Creation & ownership (the Roblox/Minecraft pull)
46. Build mode 2.0: grid snap, rotation, free-height stacking, move-existing.
47. Big piece catalog: paths, fences, bridges, houses, furniture, banners, ponds.
48. Paint/recolor any placed piece.
49. Terrain touches: grass patches, flower beds, glow-stones.
50. Named saved creations; read-only share-link snapshots (no chat, parent-approved).
51. Photo mode: pose Miru + buddies, filters, frame stickers, save image.
52. Build challenges/blueprints ("build a cozy cabin") with cosmetic rewards.
53. Undo/redo stack and build history per island.
54. Anti-grief by design: builds are per-account; shared views are read-only.
55. Dense-build performance: instanced rendering, chunked culling of placed pieces.
56. Build-piece unlock trickle tied to exploration (new biome → new pieces).
57. "Visit your own islands" map screen showing everywhere the child has built.
58. Template starter-builds for younger kids (tap to place a whole garden).
59. Server-side build persistence with size quotas per account.
60. Phase QA: 500+ placed pieces at 30fps on a low-end phone.

## Phase 5 (Days 61–75) — Social & family (safe relatedness)
61. Household model: one parent account manages the 12 kids' accounts.
62. Parent dashboard: playtime summaries, per-child progress, reset/delete data, approve share links.
63. Visit-a-sibling: read-only walk through another child's island (same household only).
64. Emoji/sticker "waves" between siblings instead of free text (safety by construction).
65. Local co-op experiment: two players on one screen (stretch goal).
66. Cooperative family goals: combined spark totals unlock a shared family monument.
67. Seasonal events (spring bloom, winter lights) that *return every year* — no FOMO, nothing missable forever.
68. "Wonder of the day": one highlighted island with a bonus — a reward for showing up, never a punishment for missing.
69. Household invite flow (parent creates child accounts; children never enter emails).
70. COPPA-minded data minimization review: store only what the game needs.
71. Right-to-delete: one-click account + data erasure from the parent dashboard.
72. Abuse/rate-limit hardening on all social endpoints.
73. Content moderation pass on every sharable surface (names, stickers).
74. Privacy policy + terms pages written in plain language (and kid-readable versions).
75. Phase QA with the real family: 12 accounts, concurrent play.

## Phase 6 (Days 76–90) — Platform & reach
76. PWA: installable, offline-capable shell, home-screen icon, splash screen.
77. Asset diet: meshopt/Draco-compress the VRM, lazy-load textures, target < 6MB first load.
78. Cloud-save conflict handling: timestamped last-write-wins + "keep which?" prompt on true conflicts.
79. Guest → account migration: carry localStorage progress into a new account on first login.
80. Privacy-safe aggregate analytics (opt-in) to find boredom points — no individual tracking.
81. Error monitoring on client + serverless with alerting.
82. Rate limiting + lockout backoff on auth endpoints.
83. Password reset via email magic link.
84. Google sign-in (finish the "coming soon" button).
85. Full localization: English + Indonesian UI and story text.
86. Low-end Android device lab pass (2GB RAM target).
87. Tablet + desktop layout polish.
88. Lighthouse performance/accessibility audit ≥ 90.
89. Serverless cold-start optimization (bundle trim, region pinning near users).
90. Phase QA: cross-device matrix signed off.

## Phase 7 (Days 91–100) — Hardening & launch
91. Security review: authz on every endpoint, input validation sweep, secret rotation (DB password, AUTH_SECRET).
92. Load test serverless + Neon pooling under family-peak concurrency.
93. Database backup/restore runbook + tested restore.
94. Accessibility audit: contrast, keyboard, screen-reader labels, reduced motion.
95. Full content review for age-appropriateness across all text/art.
96. Parent onboarding: 60-second "how to set up your family" guide.
97. Landing page refresh with real gameplay footage and honest copy.
98. PWA/store listing assets: icons, screenshots, description.
99. Soft launch to the 12 kids; watch, listen, fix the top 10 issues.
100. Public launch + a living post-launch backlog seeded from real feedback.

---

## What "AAA feel" means here (and what it does not)
It means responsive controls, a camera that behaves, satisfying feedback (sound, particles, animation), a world with landmarks and identity, a reason to come back tomorrow, and things to make and own. It does **not** mean photorealism, violence, or manipulative retention loops. Kids stay because the game respects them and there is always something delightful to do next — the same reason Minecraft and Zelda endure while trend games burn out.

See `CHECKLIST.md` for the granular, living task list.
