# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ancur884-star/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ancur884-star/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: every protocol that records no token, ranked by expected launch value. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=8k4ydjf8&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## How it works

Model `radar-2`, in `lib/model.ts`. The board ranks all 289 rankable pre-token
protocols in the sealed snapshot: the 40-protocol watchlist plus every other
pre-token protocol that is not an exchange or a versioned pool.

Implied value is an expected value:

```
implied = TVL × peer multiple × growth × maturity × launch odds
```

- **Peer multiple**: the median market-cap / TVL of the live-token protocols
  in the same category, shrunk toward the global median (`n / (n + 5)`),
  clamped to 0.03–1.00. The range beside each value uses the category's
  25th/75th percentile instead.
- **Growth**: 7-day TVL change clamped to −40%…+60%, weight 0.6.
- **Maturity**: 0.70 + 0.30 × min(age, 1,095 days) / 1,095; unknown age = 365 days.
- **Launch odds**: the category's share of protocols that already record a
  token, shrunk toward the global share, × size × age, clamped to 5–85%.

The dashboard (`dashboard/`, no network, no framework) ships the board, a
detail view for every protocol showing the full math and a 7-step farm plan
with costs and times, a live-token view at market values, and a model page
with the constants and an in-sample backtest of the peer model against a flat
0.25× TVL multiple, computed from the snapshot at build time.

Caveats, stated in the dashboard: “records no token” means DefiLlama's
record carries no token, not that the protocol has none; a token is never
guaranteed, and a farm plan is not a promise of an airdrop.

## Layout

- `main.ts` — the program the grader runs (Node 22, standard library only).
- `lib/model.ts` — the radar-2 model, the farm plans and the board checks.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored from the kit.
- `dashboard/` — the static dashboard (`index.html`, `app.css`, `app.js`).
- `screenshots/` — board, detail and filtered views of the dashboard.
