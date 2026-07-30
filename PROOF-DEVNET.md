# Skyseed Isles — Devnet Proof Log

Every on-chain claim in this project is backed by a real, verifiable Solana **devnet**
transaction. Nothing is mocked. Anyone can open the links below and confirm.

> **Zero monetary value.** Skyseed Isles runs only on devnet. SEED tokens and all SOL used
> are test assets with no real-world price and no path to purchase with real money.

## What SEED is — and what it deliberately is not

**SEED** is the in-game shop currency. It buys **cosmetic skins** and **energy/resin refills**
for optional dungeon runs.

**It is not a time token.** An earlier design metered play-time on-chain; that was scrapped.
Selling or restricting a child's play-time carries real legal risk, so the mechanic was removed
entirely. The main open world stays **free and unlimited** — SEED only ever touches optional
extras.

| Rule | Status |
|---|---|
| Main open world playable without spending anything | ✅ always free |
| Play-time metered, sold, or capped on-chain | ❌ removed — never shipping |
| Real-money purchase path | ❌ none — devnet only |
| Loot boxes / randomised paid rewards | ❌ none — every price is fixed and shown |
| Child controls treasury funds | ❌ parent/treasury is the sole mint authority |

## Ledger — verified on devnet

**SEED token**

| Item | Value |
|---|---|
| Mint address | `G4AD9pew62hL5N6sdAvV65mVj1pX52QeNDA3RH5JzB4R` |
| Decimals | `0` (whole units) |
| Mint authority (treasury) | `35z7X59rtyts557Up1RAwpyYN7x2cFqcDc7RjPuNxFzr` |
| Cluster | Solana devnet |

Explorer → https://explorer.solana.com/address/G4AD9pew62hL5N6sdAvV65mVj1pX52QeNDA3RH5JzB4R?cluster=devnet

**Store economy — full loop executed on-chain**

Test child account: `EuyZq2hBKtTjpZBbzwTfUpnEQmGVuQzt1UpwTLBt1inc`

| # | Action | Amount | Signature |
|---|---|---|---|
| 1 | Starter grant to child | +100 SEED | [`41Vw2gyv…`](https://explorer.solana.com/tx/41Vw2gyv8LkZyu4vihEFTC6W8sKM7m98ngjAfujYq2xRSsSa4KYgmZEcYb92F4EDv7J7NA1UMhr7gvnbenQT7sQT?cluster=devnet) |
| 2 | **Buy a skin** (transfer to shop treasury) | −40 SEED | [`4edFdCXg…`](https://explorer.solana.com/tx/4edFdCXgUV9WaGmKptx5hrwq82SV1RxyFhAxBCcYit9njFPhrfJKJLEA2vxkBdTbM1wrMnJ77jB7PRniQPdSTRVi?cluster=devnet) |
| 3 | **Refill dungeon energy** (burn, consumed) | −20 SEED | [`2jM8GM19…`](https://explorer.solana.com/tx/2jM8GM19Bvh8hpxtR6bWwiAj3NJWM68Zoqjrw1zseFWEUQybpXqjhsshHYQcBwewwZJfMVjDSDBrMDKcNrm2JyYf?cluster=devnet) |

Resulting child balance read back from chain: **40 SEED** (100 − 40 − 20) — matches. **VERIFIED.**

## Still to prove

- [ ] Skin ownership recorded as an on-chain attestation the child keeps
- [ ] Dungeon entry consuming energy from the in-game HUD (not a script)
- [ ] Achievement badges minted on quest completion
- [ ] Build-creation hash anchored on-chain
- [ ] Save-state checkpoint

Each will be appended with its signature and explorer link once it actually runs.
