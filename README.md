# Skyseed Isles

A gentle 3D open-world platformer that runs in the browser. Miru, a sky gardener, drifts across floating islands that never run out — gather sparks, unlock new moves, befriend slimes, and decorate your own islands.

Built as a kid-first game: no timers, no game over, no ads, no accounts, no data collection. Falling off an island just floats you back. Bopping slimes is optional and harmless — they giggle away and come back.

Everything is endless and everything is saved (locally, in the browser):

- **Endless world.** Islands generate as you explore, ringed into biomes — Meadow, Sunset Grove, Snow, Starfall and Candy Reef — that keep changing the further you roam.
- **Unlock ladder.** Collecting sparks earns new moves — higher jumps, gliding, triple hop, a spark magnet, faster sprint, a sparkle trail and floatier cloud steps.
- **Buddies.** Walk up to a slime and it becomes your friend, following in a bouncy conga line and levelling up as you gather sparks.
- **Build mode.** Place trees, flowers, mushrooms, lanterns and crystals to decorate any island. Your builds stay put between visits.

## Play

- Landing page: `index.html`
- Game: `play/index.html`

Controls: WASD / arrow keys to run, Space to jump, mouse to look around, F to bop a slime, B to open build mode. On touchscreens a joystick, jump, build and place buttons appear automatically. Progress, buddies and builds are saved to your browser.

## Run locally

Any static server works:

```
npx serve .
```

Then open the printed URL. No build step — the game imports Three.js through an import map.

## Stack

- Three.js (toon-shaded low-poly world, instanced grass, soft shadows)
- A rigged VRM anime avatar for Miru, with a geometric fallback if it fails to load
- Deterministic procedural chunk streaming (islands spawn/despawn around the player)
- Progress, buddies and builds persisted in `localStorage`
- Vanilla JS + CSS for the landing page (parallax, scroll reveal, tilt cards, marquee)
- Deployed as a plain static site — no build step, Three.js loads via import map

Original world and characters. MIT licensed.
