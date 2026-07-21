# Skyseed Isles

A gentle 3D open-world platformer that runs in the browser. Miru, a sky gardener, drifts across floating islands that never run out — gather sparks, unlock new moves, befriend slimes, raise them until they grow wings, and decorate islands of your own.

Built as a kid-first game: no timers, no game over, no ads, no purchases, no loot boxes, no data selling. Falling off an island just floats you back. Bopping slimes is optional and harmless — they giggle away and come back.

## What's in it

- **Endless world.** Islands generate as you explore, ringed into nine biomes — Meadow, Sunset Grove, Snow, Starfall, Candy Reef, Desert Dunes, Crystal Caverns, Autumn Woods and Aurora Peaks — that keep changing the further you roam.
- **Unlock ladder.** Sparks earn new moves: higher jumps, gliding, triple hop, a spark magnet, faster sprint, a sparkle trail and floaty cloud steps.
- **Buddies you raise.** Stand near a slime and be kind — it becomes your friend and follows in a bouncy conga line. Pet it to help it grow.
- **Ride and fly.** At Lv 4 you can climb on your buddy and ride. At Lv 8 it grows wings — hold jump and the two of you fly.
- **A story to follow.** The Skykeeper gives a six-quest chain about reconnecting the drifting isles, with progress tracked in the HUD.
- **Discovery.** Rare moonpetals, shiny golden slimes, and giant Great Tree landmark islands, all recorded in the Sky Journal.
- **Build mode.** Nine piece types (tree, flower, mushroom, lantern, crystal, fence, bench, arch, path), free rotation, undo — and everything stays put between visits.
- **Wardrobe.** Hats and capes, every one of them earned by exploring rather than bought.
- **Gentle day and night.** A five-minute cycle that never gets darker than dusk.
- **Accounts and family.** Optional sign-up saves progress across devices; a parent dashboard shows every child's progress and can reset their password.
- **Installable.** A PWA — add it to a phone's home screen and it runs like an app.

## Play

- Landing page: `index.html`
- Game: `play/index.html`
- Account: `play/account.html` · Parent dashboard: `play/family.html`

## Controls

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
| Bop a slime | F | POW |
| Pause & settings | Esc | ⚙ |

## Run locally

Any static server works for the game itself:

```
npx serve .
```

The accounts API needs the serverless functions and a database — copy `.env.example` to `.env.local`, fill it in, then `npm run setup-db` once and deploy to Vercel.

## Stack

- Three.js (toon-shaded low-poly world, instanced grass, soft shadows)
- A rigged VRM anime avatar for Miru, with a geometric fallback if it fails to load
- Deterministic procedural chunk streaming (islands spawn/despawn around the player)
- Vercel serverless functions + Neon Postgres for accounts and cloud saves; bcrypt hashes, httpOnly JWT session cookies
- Progress mirrored to `localStorage` so the game works offline and for guests
- Vanilla JS + CSS throughout — no build step; Three.js loads via an import map

Original world and characters. MIT licensed.
