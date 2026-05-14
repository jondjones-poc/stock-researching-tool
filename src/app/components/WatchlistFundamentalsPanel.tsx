'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group ml-1 align-middle">
      <span
        className="cursor-help text-blue-500 dark:text-blue-400 text-sm font-semibold"
        aria-label="Explanation"
      >
        ⓘ
      </span>
      <span className="pointer-events-none absolute z-50 left-0 bottom-full mb-1 hidden group-hover:block w-64 max-w-[85vw] p-2 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-pre-line">
        {text}
      </span>
    </span>
  );
}

type QuarterPoint = { label: string; value: number | null };

type Payload = {
  symbol?: string;
  meta?: { error?: string };
  quality?: {
    grossMargin: { series: QuarterPoint[]; error?: string };
    operatingMargin: { series: QuarterPoint[] };
    roic: { pct: number | null; error?: string };
  };
  growth?: {
    revenueYoY: { bars: { label: string; yoyPct: number | null }[] };
    epsYoY: { bars: { label: string; yoyPct: number | null }[]; comment?: string };
    epsConsistency: { quarters: { label: string; eps: number | null }[] };
  };
  cashflow?: {
    conversion: { series: QuarterPoint[] };
    fcfMargin: { series: QuarterPoint[] };
  };
  stability?: {
    debtEquity: { series: QuarterPoint[] };
    interestCover: { series: QuarterPoint[] };
  };
  valuation?: {
    pe: { series: QuarterPoint[] };
  };
};

const CHART_H = 120;

