// Dip-buy bot for the make.fun cbBTC 24-hour race (agent-fun/bars-replay/v1).
//
// Strategy, tuned on the published dev window and kept deliberately simple:
//   * Watch the closes of the last 120 one-minute bars of CBBTC.
//   * When the latest close sits at least 1% below that window's highest close,
//     buy with (nearly) all the cash on hand. Dips of that size on a 1-minute
//     BTC feed are common, and the round-trip cost of a full-size trade is
//     about 26 bps, so a 1% entry discount leaves room to profit.
//   * While holding, sell everything when any of these fires first:
//       - take profit: position value reaches 103% of its cost (fees included),
//       - stop loss:   position value falls to 97.5% of its cost,
//       - time stop:   720 bars (12 hours) have passed since the fill.
//   * If no order has filled by bar 1200, buy with half the cash so the entry
//     still records a trade on a window without a qualifying dip.
//
// Orders decided on a batch fill at the next bar's open; the bot answers every
// batch with at most one order, long only, at most one open position, and it
// never reads the clock, the network or the environment: the same bars always
// produce the same orders, byte for byte.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const WINDOW = 120; // bars in the rolling-high window (2 hours)
const DIP_BPS = 100; // buy when close <= window high * (1 - 100/10000)
const TAKE_PROFIT_BPS = 300; // sell when value >= cost * (1 + 300/10000)
const STOP_LOSS_BPS = 250; // sell when value <= cost * (1 - 250/10000)
const MAX_HOLD_BARS = 720; // sell after 12 hours in the position
const FALLBACK_SEQ = 1200; // buy half-size here if nothing has filled yet
const MAX_SLIPPAGE_BPS = 200; // tolerate the fill moving 2% from the latest close
const BPS = 10_000n;

const closes: number[] = []; // latest closes as plain numbers (prices fit safely)
let entrySeq = -1; // seq of the batch where the open position first appeared
let everFilled = false; // any order of ours has filled on this run
let fallbackSent = false;

function rollingHigh(): number {
  let hi = 0;
  for (const c of closes) if (c > hi) hi = c;
  return hi;
}

await runBars({
  onBatch(state, batch) {
    // Learn from the fills this batch reports: a filled order means we traded.
    for (const fill of batch.fills) {
      if (fill.status === 'filled') everFilled = true;
    }
    // Record this bar's close when the batch carries a fresh bar for the symbol.
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar) {
      closes.push(Number(BigInt(bar.c)));
      if (closes.length > WINDOW) closes.shift();
    }
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];

    const held = state.positions.get(SYMBOL);
    const qty = held?.qty ?? 0n;

    if (qty > 0n) {
      if (entrySeq < 0) entrySeq = state.seq;
      const cost = held!.cost;
      const value = state.value(SYMBOL, qty);
      const takeProfit = value * BPS >= cost * (BPS + BigInt(TAKE_PROFIT_BPS));
      const stopLoss = value * BPS <= cost * (BPS - BigInt(STOP_LOSS_BPS));
      const timeStop = state.seq - entrySeq >= MAX_HOLD_BARS;
      if (takeProfit || stopLoss || timeStop) {
        const sell: SellInput = {
          side: 'sell',
          symbol: SYMBOL,
          qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        entrySeq = -1;
        return [sell];
      }
      return [];
    }

    entrySeq = -1;
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    const room = state.weightRoom(SYMBOL);
    const spendable = state.cash < room ? state.cash : room;

    const dipped =
      closes.length >= WINDOW &&
      close * BPS <= BigInt(Math.round(rollingHigh())) * (BPS - BigInt(DIP_BPS));
    if (dipped && spendable >= minNotional) {
      const buy: BuyInput = {
        side: 'buy',
        symbol: SYMBOL,
        notional_quote_units: spendable,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      };
      return [buy];
    }

    // Fallback: register at least one trade on a window with no qualifying dip.
    if (!everFilled && !fallbackSent && state.seq >= FALLBACK_SEQ) {
      const half = spendable / 2n;
      if (half >= minNotional) {
        fallbackSent = true;
        const buy: BuyInput = {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: half,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [buy];
      }
    }
    return [];
  },
});
