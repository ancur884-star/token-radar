// Token Radar — model "radar-2".
//
// One sealed snapshot in, one ranked board out. The board ranks every protocol
// that records no token and is not an exchange or a versioned pool of another
// protocol (the watchlist is the floor, never the ceiling: all 40 watchlist
// slugs are in, plus every other rankable pre-token protocol the snapshot
// carries). Live-token protocols are kept apart and shown at the market's own
// values, never mixed into the ranked board.
//
// Implied value is an EXPECTED value, stated as such everywhere it appears:
//
//   peer-implied FDV  = tvl_usd x peerMultiple(category)
//   implied_value_usd = peer-implied FDV x growth x maturity x launchOdds
//
//   peerMultiple(category): the median market-cap / TVL of the live-token
//     protocols in that category, shrunk toward the global median when the
//     category has few live protocols: w = n / (n + 5), so a category with
//     3 live names counts about a third as much as its own median and two
//     thirds as much as the whole market. Clamped to [0.03, 1.00]. No name
//     is ever special-cased; the same function scores every row.
//   growth:  change_7d clamped to [-40, +60] per cent, weight 0.6, so a
//     protocol growing 10% in a week scores 1.06 and one shrinking 20%
//     scores 0.88. The clamp stops one wild week from deciding a rank.
//   maturity: 0.70 + 0.30 x min(age_days, 1095) / 1095. A protocol tracked
//     for three years scores 1.00, a new one 0.70; unknown age counts as
//     365 days. Age is survival, not a promise: it is the smallest factor.
//   launchOdds: the share of protocols in the category that already record
//     a token, shrunk toward the global share with 8 pseudo-counts, times a
//     size factor (0.90 at $5M TVL rising to 1.10 at $2.75B) and an age
//     factor (0.90 new, 1.10 at three years), clamped to [0.05, 0.85].
//     It is a snapshot-derived propensity, not a prediction: a category
//     where most protocols already have tokens is one where a token is the
//     normal outcome, so a pre-token protocol there is the exception that
//     is most likely to follow.
//
// The range shown beside each value is the same product with the peer
// multiple replaced by the category's shrunk 25th / 75th percentile.
//
// Held-out-style check, computed here from the snapshot and shipped in the
// dashboard data (labelled in-sample): for every live-token protocol with a
// market cap, predict its market cap as TVL x peerMultiple and as TVL x 0.25
// (the flat multiple), and report the median absolute percentage error of
// each. If the peer model does not beat the flat one on this snapshot, the
// dashboard says so — the numbers are computed, never asserted.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_floor: number;
  growth_cap: number;
  growth_weight: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  peer_shrink: number;
  peer_min: number;
  peer_max: number;
  peer_low_min: number;
  peer_high_max: number;
  odds_shrink: number;
  odds_min: number;
  odds_max: number;
}

export const MODEL: ModelConstants = {
  growth_floor: -40,
  growth_cap: 60,
  growth_weight: 0.6,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  peer_shrink: 5,
  peer_min: 0.03,
  peer_max: 1.0,
  peer_low_min: 0.02,
  peer_high_max: 1.5,
  odds_shrink: 8,
  odds_min: 0.05,
  odds_max: 0.85,
};

export const MODEL_VERSION = 'radar-2';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_value_low_usd: number;
  implied_value_high_usd: number;
  peer_implied_fdv_usd: number;
  launch_odds: number;
  model: {
    peer_multiple: number;
    peer_multiple_low: number;
    peer_multiple_high: number;
    peer_sample: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    launch_odds: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_value_low_usd: number;
  implied_value_high_usd: number;
  peer_implied_fdv_usd: number;
  launch_odds: number;
  peer_multiple: number;
  peer_multiple_low: number;
  peer_multiple_high: number;
  peer_sample: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  mcap_tvl: number | null;
  change_7d: number | null;
}

/** The in-sample backtest shipped to the dashboard, computed from the snapshot. */
export interface ModelCheck {
  live_with_mcap: number;
  peer_median_ape_pct: number;
  flat_median_ape_pct: number;
  peer_beats_flat: boolean;
  global_peer_median: number;
  global_peer_p25: number;
  global_peer_p75: number;
  global_launch_rate: number;
}

/** Everything the dashboard needs: the board, the live set, the peer table and the model check. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
  peers: Record<string, { n: number; median: number; p25: number; p75: number }>;
  check: ModelCheck;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted array, and a percentile by nearest rank. */
function medianOf(sorted: number[]): number {
  if (sorted.length === 0) return NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function percentileOf(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))]!;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, and not a wrapped,
 * staked or bridged product of a token that already trades. This is the
 * watchlist's own rule, applied to every row, not just the watchlist: the
 * house's snapshot notes name WBTC, Binance staked ETH and USDT0 as the
 * examples — each is a wrapped or staked product of a token that already
 * trades, so none of them is a protocol still waiting on a launch of its own.
 * A protocol DefiLlama records a parent for is not in the snapshot's ten
 * fields, so the rule uses what the snapshot carries: category, name. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

interface PeerStats {
  n: number;
  median: number;
  p25: number;
  p75: number;
}

