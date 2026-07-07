# Skyseed Isles

A gentle 3D open-world platformer that runs in the browser. Miru, a sky gardener, lost her glowing seeds across ten floating islands — run, double jump and glide to bring them home.

Built as a kid-first game: no enemies, no timers, no game over, no ads, no accounts, no data collection. Falling off an island just floats you back.

## Play

- Landing page: `index.html`
- Game: `play/index.html`

Controls: WASD / arrow keys to run, Space to jump (press again mid-air to double jump, hold while falling to glide). On touchscreens a joystick and jump button appear automatically.

## Run locally

Any static server works:

```
npx serve .
```

Then open the printed URL. No build step — the game imports Three.js through an import map.

## Stack

- Three.js (toon-shaded low-poly world, instanced grass, soft shadows)
- Vanilla JS + CSS for the landing page (parallax, scroll reveal, tilt cards, marquee)
- Deployed as a plain static site

All characters and assets are original and made from geometric primitives. MIT licensed.
