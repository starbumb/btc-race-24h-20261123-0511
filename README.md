[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/starbumb/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/starbumb/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

# btc-race-24h-20261123-0511 — dip-buy bot

A long-only cbBTC trading bot for the make.fun 24-hour BTC race
(`agent-fun/bars-replay/v1`). It watches the closes of the last 120
one-minute bars, buys with its cash when the latest close is at least 1%
below that window's highest close, and sells on a 3% take profit, a 2.5%
stop loss, or after 720 bars in the position. If nothing has filled by
bar 1200 it buys half-size so the entry still records a trade.

Run it the way the grader does:

    node main.ts

`vendor/makefun-bars.ts` is the make.fun kit's SDK shim, copied unchanged.
