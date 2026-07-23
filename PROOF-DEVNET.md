# SkyHours — Devnet Proof Log

Every Web3 claim in this project is backed by a real, verifiable Solana **devnet**
transaction. Nothing here is mocked. Anyone can open the links and confirm.

> **Zero monetary value:** SkyHours runs only on devnet. SKY tokens and all SOL used
> are test assets with no real-world price. This is a wellbeing/parental-control
> mechanic, not a financial product.

## P0 — SKY time-token created ✅ (verified on-chain)

| Item | Value |
|---|---|
| Token | **SKY** — the sky-time currency |
| Unit | `1 SKY = 1 minute` of play (0 decimals) |
| Mint address | `G4AD9pew62hL5N6sdAvV65mVj1pX52QeNDA3RH5JzB4R` |
| Initial supply minted | `1000 SKY` |
| Mint authority (parent) | `35z7X59rtyts557Up1RAwpyYN7x2cFqcDc7RjPuNxFzr` |
| Cluster | Solana devnet |

**Verify:**
- Mint account → https://explorer.solana.com/address/G4AD9pew62hL5N6sdAvV65mVj1pX52QeNDA3RH5JzB4R?cluster=devnet
- Mint transaction → https://explorer.solana.com/tx/rbx55DwyszoamqMMxBTjGdrQdQ6S4ggVqZxQ1sFZ89F59RTFe4LDchvx8ezj9LoixAWVPAuqbtTFoDJtqdnyQrb?cluster=devnet

Independent on-chain read (via `getMint`): supply `1000`, decimals `0`, authority
`35z7X…Fzr` — matches. **VERIFIED.**

## Next proofs (P1+)

- [ ] Parent mints a daily allowance to a child account (allowance tx)
- [ ] Child session spends SKY minute-by-minute (spend txs)
- [ ] SkyBadge attestation on healthy-rest milestone
- [ ] Build-creation hash anchored on-chain
- [ ] Save-state checkpoint

Each will be appended here with its signature and explorer link as it ships.
