# SkyHours — Mega-Prompt & Build Plan

> The wellbeing layer for children's play, settled on Solana devnet.
> A kid-safe 3D open world (*Skyseed Isles*) where **play-time itself is the token** —
> parents mint a healthy daily allowance of "sky hours" on devnet, the child spends
> them to play, and the world gently lands them when the allowance runs out.
> No real money. No loot boxes. No gambling. The one Web3 game where the token
> exists to make kids play *less*, not more.

---

## 0. Why this resolves the safety contradiction

Crypto inside a young child's game normally fails every safety review because it means
real money, gambling loops, and financial risk to a minor. **SkyHours inverts all three:**

| Normal "crypto game" risk | SkyHours design |
|---|---|
| Real-money tokens | **Devnet only** — SOL and all SPL tokens have zero monetary value by definition |
| Spend more to win more | Tokens are a **spend-down time budget**; running out *ends* the session |
| Child controls funds | **Parent** mints/tops-up; child can only spend the allowance |
| Loot boxes / randomised reward | Every reward is **earned deterministically** by playing |
| Data harvesting | On-chain records are game progress + a parent-held wallet, nothing personal |

The Web3 layer is a **parental-control and digital-wellbeing instrument**, which is a
category regulators *encourage*. That is the pitch.

---

## 1. Locked identity

- **Product / umbrella brand:** `SkyHours`
- **Game world inside it:** `Skyseed Isles`
- **Availability (verified):** GitHub `skyhours` = free · `skyhours.vercel.app` = free · npm `skyhours` = free
- **Chain:** Solana **devnet** (hard rule — never mainnet in this product)
- **Hackathon wallet (devnet):** pubkey `5JTDJdfDHqu3TEHuBTATJF49G8i8YKy42riJG9KWFfSk` (secret stored only in gitignored `.env.local`)

---

## 2. The core mechanic — "Sky Hours"

1. **Parent onboards** in the family dashboard, connects/creates a devnet wallet.
2. Parent sets a **daily allowance** (e.g. 90 minutes) → app mints that many **SKY** SPL tokens
   (1 SKY = 1 minute of sky time) to the child's devnet account for that day.
3. **Child plays.** A meter spends SKY in real time. The HUD shows sky-hours remaining as a
   sun sinking toward the horizon.
4. When SKY hits zero the world enters **"Golden Hour Rest"** — Miru yawns, the isles glow
   warm, gameplay softly pauses, and a friendly screen suggests resting. No punishment, no loss.
5. **Streak of healthy rest** (stopping when asked, not maxing every day) earns **SkyBadges**
   (devnet SPL/NFT attestations) — rewarding balance, not grinding.
6. Parent can **top-up** or **carry-over** unused hours, all as devnet transactions with
   explorer-verifiable signatures.

**This is the demo money-shot:** a live devnet transaction, shown on Solana Explorer, that
*grants rest* to a child.

---

## 3. Every feature wired to Web3 (requirement: "semua fitur terintegrasi")

| Existing feature | On-chain (devnet) integration | Proof artifact |
|---|---|---|
| Play-time / sessions | SKY token mint + spend (SPL) | tx signature + explorer link |
| Achievements / 6-quest chain | **SkyBadge** attestations minted on completion | badge mint tx |
| Buddy adoption & growth | Buddy registered as a soulbound devnet record | account address |
| Build-mode creations | Creation hash anchored on-chain (tamper-proof "I built this") | memo tx |
| Wardrobe unlocks | On-chain proof "earned, not bought" | attestation |
| Family dashboard | Parent wallet = authority; allowance/top-up signed by parent | signed tx history |
| Cross-device save | Save-state hash checkpointed on devnet alongside Neon | checkpoint tx |

All reads/writes go through a thin `web3/` module; a **Proof page** (`/proof`) lists every
transaction type with a live devnet explorer link so reviewers can verify *everything runs*.

---

## 4. Architecture

```
Browser (vanilla JS game + web3.js)
  ├─ game engine (Three.js)            ← existing, kept
  ├─ web3/skyhours.js                  ← NEW: @solana/web3.js + spl-token (devnet)
  │     mintAllowance(), spendMinute(), earnBadge(), anchorBuild()
  ├─ wallet adapter (parent: Solflare/Phantom devnet; child: app-managed devnet keypair)
  └─ HUD sky-time meter
Vercel serverless (existing)
  ├─ /api/*  accounts, family, save  ← existing Neon Postgres
  └─ /api/mint  parent-signed allowance relayer (devnet)   ← NEW
Solana devnet
  ├─ SKY SPL token (time currency)
  ├─ SkyBadge program/attestations
  └─ optional Anchor program for allowance rules (phase 2)
```

Keep the no-build-step vanilla stack; load `@solana/web3.js` + `@solana/spl-token` via the
existing import map (esm.sh / jsdelivr ESM builds).

---

## 5. Hackathon tracks entered ("masuk ke semua track")

- **Consumer / mainstream adoption** — a game a non-crypto parent actually uses.
- **Payments / tokenisation** — SKY as a novel non-monetary time currency.
- **AI** — Groq-powered Skykeeper storyteller with strict kid-safe guardrails (optional).
- **Public good / social impact** — digital wellbeing & screen-time health for children.
- **Gaming** — a full 3D open world, not a tech demo.

One product, one story, credible in each track.

---

## 6. Brand & design (Silicon-Valley bar, no slop)

- Logo: a custom mark — a rising sun cradled inside a seed/leaf, forming an "hourglass of
  daylight." Two-tone gradient (dawn gold → sky blue), works as favicon and app icon, not a
  flat single-colour glyph.
- Landing: one confident hero with the **live game world** behind it, a 3-beat "how sky-hours
  work" section, a real devnet proof strip, a parent-trust section, and a single CTA.
  A few *meaningful* motion moments (parallax isles, sun-meter animation, tx-confirm pulse) —
  taste over quantity, never "160 animations."
- Copy: natural human voice, first-person parent framing, no emoji, no AI-tells.

---

## 7. Compliance & honesty guardrails (non-negotiable)

- **Devnet only**, stated everywhere; no path to spend real money.
- No child-accessible funds; parent is the sole minting authority.
- itch.io / store copy presents it as a **wellbeing-first children's game**; we do **not**
  claim any government legal certification (itch.io ≠ IGRS/Kominfo rating).
- AI narrator (if enabled) is constrained to a safe content template; no open generation to kids.
- No secrets committed; devnet keys live in `.env.local`.

---

## 8. Execution roadmap (0 → MVP)

- **P0 — Foundation:** scaffold `web3/skyhours.js`, connect to devnet, fund hackathon wallet
  from faucet, create the SKY SPL token, prove one mint tx on Explorer.
- **P1 — Core loop:** sky-time meter in HUD spending SKY; Golden-Hour-Rest state; parent
  mint/top-up from family dashboard (parent-signed).
- **P2 — Attestations:** SkyBadges on quest/rest milestones; `/proof` page with live tx links.
- **P3 — Integrations:** build-hash anchoring, wardrobe/buddy attestations, save checkpoint.
- **P4 — Presentation:** rebrand to SkyHours, rebuild landing, brand + logo, pitch deck,
  demo video/GIF, itch.io page copy, hackathon submission + /verify.

Each phase ends with a **verifiable devnet artifact**, not a claim.

---

## 9. What I will NOT fake

Transaction signatures, explorer links, test results, and "it runs" claims will only be
stated after they actually execute on devnet. Idea scores, Turnitin percentages, and
hackathon outcomes are not guaranteed — I optimise for them, I don't promise them.
