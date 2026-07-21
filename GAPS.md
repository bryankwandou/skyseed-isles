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

## 🔴 Critical — fix before the kids get accounts

1. **~~Guest progress destroyed on sign-up~~ — FIXED & VERIFIED this pass.**
   Proven on production: a guest with 240 sparks / 2 buddies / 2 builds / 4 quests was reset to
   zero on account creation. Now the richer save always wins and is carried up to the server.
2. **The 12 child accounts do not exist yet.** The database holds exactly one account (the parent).
   Nothing has been handed to any child.
3. **The whole game is in English; the children are Indonesian.** Zero Indonesian strings in the
   code. A 6-year-old cannot read "Feather Glide — hold jump while falling to float!". This is the
   single biggest barrier between the current build and a child actually enjoying it.
4. **No recovery for the parent account.** If you forget the parent password, nobody can reset it —
   there is no email flow and the parent is the only one who can reset others. Total lockout.
5. **No rate limiting on `/api/login`.** Unlimited password guesses against a real account.
6. **Two devices overwrite each other.** The score-based merge now prevents *catastrophic* loss, but
   a child who builds on a tablet and then plays on a phone can still lose the smaller session's
   work. Needs real per-field merge or a timestamp + "keep which?" prompt.
7. **No tests in the repository.** Every test written this project lives in a scratch folder outside
   git. Nothing stops a future change from silently re-breaking any verified feature.

## 🟠 Important — real gaps in the experience

8. Quest snapshots (`quest.base`) are device-local; switching devices mid-quest can show odd
   progress like "0/10 sparks" after already collecting some.
9. Bopping a slime writes to the server on every single bop — noisy and wasteful.
10. No "are you sure?" when a child hits Undo repeatedly — builds vanish silently.
11. No way to see *which* buddy is which level; the HUD only shows a count.
12. No feeding action; petting is the only care verb (feeding was promised in the roadmap).
13. Buddies cannot be renamed — a child naming their pet is a huge attachment lever.
14. No way to dismiss/release a buddy, so a mis-befriended slime is permanent.
15. Wardrobe has only 2 slots (hat, cape). No shoes, wings, colours, or face accessories.
16. Miru's own colours cannot be changed — no character customisation at all.
17. No fast travel; crossing biomes on foot gets long once the world opens up.
18. No map or compass — children get disoriented in an endless world.
19. Great Trees are the only landmark type; the promised waterfall ring and lighthouse are missing.
20. Weather (mist, petals, snow) was planned and never built.
21. Only one quest chain; after 6 quests the Skykeeper has nothing new to say.
22. No side quests from other NPCs — there are no other NPCs at all.
23. No cutscenes or story beats beyond dialogue boxes.
24. Journal counts things but shows no pictures — a codex without images is dull for pre-readers.
25. No achievements/badges surface, despite plenty of trackable milestones.
26. Slimes only wander; no varied creature behaviours or personalities.
27. Nothing to do at night specifically, despite building a day/night cycle.
28. No seasonal events.
29. No photo mode (planned; strong sharing hook for kids).
30. No local co-op, so 12 siblings can never play together.
31. Children cannot see each other's islands at all.
32. No family leaderboard/shared goal, despite the family dashboard existing.

## 🟠 Safety, privacy, and parental control

33. No playtime tracking or limits for parents.
34. No "last played" detail beyond a date — no session lengths.
35. No audit log of parent actions (password resets, deletions).
36. Deleting a child is irreversible with no export/backup of their world first.
37. No data export ("give me my child's data") despite promising a right to delete.
38. Terms/Privacy live in `alert()` popups — not readable, not printable, not real pages.
39. No age gate or parent-consent step at sign-up.
40. Children type their own email at sign-up; for a family flow the parent should create accounts
    and children should never enter an email.
41. No CSP or security headers (`X-Frame-Options`, `Referrer-Policy`, etc.).
42. Session cookies never rotate and cannot be revoked server-side (no logout-everywhere).
43. Password rules are minimal (8 chars, nothing else) and there is no strength meter.
44. No lockout/backoff after repeated failed logins (see #5).
45. The Neon database password was pasted into a chat and **still has not been rotated**.

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
69. Landing page still describes the old, smaller game.
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

## Suggested order of work

**Next (highest value per hour):**
1. Indonesian translation (#3) — unlocks the game for the actual players.
2. Create the 12 child accounts properly, parent-driven, no child emails (#2, #40).
3. Parent account recovery (#4) + login rate limiting (#5, #44).
4. Commit the test suite and wire CI (#7, #86).
5. Rotate the leaked database password (#45) — needs you, not me.

**Then:** buddy naming + feeding (#12, #13), map/compass (#18), photo mode (#29),
per-field save merge (#6), real Terms/Privacy pages (#38).
