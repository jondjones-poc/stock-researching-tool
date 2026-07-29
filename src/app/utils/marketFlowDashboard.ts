import {
  MARKET_FLOW_PERIODS,
  MARKET_FLOW_STALE_DAYS,
  type MarketFlowCapType,
  type MarketFlowPeriod,
} from '../config/marketFlow';
import {
  getLatestMarketFlowRun,
  listActiveMarketFlowFunds,
  listAllReturns,
  listFundMeta,
  listMarketFlowMarkets,
  type MarketFlowFundRow,
  type MarketFlowReturnRow,
} from './marketFlowDb';
import { addCalendarDays, toIsoDay } from './marketFlowReturns';

export type MarketFlowView = 'large' | 'small' | 'vs';

export interface MarketFlowDashboardRow {
  slug: string;
  name: string;
  region: string;
  large: {
    symbol: string;
    name: string;
    returns: Record<MarketFlowPeriod, number | null>;
    price: number | null;
    asOf: string | null;
  };
  small: {
    symbol: string;
    name: string;
    returns: Record<MarketFlowPeriod, number | null>;
    price: number | null;
    asOf: string | null;
  };
  leader: Record<MarketFlowPeriod, 'large' | 'small' | 'tie' | 'n/a'>;
  spread: Record<MarketFlowPeriod, number | null>;
}

export interface MarketFlowDashboardPayload {
  disclaimer: string;
  period: MarketFlowPeriod;
  view: MarketFlowView;
  lastUpdated: string | null;
  dataStale: boolean;
  staleWarning: string | null;
  mode: string | null;
  runStatus: string | null;
  summary: {
    bestMarket: { slug: string; name: string; returnPct: number } | null;
    worstMarket: { slug: string; name: string; returnPct: number } | null;
    strongestLarge: { slug: string; name: string; returnPct: number } | null;
    strongestSmall: { slug: string; name: string; returnPct: number } | null;
  };
  ranked: {
    byMarket: Array<{ slug: string; name: string; returnPct: number }>;
    byLarge: Array<{ slug: string; name: string; symbol: string; returnPct: number }>;
    bySmall: Array<{ slug: string; name: string; symbol: string; returnPct: number }>;
  };
  rows: MarketFlowDashboardRow[];
}

function emptyReturns(): Record<MarketFlowPeriod, number | null> {
  return { '1w': null, '1m': null, '3m': null, '6m': null, '1y': null };
}

function emptyLeaders(): Record<MarketFlowPeriod, 'large' | 'small' | 'tie' | 'n/a'> {
  return { '1w': 'n/a', '1m': 'n/a', '3m': 'n/a', '6m': 'n/a', '1y': 'n/a' };
}

function emptySpreads(): Record<MarketFlowPeriod, number | null> {
  return { '1w': null, '1m': null, '3m': null, '6m': null, '1y': null };
}

function leaderOf(large: number | null, small: number | null): 'large' | 'small' | 'tie' | 'n/a' {
  if (large == null || small == null || !Number.isFinite(large) || !Number.isFinite(small)) {
    return 'n/a';
  }
  if (Math.abs(large - small) < 0.01) return 'tie';
  return large > small ? 'large' : 'small';
}

function pickExtreme(
  items: Array<{ slug: string; name: string; returnPct: number }>,
  dir: 'max' | 'min'
): { slug: string; name: string; returnPct: number } | null {
  if (items.length === 0) return null;
  return items.reduce((best, cur) =>
    dir === 'max'
      ? cur.returnPct > best.returnPct
        ? cur
        : best
      : cur.returnPct < best.returnPct
        ? cur
        : best
  );
}

