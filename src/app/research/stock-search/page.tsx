'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StockPriceChart from '../../components/StockPriceChart';
import { buildStockResearchPrompt } from '../../utils/buildStockResearchPrompt';
import { yahooFinanceQuoteUrl } from '../../utils/yahooFinanceQuoteUrl';

function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!s || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) return null;
  return s;
}

function StockSearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSectors = searchParams.get('from') === 'sectors';
  const [query, setQuery] = useState('');
  const [symbol, setSymbol] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [fundamentals, setFundamentals] = useState<{
    pe?: number | null;
    forwardPe?: number | null;
    marketCap?: number | null;
    freeCashFlow?: number | null;
    sector?: string | null;
    industry?: string | null;
    eps?: number | null;
    dividendYield?: number | null;
    price?: number | null;
  }>({});
  const [chartMeta, setChartMeta] = useState<{
    price: number | null;
    changePercent: number | null;
    periodLabel: string;
  }>({ price: null, changePercent: null, periodLabel: '1M' });
  const [askAiCopied, setAskAiCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    cached: boolean;
    stale: boolean;
    fetchedAt: string | null;
  } | null>(null);
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);

  const loadSymbol = useCallback(
    async (raw: string) => {
      const sym = normalizeSymbol(raw);
      if (!sym) {
        setError('Enter a valid ticker (e.g. CRM, EWU, BRK.B)');
        return;
      }
      setError(null);
      setMessage(null);
      setSymbol(sym);
      setQuery(sym);
      setSavedToWatchlist(false);

      const params = new URLSearchParams();
      params.set('symbol', sym);
      if (fromSectors) params.set('from', 'sectors');
      router.replace(`/research/stock-search?${params.toString()}`);

      setCompanyName(null);
      setFundamentals({});
      setCacheInfo(null);

      try {
        const res = await fetch(`/api/stock-research?symbol=${encodeURIComponent(sym)}`, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const json = await res.json();
          setCompanyName(json.name || sym);
          setFundamentals({
            pe: json.pe ?? null,
            forwardPe: json.forwardPe ?? null,
            marketCap: json.marketCap ?? null,
            freeCashFlow: json.freeCashFlow ?? null,
            sector: json.sector ?? null,
            industry: json.industry ?? null,
            eps: json.eps ?? null,
            dividendYield: json.dividendYield ?? null,
            price: json.price ?? null,
          });
          setCacheInfo({
            cached: Boolean(json.cached),
            stale: Boolean(json.stale),
            fetchedAt: json.fetchedAt ?? null,
          });
        }
      } catch {
        /* chart still loads */
      }
    },
    [router, fromSectors]
  );

  useEffect(() => {
    const fromUrl = searchParams.get('symbol');
    if (!fromUrl) return;
    const sym = normalizeSymbol(fromUrl);
    if (sym && sym !== symbol) {
      void loadSymbol(sym);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL; avoid re-fetch loop on symbol set
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadSymbol(query);
  };

  const handleAskAi = async () => {
    if (!symbol) return;
    try {
      setAskAiCopied(true);
      setMessage(null);
      const prompt = buildStockResearchPrompt({
        symbol,
        name: companyName,
        price: chartMeta.price ?? fundamentals.price ?? null,
        changePercent: chartMeta.changePercent,
        pe: fundamentals.pe ?? null,
        forwardPe: fundamentals.forwardPe ?? null,
        marketCap: fundamentals.marketCap ?? null,
        freeCashFlow: fundamentals.freeCashFlow ?? null,
        sector: fundamentals.sector ?? null,
        industry: fundamentals.industry ?? null,
        eps: fundamentals.eps ?? null,
        dividendYield: fundamentals.dividendYield ?? null,
        periodLabel: chartMeta.periodLabel,
        asOf: new Date().toISOString(),
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setMessage('Research prompt copied — paste into ChatGPT / Claude.');
        setTimeout(() => {
          setAskAiCopied(false);
          setMessage(null);
        }, 3500);
      } else {
        setMessage('Could not access clipboard.');
        setAskAiCopied(false);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setAskAiCopied(false);
    }
  };

  const handleSaveToWatchlist = async () => {
    if (!symbol) return;
    setSavingWatchlist(true);
    setError(null);
    setMessage(null);
    try {
      const now = new Date();
      const investmentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const activePrice = chartMeta.price ?? fundamentals.price ?? null;

      let stockId: number | null = null;

      const listRes = await fetch(
        `/api/stock-valuations/list?stock=${encodeURIComponent(symbol)}&limit=1`,
        { credentials: 'same-origin' }
      );
      const listJson = await listRes.json();
      if (listRes.ok && Array.isArray(listJson.data) && listJson.data[0]?.id) {
        stockId = Number(listJson.data[0].id);
      } else {
        const createRes = await fetch('/api/stock-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            stock: symbol,
            active_price: activePrice,
            pe: fundamentals.pe ?? null,
            eps: fundamentals.eps ?? null,
            market_cap: fundamentals.marketCap ?? null,
            free_cash_flow: fundamentals.freeCashFlow ?? null,
          }),
        });
        const createJson = await createRes.json();
        if (createRes.ok && createJson.id) {
          stockId = Number(createJson.id);
        } else if (createRes.status === 409 && createJson.existingId) {
          stockId = Number(createJson.existingId);
        } else {
          throw new Error(createJson.error || 'Failed to create stock valuation');
        }
      }

      if (!stockId) throw new Error('Could not resolve stock id');

      const monthlyRes = await fetch('/api/monthly-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ stock_id: stockId, investment_date: investmentDate }),
      });
      const monthlyJson = await monthlyRes.json();

      if (monthlyRes.status === 409) {
        setSavedToWatchlist(true);
        setMessage(`${symbol} is already on this month’s watchlist.`);
        return;
      }
      if (!monthlyRes.ok) {
        throw new Error(monthlyJson.error || 'Failed to add to watchlist');
      }

      setSavedToWatchlist(true);
      setMessage(`${symbol} saved to watchlist for this month.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save to watchlist');
    } finally {
      setSavingWatchlist(false);
    }
  };

  const price = chartMeta.price ?? fundamentals.price;
  const change = chartMeta.changePercent;

  return (
    <div className="min-h-[calc(100vh-120px)] bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto p-4 lg:p-6 flex flex-col gap-4">
        {fromSectors && (
          <div>
            <button
              type="button"
              onClick={() => router.push('/research/sectors')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <span aria-hidden>←</span>
              Back to sectors
            </button>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">Stock search</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Look up a stock or ETF chart (trailing MAs + signals), then copy an AI research brief.
            Fundamentals and chart history are cached in the database for 24 hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Search ticker — e.g. CRM, AAPL, EWU"
            className="flex-1 min-w-[220px] px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wide"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Load
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {!symbol ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-gray-500">
            Enter a ticker above to load the price chart.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">{symbol}</h2>
                  {companyName && companyName !== symbol && (
                    <span className="text-gray-500 dark:text-gray-400">{companyName}</span>
                  )}
                  <a
                    href={yahooFinanceQuoteUrl(symbol)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Yahoo Finance ↗
                  </a>
                  <a
                    href={`/?symbol=${encodeURIComponent(symbol)}`}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Open on Stocks dashboard ↗
                  </a>
                </div>
                <div className="mt-1 flex items-baseline gap-3 flex-wrap">
                  {price != null && (
                    <span className="text-2xl font-bold tabular-nums">${price.toFixed(2)}</span>
                  )}
                  {change != null && (
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        change > 0
                          ? 'text-green-600 dark:text-green-400'
                          : change < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500'
                      }`}
                    >
                      {change >= 0 ? '+' : ''}
                      {change.toFixed(2)}% ({chartMeta.periodLabel})
                    </span>
                  )}
                  {cacheInfo && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {cacheInfo.stale
                        ? 'Stale cache'
                        : cacheInfo.cached
                          ? 'Cached (24h)'
                          : 'Fresh fetch'}
                      {cacheInfo.fetchedAt
                        ? ` · ${new Date(cacheInfo.fetchedAt).toLocaleString()}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveToWatchlist()}
                  disabled={savingWatchlist || savedToWatchlist}
                  className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    savedToWatchlist
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  } disabled:opacity-60`}
                >
                  {savingWatchlist
                    ? 'Saving…'
                    : savedToWatchlist
                      ? '✓ Saved to watchlist'
                      : '☆ Save to watchlist'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAskAi()}
                  disabled={askAiCopied}
                  className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    askAiCopied
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                  }`}
                >
                  {askAiCopied ? '✓ Prompt copied' : '🤖 Ask AI — research this stock'}
                </button>
              </div>
            </div>

            {message && (
              <p className="text-xs text-green-600 dark:text-green-400">
                {message}{' '}
                {savedToWatchlist && (
                  <a href="/stocks/watchlist" className="underline hover:no-underline">
                    Open watchlist ↗
                  </a>
                )}
              </p>
            )}

            <div className="h-[560px]">
              <StockPriceChart
                symbol={symbol}
                onMeta={(meta) => setChartMeta(meta)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function StockSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-120px)] flex items-center justify-center text-gray-500">
          Loading…
        </div>
      }
    >
      <StockSearchInner />
    </Suspense>
  );
}