/** Market-cap / TVL ratios of the live-token protocols, grouped by category. */
export function peerTable(snapshot: Snapshot): { byCategory: Map<string, PeerStats>; global: PeerStats } {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (typeof p.mcap_usd !== 'number' || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const r = p.mcap_usd / p.tvl_usd;
    all.push(r);
    const key = p.category ?? 'Uncategorised';
    const list = byCat.get(key) ?? [];
    list.push(r);
    byCat.set(key, list);
  }
  const stats = (vals: number[]): PeerStats => {
    const s = [...vals].sort((a, b) => a - b);
    return { n: vals.length, median: medianOf(s), p25: percentileOf(s, 0.25), p75: percentileOf(s, 0.75) };
  };
  const byCategory = new Map<string, PeerStats>();
  for (const [k, v] of byCat) byCategory.set(k, stats(v));
  return { byCategory, global: stats(all) };
}

/** A category's peer multiple, shrunk toward the global median; `q` picks median / p25 / p75. */
function shrunkPeer(table: { byCategory: Map<string, PeerStats>; global: PeerStats }, category: string | null, q: 'median' | 'p25' | 'p75', model: ModelConstants): { value: number; n: number } {
  const g = table.global[q];
  const cat = table.byCategory.get(category ?? 'Uncategorised');
  if (!cat || cat.n === 0) return { value: g, n: 0 };
  const w = cat.n / (cat.n + model.peer_shrink);
  return { value: w * cat[q] + (1 - w) * g, n: cat.n };
}