export async function buildMarketFlowDashboard(
  period: MarketFlowPeriod = '1m',
  view: MarketFlowView = 'vs'
): Promise<MarketFlowDashboardPayload> {
  const [markets, funds, returns, meta, run] = await Promise.all([
    listMarketFlowMarkets(),
    listActiveMarketFlowFunds(),
    listAllReturns(),
    listFundMeta(),
    getLatestMarketFlowRun(),
  ]);

  const returnsByFund = new Map<number, Map<MarketFlowPeriod, MarketFlowReturnRow>>();
  for (const r of returns) {
    const m = returnsByFund.get(r.fund_id) ?? new Map();
    m.set(r.period, r);
    returnsByFund.set(r.fund_id, m);
  }

  const fundsByMarket = new Map<number, { large?: MarketFlowFundRow; small?: MarketFlowFundRow }>();
  for (const f of funds) {
    const entry = fundsByMarket.get(f.market_id) ?? {};
    if (f.cap_type === 'large') entry.large = f;
    else entry.small = f;
    fundsByMarket.set(f.market_id, entry);
  }

  const rows: MarketFlowDashboardRow[] = [];

  for (const market of markets) {
    const pair = fundsByMarket.get(market.id) ?? {};
    const largeReturns = emptyReturns();
    const smallReturns = emptyReturns();
    let largePrice: number | null = null;
    let smallPrice: number | null = null;
    let largeAsOf: string | null = null;
    let smallAsOf: string | null = null;

    const fill = (fund: MarketFlowFundRow | undefined, target: Record<MarketFlowPeriod, number | null>) => {
      if (!fund) return { price: null as number | null, asOf: null as string | null };
      const fr = returnsByFund.get(fund.id);
      let price: number | null = null;
      let asOf: string | null = null;
      for (const p of MARKET_FLOW_PERIODS) {
        const row = fr?.get(p);
        target[p] = row?.return_pct ?? null;
        if (row?.end_close != null) price = row.end_close;
        if (row?.as_of_date) asOf = row.as_of_date;
      }
      return { price, asOf };
    };

    const largeMeta = fill(pair.large, largeReturns);
    largePrice = largeMeta.price;
    largeAsOf = largeMeta.asOf;
    const smallMeta = fill(pair.small, smallReturns);
    smallPrice = smallMeta.price;
    smallAsOf = smallMeta.asOf;

    const leaders = emptyLeaders();
    const spreads = emptySpreads();
    for (const p of MARKET_FLOW_PERIODS) {
      leaders[p] = leaderOf(largeReturns[p], smallReturns[p]);
      if (largeReturns[p] != null && smallReturns[p] != null) {
        spreads[p] = largeReturns[p]! - smallReturns[p]!;
      }
    }

    rows.push({
      slug: market.slug,
      name: market.name,
      region: market.region,
      large: {
        symbol: pair.large?.symbol ?? '—',
        name: pair.large?.name ?? '—',
        returns: largeReturns,
        price: largePrice,
        asOf: largeAsOf,
      },
      small: {
        symbol: pair.small?.symbol ?? '—',
        name: pair.small?.name ?? '—',
        returns: smallReturns,
        price: smallPrice,
        asOf: smallAsOf,
      },
      leader: leaders,
      spread: spreads,
    });
  }

  const marketScore = (row: MarketFlowDashboardRow): number | null => {
    if (view === 'large') return row.large.returns[period];
    if (view === 'small') return row.small.returns[period];
    const l = row.large.returns[period];
    const s = row.small.returns[period];
    if (l == null && s == null) return null;
    if (l == null) return s;
    if (s == null) return l;
    return (l + s) / 2;
  };

  const byMarket = rows
    .map((r) => {
      const returnPct = marketScore(r);
      return returnPct == null || !Number.isFinite(returnPct)
        ? null
        : { slug: r.slug, name: r.name, returnPct };
    })
    .filter((x): x is { slug: string; name: string; returnPct: number } => x != null)
    .sort((a, b) => b.returnPct - a.returnPct);

  const byLarge = rows
    .map((r) => {
      const returnPct = r.large.returns[period];
      return returnPct == null || !Number.isFinite(returnPct)
        ? null
        : { slug: r.slug, name: r.name, symbol: r.large.symbol, returnPct };
    })
    .filter(
      (x): x is { slug: string; name: string; symbol: string; returnPct: number } => x != null
    )
    .sort((a, b) => b.returnPct - a.returnPct);

  const bySmall = rows
    .map((r) => {
      const returnPct = r.small.returns[period];
      return returnPct == null || !Number.isFinite(returnPct)
        ? null
        : { slug: r.slug, name: r.name, symbol: r.small.symbol, returnPct };
    })
    .filter(
      (x): x is { slug: string; name: string; symbol: string; returnPct: number } => x != null
    )
    .sort((a, b) => b.returnPct - a.returnPct);

  const asOfDates = [
    ...rows.map((r) => r.large.asOf),
    ...rows.map((r) => r.small.asOf),
    ...meta.map((m) => m.last_price_date),
  ].filter((d): d is string => !!d);
  const lastUpdated =
    run?.finished_at ??
    (asOfDates.length > 0 ? asOfDates.sort().at(-1)! : null);
  const lastUpdatedDay = toIsoDay(lastUpdated);

  let dataStale = false;
  let staleWarning: string | null = null;
  if (lastUpdatedDay) {
    const staleAfter = addCalendarDays(lastUpdatedDay, MARKET_FLOW_STALE_DAYS);
    const today = new Date().toISOString().slice(0, 10);
    if (today > staleAfter) {
      dataStale = true;
      staleWarning = `Price data looks stale (last update ${lastUpdatedDay}). Run an admin refresh or wait for the daily job.`;
    }
  } else if (markets.length > 0) {
    dataStale = true;
    staleWarning = 'No price data yet. Run an admin refresh to import history.';
  }

  return {
    disclaimer:
      'Market Flow Tracker shows price momentum and relative leadership between large-cap and small-cap funds. It does not measure confirmed investor cash flows.',
    period,
    view,
    lastUpdated,
    dataStale,
    staleWarning,
    mode: run?.mode ?? null,
    runStatus: run?.status ?? null,
    summary: {
      bestMarket: pickExtreme(byMarket, 'max'),
      worstMarket: pickExtreme(byMarket, 'min'),
      strongestLarge: byLarge[0]
        ? { slug: byLarge[0].slug, name: byLarge[0].name, returnPct: byLarge[0].returnPct }
        : null,
      strongestSmall: bySmall[0]
        ? { slug: bySmall[0].slug, name: bySmall[0].name, returnPct: bySmall[0].returnPct }
        : null,
    },
    ranked: { byMarket, byLarge, bySmall },
    rows,
  };
}

export function heatClass(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'bg-slate-100 text-slate-500';
  if (value >= 8) return 'bg-emerald-600 text-white';
  if (value >= 4) return 'bg-emerald-500 text-white';
  if (value >= 1.5) return 'bg-emerald-200 text-emerald-900';
  if (value >= 0.25) return 'bg-emerald-50 text-emerald-800';
  if (value > -0.25) return 'bg-slate-100 text-slate-700';
  if (value > -1.5) return 'bg-red-50 text-red-800';
  if (value > -4) return 'bg-red-200 text-red-900';
  if (value > -8) return 'bg-red-500 text-white';
  return 'bg-red-700 text-white';
}

export function formatPct(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export type { MarketFlowCapType, MarketFlowPeriod };
