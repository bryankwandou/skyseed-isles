# Tests

These are real end-to-end tests driven through a headless browser (Edge via `puppeteer-core`).
They are deliberately not mocked — every one of them caught a genuine bug during development.

## What each test covers

| File | Covers | Bug it caught |
|---|---|---|
| `browser.test.mjs` | Boot, HUD, chunk streaming, build + undo, Build 2.0 rotation, pause menu, wardrobe, buddy care, riding, PWA assets | Build-mode `R` collision with ride; `tip()` overwriting the mount message |
| `i18n.test.mjs` | Indonesian by default, overlays translated, English toggle round-trip | `t is not a function` — the i18n helper was shadowed by the animation loop's time variable |
| `guest-migration.test.mjs` | A guest's progress survives creating an account | **Critical data loss**: signing up wiped 240 sparks, 2 buddies, 2 builds and 4 quests |
| `vrm.test.mjs` | The avatar still loads with a full humanoid rig | Texture compression via gltf-transform silently destroyed the VRM extension |
| `signup.test.mjs` | A child finishes sign-up alone at 420 px: optional email, one password, Show button, one error at a time | Required email and a hidden confirm field left a child stuck with no way out |
| `badges.test.mjs` | All 12 badges listed, locked ones say *belum terbuka* in words, a badge is awarded on the spot and survives a reload | Badges were reset to empty on every reload — the save was being re-seeded, not merged |

## Running them

Start a static server on port 5610 from the project root:

```
node node_modules/http-server/bin/http-server -p 5610 -c-1 --silent .
```

Then:

```
node test/browser.test.mjs
node test/i18n.test.mjs
node test/vrm.test.mjs miru.vrm
```

`guest-migration.test.mjs` runs against the deployed site because it needs the serverless
API and a database. It creates a throwaway account — delete it afterwards:

```
BASE=https://skyseed-isles.vercel.app node test/guest-migration.test.mjs
```

Each test prints `RESULT: PASS` or `RESULT: FAIL`/`CHECK` as its last line.
`CHECK` against a local static server is expected: `/api/*` returns 404 because there are no
serverless functions locally.

## Requirements

- Microsoft Edge at the path in each file's `EDGE` constant (adjust for your machine)
- `npm install` in the project root (`puppeteer-core` is a dev dependency)

CI runs syntax and secret checks only — the browser suite needs a real browser and a database,
so it stays a local step for now.