/** The snapshot-derived launch odds for one protocol. */
export function launchOdds(p: SnapshotProtocol, snapshot: Snapshot, model: ModelConstants): number {
  const total = snapshot.protocols.length;
  const liveTotal = snapshot.protocols.filter((x) => !isPreToken(x)).length;
  const globalRate = total === 0 ? 0.5 : liveTotal / total;
  const cat = snapshot.protocols.filter((x) => (x.category ?? 'Uncategorised') === (p.category ?? 'Uncategorised'));
  const catLive = cat.filter((x) => !isPreToken(x)).length;
  const catRate = (catLive + model.odds_shrink * globalRate) / (cat.length + model.odds_shrink);
  const sizeFactor = 0.9 + 0.2 * clamp(Math.log10(Math.max(p.tvl_usd, 5_000_000) / 5_000_000) / Math.log10(550), 0, 1);
  const age = ageDays(snapshot.as_of, p.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const ageFactor = 0.9 + 0.2 * (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  return round3(clamp(catRate * sizeFactor * ageFactor, model.odds_min, model.odds_max));
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  snapshot: Snapshot,
  table: { byCategory: Map<string, PeerStats>; global: PeerStats },
  model: ModelConstants,
): {
  implied: number;
  low: number;
  high: number;
  peerFdv: number;
  peer: number;
  peerLow: number;
  peerHigh: number;
  peerN: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  odds: number;
  age: number | null;
} {
  const age = ageDays(snapshot.as_of, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const odds = launchOdds(protocol, snapshot, model);
  const peer = shrunkPeer(table, protocol.category, 'median', model);
  const peerLow = shrunkPeer(table, protocol.category, 'p25', model);
  const peerHigh = shrunkPeer(table, protocol.category, 'p75', model);
  const mult = clamp(peer.value, model.peer_min, model.peer_max);
  const multLow = clamp(peerLow.value, model.peer_low_min, model.peer_high_max);
  const multHigh = clamp(peerHigh.value, model.peer_low_min, model.peer_high_max);
  const peerFdv = Math.max(1, Math.round(protocol.tvl_usd * mult));
  const base = protocol.tvl_usd * mult * growthMult * maturityMult * odds;
  const implied = Math.max(1, Math.round(base));
  // The range is the same product with the peer multiple at its 25th /
  // 75th percentile — but a thin category's percentiles can sit on one
  // side of its median, so the range is pinned to contain the implied
  // value: the low multiple never exceeds the median multiple, and the
  // high multiple never falls below it.
  const lowMult = Math.min(multLow, mult);
  const highMult = Math.max(multHigh, mult);
  const low = Math.max(1, Math.round(protocol.tvl_usd * lowMult * growthMult * maturityMult * odds));
  const high = Math.max(1, Math.round(protocol.tvl_usd * highMult * growthMult * maturityMult * odds));
  return { implied, low, high, peerFdv, peer: round4(mult), peerLow: round4(multLow), peerHigh: round4(multHigh), peerN: peer.n, growthPct, growthMult: round4(growthMult), maturityMult: round4(maturityMult), odds, age };
}

/** The in-sample backtest: peer model vs a flat 0.25 multiple, on live protocols with a market cap. */
export function modelCheck(snapshot: Snapshot, table: { byCategory: Map<string, PeerStats>; global: PeerStats }, model: ModelConstants): ModelCheck {
  const peerErrors: number[] = [];
  const flatErrors: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const peer = clamp(shrunkPeer(table, p.category, 'median', model).value, model.peer_min, model.peer_max);
    peerErrors.push(Math.abs(p.tvl_usd * peer - p.mcap_usd) / p.mcap_usd);
    flatErrors.push(Math.abs(p.tvl_usd * 0.25 - p.mcap_usd) / p.mcap_usd);
  }
  const med = (vals: number[]): number => {
    const s = [...vals].sort((a, b) => a - b);
    return vals.length === 0 ? NaN : round4(medianOf(s) * 100);
  };
  const peerMed = med(peerErrors);
  const flatMed = med(flatErrors);
  return {
    live_with_mcap: peerErrors.length,
    peer_median_ape_pct: peerMed,
    flat_median_ape_pct: flatMed,
    peer_beats_flat: peerMed < flatMed,
    global_peer_median: round4(table.global.median),
    global_peer_p25: round4(table.global.p25),
    global_peer_p75: round4(table.global.p75),
    global_launch_rate: round4(snapshot.protocols.filter((x) => !isPreToken(x)).length / Math.max(1, snapshot.protocols.length)),
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const table = peerTable(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: EVERY other rankable pre-token protocol, not a top-N
  // cut. A small protocol below the floor is exactly what a radar exists
  // to find, and the board's job is coverage, not a shortlist.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => ({ p, v: impliedValue(p, snapshot, table, model) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    implied_value_low_usd: s.v.low,
    implied_value_high_usd: s.v.high,
    peer_implied_fdv_usd: s.v.peerFdv,
    launch_odds: s.v.odds,
    model: {
      peer_multiple: s.v.peer,
      peer_multiple_low: s.v.peerLow,
      peer_multiple_high: s.v.peerHigh,
      peer_sample: s.v.peerN,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      maturity_multiplier: s.v.maturityMult,
      launch_odds: s.v.odds,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  return 100;
}

/** Gas for one transaction, from the chain: Ethereum is the expensive one. */
function gasFor(chain: string): string {
  return chain === 'Ethereum' ? 'about $8 of gas' : 'about $2 of gas';
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, so the protocol records a lender, not a visitor.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('aggregator')) return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the shares instead of withdrawing after a day.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app, so the bridge records a real transfer.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, then close it in profit or at a small loss.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name} on ${chain}, then settle it rather than leaving it open.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares, so the vault records you as a depositor.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} through ${name} and hold it for the full period.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the whole period.`;
  if (c.includes('payment')) return `Send $${capital} through ${name} on ${chain} in two separate payments a week apart, so the activity is not a single transaction.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s private pool on ${chain} and withdraw it to the same wallet after the hold period.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index token on ${chain} and hold it instead of trading in and out.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open, so the protocol records a real user.`;
}

/** A second, different action in the same protocol, so the wallet is not a one-transaction farmer. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow a small amount against the deposit on ${name} and repay it within a week, so the wallet shows both sides of the market.`;
  if (c.includes('dex')) return `Swap $${Math.round(capital / 2)} between the pool's two assets on ${name} once, so the wallet has trading volume as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount back through ${name} a week later, so the wallet shows repeat use.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Place one limit order on ${name} on ${chain} and let it fill or expire, so the wallet shows order activity.`;
  if (c.includes('prediction')) return `Vote or comment on one market outcome on ${name} if its app offers it, so the wallet shows participation beyond the trade.`;
  if (c.includes('staking') || c.includes('restak')) return `Delegate a second, smaller stake through ${name} to a different validator or vault, so the wallet shows more than one position.`;
  return `Use one more feature of ${name} on ${chain} — a swap, a vote or a second deposit — so the wallet shows repeat use, not a single transaction.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * Every step is derived from the protocol's own record (category, chains,
 * TVL, age), never from a hand-written list of names. The last step is the
 * warning: a token is not guaranteed, and no one should ever pay to claim one.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: `about $${Math.round(capital / 2)} of capital and ${gas}`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never let a whole week pass with nothing.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw early for a small gain.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from its own site and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `A token is not guaranteed: the protocol may never issue one, and a farm can lose money to fees and smart-contract risk, so only farm what you can afford to lose and write every transaction in a farm log.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 40)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_value_low_usd: row.implied_value_low_usd,
    implied_value_high_usd: row.implied_value_high_usd,
    peer_implied_fdv_usd: row.peer_implied_fdv_usd,
    launch_odds: row.launch_odds,
    peer_multiple: row.model.peer_multiple,
    peer_multiple_low: row.model.peer_multiple_low,
    peer_multiple_high: row.model.peer_multiple_high,
    peer_sample: row.model.peer_sample,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const table = peerTable(snapshot);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const peers: Record<string, { n: number; median: number; p25: number; p75: number }> = {};
  for (const [k, v] of table.byCategory) peers[k] = { n: v.n, median: round4(v.median), p25: round4(v.p25), p75: round4(v.p75) };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    watchlist: [...snapshot.watchlist],
    rows: board.map(radarRow),
    live,
    peers,
    check: modelCheck(snapshot, table, model),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_low_usd > r.implied_value_usd || r.implied_value_usd > r.implied_value_high_usd) return `${r.slug} has a range that does not contain its implied value`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