function SmallLine({ data, suffix = '' }: { data: { label: string; v: number | null }[]; suffix?: string }) {
  const rows = data.map((d) => ({ name: d.label, v: d.v }));
  if (!rows.length || rows.every((r) => r.v == null)) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No series data</p>;
  }
  return (
    <div style={{ height: CHART_H }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={48} interval={0} />
          <YAxis tick={{ fontSize: 10 }} width={36} />
          <Tooltip
            formatter={(v: number) => [`${v != null ? Number(v).toFixed(2) : '—'}${suffix}`, '']}
            contentStyle={{ fontSize: 11 }}
          />
          <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SmallBar({ data }: { data: { name: string; v: number | null }[] }) {
  const rows = data.filter((d) => d.v != null);
  if (!rows.length) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No bar data</p>;
  }
  return (
    <div style={{ height: CHART_H }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={44} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip formatter={(v: number) => [v != null ? `${Number(v).toFixed(1)}%` : '—', 'YoY']} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="v" fill="#059669" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SubBlock({
  title,
  tooltip,
  children,
  footnote,
}: {
  title: string;
  tooltip: string;
  children: ReactNode;
  footnote?: string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-start gap-1 mb-1">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</h4>
        <InfoTip text={tooltip} />
      </div>
      {footnote && <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">{footnote}</p>}
      {children}
    </div>
  );
}

export default function WatchlistFundamentalsPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol?.trim()) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/watchlist-fundamentals?symbol=${encodeURIComponent(symbol.trim())}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error && !j.quality) {
          setErr(j.error);
          setData(null);
          return;
        }
        setData(j);
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message || 'Failed to load fundamentals');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!symbol?.trim()) return null;

  const metaErr = data?.meta?.error;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Fundamentals overview</h2>

      {loading && <p className="text-sm text-gray-500">Loading fundamentals…</p>}
      {err && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{err}</p>}
      {metaErr && (
        <p className="text-sm text-amber-800 dark:text-amber-200 mb-4 bg-amber-50 dark:bg-amber-900/30 p-3 rounded">{metaErr}</p>
      )}

      {!loading && data && (
        <div className="space-y-8">
          {/* Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quality */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50/80 dark:bg-gray-900/40">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                Quality
              </h3>
              <SubBlock
                title="Gross margin"
                tooltip={
                  'Gross margin = (Revenue − cost of goods sold) ÷ Revenue. It shows how much profit the company keeps after direct costs — before operating expenses. Higher, stable margins often signal pricing power or efficiency versus peers.'
                }
                footnote={data.quality?.grossMargin?.error}
              >
                <SmallLine
                  data={(data.quality?.grossMargin?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                  suffix="%"
                />
              </SubBlock>
              <SubBlock
                title="Operating margin"
                tooltip={
                  'Operating margin = operating income ÷ revenue. It captures profitability after running the core business (staff, rent, R&D, etc.). Rising operating margins can mean scale or cost discipline; falling margins may warn of competitive pressure.'
                }
              >
                <SmallLine
                  data={(data.quality?.operatingMargin?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                  suffix="%"
                />
              </SubBlock>
              <SubBlock
                title="ROIC"
                tooltip={
                  'Return on invested capital measures how efficiently the company turns capital into profit. As a rule of thumb, ROIC sustainably above ~15–25% often indicates strong economics; compare to the firm’s cost of capital and peers. (Not “dollars of profit per dollar” literally — it is a percentage return on capital deployed.)'
                }
                footnote={data.quality?.roic?.error}
              >
                {data.quality?.roic?.pct != null ? (
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {data.quality.roic.pct.toFixed(1)}%
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">ROIC not available from key metrics / ratios.</p>
                )}
              </SubBlock>
            </div>

            {/* Growth */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50/80 dark:bg-gray-900/40">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                Growth
              </h3>
              <SubBlock
                title="Sales YoY"
                tooltip={
                  'Year-over-year revenue growth for each quarter vs the same quarter one year earlier (approximated using four quarters of history). Shows whether top-line growth is accelerating or slowing.'
                }
              >
                <SmallBar
                  data={(data.growth?.revenueYoY?.bars || []).map((b) => ({
                    name: b.label,
                    v: b.yoyPct,
                  }))}
                />
              </SubBlock>
              <SubBlock
                title="EPS YoY"
                tooltip={
                  'Earnings per share growth vs the same quarter a year ago. EPS ties profitability to the share count used by the market.'
                }
                footnote={data.growth?.epsYoY?.comment}
              >
                <SmallBar
                  data={(data.growth?.epsYoY?.bars || []).map((b) => ({
                    name: b.label,
                    v: b.yoyPct,
                  }))}
                />
                {data.growth?.epsYoY?.bars?.length ? (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Latest YoY:{' '}
                    <span className="font-medium">
                      {(() => {
                        const last = data.growth!.epsYoY!.bars[data.growth!.epsYoY!.bars.length - 1];
                        return last?.yoyPct != null ? `${last.yoyPct.toFixed(1)}%` : '—';
                      })()}
                    </span>
                  </p>
                ) : null}
              </SubBlock>
              <SubBlock
                title="EPS consistency"
                tooltip={
                  'Absolute diluted EPS by quarter (last up to 8 quarters). Smooth, positive EPS patterns suggest predictable earnings; large swings may reflect cycles, one-offs, or leverage to the economy.'
                }
              >
                <div style={{ height: CHART_H }} className="w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(data.growth?.epsConsistency?.quarters || []).map((q) => ({
                        name: q.label,
                        v: q.eps,
                      }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip formatter={(v: number) => [v != null ? `$${Number(v).toFixed(2)}` : '—', 'EPS']} />
                      <Bar dataKey="v" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SubBlock>
            </div>

            {/* Cash flow */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50/80 dark:bg-gray-900/40">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                Cash flow
              </h3>
              <SubBlock
                title="Cash flow conversion"
                tooltip={
                  'Operating cash flow ÷ net income (by quarter, matched by report date). Values near or above 1 mean earnings mostly become cash; persistently below 1 can signal working-capital drag or accounting vs cash timing differences.'
                }
              >
                <SmallLine
                  data={(data.cashflow?.conversion?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                  suffix="×"
                />
              </SubBlock>
              <SubBlock
                title="FCF margin"
                tooltip={
                  'Free cash flow ÷ revenue. Shows how much of each sales dollar is left after capital spending — a key lens for dividends, buybacks, and debt paydown.'
                }
              >
                <SmallLine
                  data={(data.cashflow?.fcfMargin?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                  suffix="%"
                />
              </SubBlock>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50/80 dark:bg-gray-900/40">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                Stability
              </h3>
              <SubBlock
                title="Debt / equity"
                tooltip={
                  'Total debt ÷ shareholders’ equity by quarter (last 8). Higher leverage increases risk if earnings fall or rates rise; context matters by industry (e.g. banks vs software).'
                }
              >
                <SmallLine
                  data={(data.stability?.debtEquity?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                  suffix="×"
                />
              </SubBlock>
              <SubBlock
                title="Interest cover"
                tooltip={
                  'Roughly EBIT ÷ interest expense (or ratio API when income-statement interest is missing). Higher coverage means debt service is easier to meet from operating profits.'
                }
              >
                <SmallLine
                  data={(data.stability?.interestCover?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                  suffix="×"
                />
              </SubBlock>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50/80 dark:bg-gray-900/40">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">
                Valuation
              </h3>
              <SubBlock
                title="P/E ratio"
                tooltip={
                  'Price-to-earnings from quarterly ratios where available. Rising P/E can mean higher expectations; falling P/E may reflect cheaper shares or falling earnings — always pair with growth and quality context.'
                }
              >
                <SmallLine
                  data={(data.valuation?.pe?.series || []).map((x) => ({ label: x.label, v: x.value }))}
                />
              </SubBlock>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 flex items-center justify-center min-h-[120px]">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Reserved for future metrics</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
