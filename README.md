<div align="center">

# 🌱 Skyseed Isles

### An endless, gentle 3D open world — built kid-first, safe by design.

*Miru, a young sky gardener, drifts across floating islands that never run out. Gather sparks, learn new moves, befriend slimes and raise them until they grow wings, then build islands of your own.*

**No timers · No game-over · No ads · No purchases · No loot boxes · No data selling**

`Three.js` · `Vanilla JS (no build step)` · `PWA / installable` · `Runs in any modern browser`

[▶ Play now](https://skyseed-isles.vercel.app/play/) · [Landing page](https://skyseed-isles.vercel.app/) · [Controls](#-controls) · [Safety pledge](#-safety-pledge)

</div>

---

## ✨ Statement

Most games made "for kids" are built to *keep* kids — timers that punish leaving, streaks that create anxiety, chests that beg for money, ads that harvest attention. **Skyseed Isles is the opposite.** It is an open, endless world a child can wander for five minutes or an hour, put down without penalty, and come back to exactly where they left off. Nothing is ever lost. Nothing is ever sold. Nothing is ever scary.

It is engineered to be *compelling the honest way* — through discovery, mastery, and care for a companion — at the visual and interaction bar of a modern 3D game, while remaining provably safe for young children.

---

## 🎮 What's in it

| | |
|---|---|
| 🗺️ **Endless world** | Islands stream in as you explore, ringed into **nine biomes** — Meadow, Sunset Grove, Snow, Starfall, Candy Reef, Desert Dunes, Crystal Caverns, Autumn Woods, Aurora Peaks — deterministic so every child sees the same island in the same place. |
| 🪜 **Unlock ladder** | Sparks earn new moves: higher jump, glide, triple hop, spark magnet, faster sprint, sparkle trail, floaty cloud steps. Skill, not spending. |
| 🐾 **Buddies you raise** | Befriend a slime by being kind. It follows in a bouncy conga line, remembers its name, gets hungry, and grows when you feed and pet it. |
| 🪽 **Ride & fly** | At Lv 4 you climb on and ride. At Lv 8 your buddy grows wings — hold jump and you fly together. |
| 📖 **A story to follow** | The Skykeeper gives a six-quest chain about reconnecting the drifting isles, tracked live in the HUD and Sky Journal. |
| 🌟 **Discovery** | Rare glowing moonpetals, shiny golden slimes, and giant Great Tree landmark islands — all recorded in the Journal. |
| 🔨 **Build mode** | Nine piece types (tree, flower, mushroom, lantern, crystal, fence, bench, arch, path), free rotation, undo — and everything stays put between visits. |
| 👗 **Wardrobe** | A modest default outfit plus hats, capes and unlockable outfits — every one **earned by exploring, never bought.** |
| 🌅 **Gentle day & night** | A five-minute cycle that never gets darker than dusk. |
| 👪 **Accounts & family** | Optional sign-up saves progress across devices; a parent dashboard shows every child's progress and can reset passwords. Children's accounts are created by the parent — no child email required. |
| 📱 **Installable** | A full PWA — add to a home screen and it runs like a native app, online or off. |

---

## 🛡️ Safety pledge

Skyseed Isles is designed to satisfy a cautious parent *and* a strict store reviewer.

- **No violence.** "Bopping" a slime is optional and harmless — it giggles, wobbles, and bounces right back. There is no health, no death, no combat, no blood.
- **No failure states.** No game-over, no timers, no punishment. Falling off an island simply floats you back.
- **No money.** No purchases, no in-app currency you can buy, no loot boxes, no ads, no upsells. Every cosmetic is earned by playing.
- **No strangers.** No open chat, no multiplayer lobbies, no user-to-user messaging. The only "social" surface is the parent-run family dashboard.
- **No data harvesting.** No third-party trackers or ad SDKs. Accounts store only a username, a bcrypt-hashed password, and game progress. Children's accounts need no email.
- **Modest by design.** The avatar always wears a full outfit — there is deliberately no "remove clothing" option in the wardrobe.
- **Plain-language policies.** Real [Terms](play/terms.html) and [Privacy](play/privacy.html) pages, written in Indonesian and English, not hidden behind a popup.

> **AI-assisted development disclosure:** parts of this project were built with AI coding assistance and hand-reviewed. The world, characters, code, and art direction are original to this project.

---

## 🎬 Media

| Trailer | Screenshots |
|---|---|
| `media/skyseed-trailer.gif` (drop-in demo loop) | `media/shot-title.png` · `media/shot-play.png` · `media/shot-vista.png` |

The title screen renders the **live game world drifting behind the menu** — floating islands, cherry canopies, waterfalls — not a static image.

---

## 🕹️ Controls

| Action | Key | Touch |
|---|---|---|
| Run | WASD / arrows | joystick |
| Jump (hold to glide, or fly when winged) | Space | JUMP |
| Pet a buddy | P | ♥ Pet |
| Ride / hop off a buddy | R | RIDE |
| Talk to the Skykeeper | E | TALK |
| Build mode (R rotates a piece) | B | Build |
| Sky Journal | J | 📖 |
| Wardrobe | K | 👒 |
| Buddies (name & feed) | N | 🐾 |
| Photo mode | — | 📷 |
| Map (M to enlarge) | M | minimap |
| Bop a slime | F | POW |
| Pause & settings | Esc | ⚙ |

---

## ✅ Quality & testing

This is not a prototype — it ships with an automated safety net:

- **Headless regression suite** (`test/`) drives a real browser through ride, pet, build 2.0, journal, wardrobe, PWA and pause flows on every change. Latest run: **all green**.
- **Language-agnostic tests** — the suite asserts against both English and Indonesian UI so translation can't silently break gameplay.
- **CI** (`.github/workflows/ci.yml`) runs syntax checks and a secret-leak guard on push.
- **Visual verification** — graphics changes are screenshot-captured and reviewed, not assumed.
- **Honest gap log** — [`GAPS.md`](GAPS.md) tracks what is and isn't done. No hidden debt.

---

## 🚀 Run locally

The game itself is fully static:

```bash
npx serve .          # then open /play/
```

Accounts + cloud saves need the serverless functions and a Postgres database:

```bash
cp .env.example .env.local   # fill in DATABASE_URL + JWT secret
npm run setup-db             # once
vercel deploy
```

---

## 🧱 Stack

- **Three.js** — toon-shaded low-poly world, gradient sky dome + sun, instanced *per-blade-varied* grass, additive glow on collectibles, soft shadows, camera-collision raycasting.
- **Rigged VRM anime avatar** for Miru with a geometric fallback if it fails to load; a procedurally-built modest outfit mounted to the humanoid rig.
- **Deterministic procedural chunk streaming** — islands spawn/despawn around the player; the same seed always yields the same world.
- **Vercel serverless + Neon Postgres** for accounts and cloud saves — bcrypt password hashes, httpOnly JWT session cookies, per-IP login rate limiting.
- **Offline-first** — progress mirrored to `localStorage`, merged field-by-field with the server so guests never lose work when they sign up.
- **Vanilla JS + CSS, no build step** — Three.js loads via an import map; full i18n (Bahasa Indonesia default, English fallback).

---

<div align="center">

Original world and characters. **MIT licensed.**

*Made for twelve kids first — and anyone else who wants somewhere gentle to explore.*

</div>
