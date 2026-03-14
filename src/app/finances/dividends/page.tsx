'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface DividendStock {
  positionId?: number;
  instrumentId?: number;
  ticker?: string | null;
  sharesOwned: number;
  buyCost: number;
  currentPrice: number;
  dividendPerShare: number;
  dividendGrowthRate: number | null;
  isDividend?: boolean | string | null;
}

const FILTER_TYPES = ['dividend', 'growth', 'all'] as const;
type FilterType = (typeof FILTER_TYPES)[number];

type TabId = 'overview' | 'stockinfo';

interface StockTickerRow {
  instrumentId: number;
  symbolFull: string;
  displayName: string;
  exchange: string;
  type: string;
  updatedAt: string | null;
  dividendPerShare: number | null;
  isDividend?: boolean;
}

function parseFilterFromQuery(value: string | null): FilterType {
  if (value === 'dividend' || value === 'growth' || value === 'all') return value;
  return 'dividend';
}

export default function DividendsPage() {
  const searchParams = useSearchParams();
  const filterFromUrl = parseFilterFromQuery(searchParams.get('filter'));

  const [dividendStocks, setDividendStocks] = useState<DividendStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingFromDb, setLoadingFromDb] = useState(false);
  const [fetchingSymbols, setFetchingSymbols] = useState(false);
  const [fetchingDividendPerShare, setFetchingDividendPerShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filter, setFilterState] = useState<FilterType>(filterFromUrl);
  const [usdToGbp, setUsdToGbp] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [stockTickerRows, setStockTickerRows] = useState<StockTickerRow[]>([]);
  const [stockTickerLoading, setStockTickerLoading] = useState(false);
  const [stockTickerError, setStockTickerError] = useState<string | null>(null);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [askAiCopied, setAskAiCopied] = useState(false);
  const [askPortfolioCopied, setAskPortfolioCopied] = useState(false);

  // Sync filter state from URL on load and when URL changes (e.g. back/forward)
  useEffect(() => {
    setFilterState(filterFromUrl);
  }, [filterFromUrl]);

  // Auto-hide "Loaded X positions from database" after 5 seconds
  useEffect(() => {
    if (successMessage == null || !successMessage.includes('positions from database')) return;
    const t = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Auto-hide "Recalculated" after 2 seconds
  useEffect(() => {
    if (successMessage !== 'Recalculated') return;
    const t = setTimeout(() => setSuccessMessage(null), 2000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Fetch stock_ticker_cache when Stock Info tab is selected
  useEffect(() => {
    if (activeTab !== 'stockinfo') return;
    let cancelled = false;
    setStockTickerError(null);
    setStockTickerLoading(true);
    fetch('/api/etoro/stock-ticker-cache')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.rows) setStockTickerRows(data.rows);
        if (!cancelled && data.error) setStockTickerError(data.error);
      })
      .catch((err) => {
        if (!cancelled) setStockTickerError(err.message || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setStockTickerLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  // Fetch USD to GBP rate for display (Frankfurter free API)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/usd-to-gbp')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.rate != null && Number.isFinite(data.rate)) setUsdToGbp(Number(data.rate));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const setFilter = (next: FilterType) => {
    setFilterState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('filter', next);
    window.history.replaceState({}, '', url.pathname + url.search);
  };

  const fetchDividendStocks = async () => {
    setError(null);
    try {
      const response = await fetch('/api/etoro/dividends');
      const data = await response.json();
      
      if (!response.ok) {
        // Display detailed error from API
        const errorMsg = data.error || 'Failed to fetch dividend stocks';
        const details = data.details ? ` - ${data.details}` : '';
        throw new Error(`${errorMsg}${details}`);
      }
      
      if (data.error) {
        // API returned error even with 200 status
        const errorMsg = data.error;
        const details = data.details ? ` - ${data.details}` : '';
        setError(`${errorMsg}${details}`);
      }
      
      // Stocks should already have positionId and instrumentId from API
      setDividendStocks(Array.isArray(data.stocks) ? data.stocks : []);
      
      // Log any messages from API
      if (data.message) {
        console.log('API message:', data.message);
      }
      
      // Log debug info for troubleshooting
      if (data.debug) {
        console.log('API Debug Info:', data.debug);
        console.log('Instrument Map Sample:', data.debug.instrumentMapSample);
        console.log('Sample Position Keys:', data.debug.samplePositionKeys);
        console.log('Sample Position:', data.debug.samplePosition);
        if (data.debug.stocksWithoutSymbols > 0) {
          console.warn(`⚠ ${data.debug.stocksWithoutSymbols} stocks are missing symbols (showing as INSTRUMENT_XXX)`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching dividend stocks:', err);
      setError(err.message || 'Failed to load dividend stocks');
      throw err; // Re-throw so handleLoad can catch it
    }
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    const rate = usdToGbp ?? 1;
    const gbp = value * rate;
    return `£${gbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Only show symbol when it exists and is not a placeholder (e.g. INSTRUMENT_XXX); otherwise show nothing
  const displaySymbol = (stock: DividendStock): string => {
    const t = stock?.ticker;
    if (t == null || typeof t !== 'string' || t.trim() === '') return '—';
    if (t.toUpperCase().startsWith('INSTRUMENT_')) return '—';
    return t;
  };

  // Filter grid by is_dividend: dividend = true only, growth = false only, all = no filter
  const filteredStocks = (() => {
    if (filter === 'all') return dividendStocks;
    if (filter === 'dividend') return dividendStocks.filter(s => s.isDividend !== false && s.isDividend !== 'false');
    // Growth: is_dividend is explicitly false (boolean or string from API)
    return dividendStocks.filter(s => s.isDividend === false || s.isDividend === 'false');
  })();

  // Calculate totals (guard against missing/invalid numbers) — use filtered list for displayed totals
  const totalValue = filteredStocks.reduce((sum, stock) => {
    const price = Number(stock?.currentPrice);
    const shares = Number(stock?.sharesOwned);
    if (Number.isFinite(price) && Number.isFinite(shares)) return sum + price * shares;
    return sum;
  }, 0);

  const totalCost = filteredStocks.reduce((sum, stock) => {
    const cost = Number(stock?.buyCost);
    const shares = Number(stock?.sharesOwned);
    if (Number.isFinite(cost) && Number.isFinite(shares)) return sum + cost * shares;
    return sum;
  }, 0);

  const totalAnnualDividend = filteredStocks.reduce((sum, stock) => {
    const dps = Number(stock?.dividendPerShare);
    const shares = Number(stock?.sharesOwned);
    if (Number.isFinite(dps) && Number.isFinite(shares)) return sum + dps * shares;
    return sum;
  }, 0);
  const totalMonthlyDividend = totalAnnualDividend / 12;

  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? ((totalGainLoss / totalCost) * 100) : 0;
  const portfolioDividendYieldPct = totalValue > 0 ? (totalAnnualDividend / totalValue) * 100 : 0;

  const copyAskAiPrompt = async () => {
    // Group positions by instrument so we show one row per stock (not per position)
    const byInstrument = new Map<number, DividendStock[]>();
    filteredStocks.forEach((stock) => {
      const id = stock?.instrumentId ?? 0;
      if (!byInstrument.has(id)) byInstrument.set(id, []);
      byInstrument.get(id)!.push(stock);
    });
    const aggregatedStocks = Array.from(byInstrument.entries()).map(([instrumentId, positions]) => {
      const first = positions[0]!;
      let totalShares = 0;
      let totalCost = 0;
      let totalValue = 0;
      let totalYearlyDiv = 0;
      positions.forEach((p) => {
        const sh = Number(p?.sharesOwned) || 0;
        const cost = Number(p?.buyCost) || 0;
        const price = Number(p?.currentPrice) || 0;
        const dps = Number(p?.dividendPerShare) || 0;
        totalShares += sh;
        totalCost += cost * sh;
        totalValue += price * sh;
        totalYearlyDiv += dps * sh;
      });
      const currentPrice = positions.length > 0 ? Number(positions[0]?.currentPrice) || 0 : 0;
      const dps = positions.length > 0 ? Number(positions[0]?.dividendPerShare) || 0 : 0;
      const gainLoss = totalValue - totalCost;
      const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
      return {
        ticker: displaySymbol(first),
        instrumentId,
        totalShares,
        totalCost,
        currentPrice,
        totalValue,
        gainLoss,
        gainLossPct,
        dps,
        yearlyDiv: totalYearlyDiv,
        monthlyDiv: totalYearlyDiv / 12,
      };
    });
    const lines: string[] = [
      'I have a dividend portfolio I\'d like you to review. All currency figures are in GBP (£).',
      '',
      '**Portfolio summary**',
      `- Total Value: ${formatCurrency(totalValue)}`,
      `- Total Cost: ${formatCurrency(totalCost)}`,
      `- Gain/Loss: ${formatCurrency(totalGainLoss)} (${formatPercent(totalGainLossPercent)})`,
      `- Yearly Dividend: ${formatCurrency(totalAnnualDividend)}`,
      `- Monthly Dividend: ${formatCurrency(totalMonthlyDividend)}`,
      `- Portfolio Yield: ${totalValue > 0 ? `${portfolioDividendYieldPct.toFixed(2)}%` : 'N/A'}`,
      '',
      '**Stocks**',
      aggregatedStocks.map((a) => a.ticker).join(', '),
      '',
      'Please:',
      '1. Generate the quarterly dividend per share for each stock listed above.',
      '2. Give advice on how to improve this portfolio.',
      '3. Call out the best stock and the worst stock for dividend growth (from the holdings above).',
      '4. Advise how I can change the portfolio to improve the portfolio dividend yield.',
    ];
    const prompt = lines.join('\n');
    try {
      await navigator.clipboard.writeText(prompt);
      setAskAiCopied(true);
      setTimeout(() => setAskAiCopied(false), 2000);
    } catch {
      setAskAiCopied(false);
    }
  };

  // Copy prompt for "Ask AI for portfolio advice" — uses ALL stocks, includes count, type per stock, summary stats
  const copyPortfolioAdvicePrompt = async () => {
    const allStocks = dividendStocks;
    if (allStocks.length === 0) return;

    const byInstrument = new Map<number, DividendStock[]>();
    allStocks.forEach((stock) => {
      const id = stock?.instrumentId ?? 0;
      if (!byInstrument.has(id)) byInstrument.set(id, []);
      byInstrument.get(id)!.push(stock);
    });
    const aggregated = Array.from(byInstrument.entries()).map(([_, positions]) => {
      const first = positions[0]!;
      const type = first.isDividend !== false && first.isDividend !== 'false' ? 'Dividend' : 'Growth';
      return { ticker: displaySymbol(first), type };
    });

    const allValue = allStocks.reduce((sum, s) => {
      const p = Number(s?.currentPrice);
      const sh = Number(s?.sharesOwned);
      return Number.isFinite(p) && Number.isFinite(sh) ? sum + p * sh : sum;
    }, 0);
    const allCost = allStocks.reduce((sum, s) => {
      const c = Number(s?.buyCost);
      const sh = Number(s?.sharesOwned);
      return Number.isFinite(c) && Number.isFinite(sh) ? sum + c * sh : sum;
    }, 0);
    const allAnnualDiv = allStocks.reduce((sum, s) => {
      const dps = Number(s?.dividendPerShare);
      const sh = Number(s?.sharesOwned);
      return Number.isFinite(dps) && Number.isFinite(sh) ? sum + dps * sh : sum;
    }, 0);
    const allGainLoss = allValue - allCost;
    const allGainLossPct = allCost > 0 ? (allGainLoss / allCost) * 100 : 0;
    const rate = usdToGbp ?? 1;
    const totalValueGbp = allValue * rate;
    const totalValueUsd = allValue;

    const lines: string[] = [
      'I would like portfolio advice. All currency figures are in GBP (£) unless noted.',
      '',
      '**Stock count**',
      String(aggregated.length),
      '',
      '**Stocks and type (Dividend / Growth / Value)**',
      'For each symbol, say if it is a dividend, growth, or value stock. Then summarize the split (e.g. X dividend, Y growth, Z value).',
      ...aggregated.map((a) => `- ${a.ticker}: ${a.type}`),
      '',
      '**Portfolio summary (from database)**',
      `Total Value: £${totalValueGbp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
      `Total Cost: £${(allCost * rate).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Gain/Loss Amount: £${(allGainLoss * rate).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Gain/Loss %: ${allGainLossPct >= 0 ? '+' : ''}${allGainLossPct.toFixed(2)}%`,
      `Yearly Dividend: £${(allAnnualDiv * rate).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Monthly Dividend: £${(allAnnualDiv / 12 * rate).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Portfolio Yield: ${allValue > 0 ? `${((allAnnualDiv / allValue) * 100).toFixed(2)}%` : 'N/A'}`,
      '',
      'Please:',
      '1. For each stock, say if it is dividend, growth, or value and then summarize the split.',
      '2. Evaluate the portfolio.',
      '3. Spot any mistakes or issues.',
      '4. Highlight the best stock and why.',
      '5. Highlight the worst stock and why.',
    ];
    const prompt = lines.join('\n');
    try {
      await navigator.clipboard.writeText(prompt);
      setAskPortfolioCopied(true);
      setTimeout(() => setAskPortfolioCopied(false), 2000);
    } catch {
      setAskPortfolioCopied(false);
    }
  };

  // Save current data to database
  const handleSave = async () => {
    if (dividendStocks.length === 0) {
      setError('No data to save');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/etoro/portfolio/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stocks: dividendStocks }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save portfolio data');
      }

      setSuccessMessage(data.message || `Successfully saved ${data.saved} positions`);
    } catch (err: any) {
      console.error('Error saving portfolio data:', err);
      setError(err.message || 'Failed to save portfolio data');
    } finally {
      setSaving(false);
    }
  };

  // Load data from eToro API
  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchDividendStocks();
      setSuccessMessage('Successfully loaded data from eToro API');
    } catch (err: any) {
      console.error('Error loading from eToro API:', err);
      setError(err.message || 'Failed to load from eToro API');
    } finally {
      setLoading(false);
    }
  };

  // Load data from database
  const handleLoadFromDb = async () => {
    setLoadingFromDb(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/etoro/portfolio/load?activeOnly=true');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load portfolio data');
      }

      const rawStocks = data.stocks ?? [];
      setDividendStocks(Array.isArray(rawStocks) ? rawStocks : []);
      setSuccessMessage(data.message || `Loaded ${data.count} positions from database`);
    } catch (err: any) {
      console.error('Error loading portfolio data:', err);
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoadingFromDb(false);
    }
  };

  // Auto-load data from database on mount (single load, all positions for filter)
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingFromDb(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetch('/api/etoro/portfolio/load?activeOnly=false');
        const data = await response.json();

        if (cancelled) return;
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load portfolio data');
        }

        setDividendStocks(Array.isArray(data.stocks) ? data.stocks : []);
        setSuccessMessage(data.message || `Loaded ${data.count} positions from database`);
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error loading portfolio data:', err);
          setError(err.message || 'Failed to load portfolio data');
        }
      } finally {
        if (!cancelled) setLoadingFromDb(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Recalculate top-section totals only (no reload): force re-render so derived values refresh
  const handleRecalculate = () => {
    if (dividendStocks.length === 0) return;
    setDividendStocks((prev) => prev.map((s) => ({ ...s })));
    setSuccessMessage('Recalculated');
  };

  // Clear UI data only
  const handleClear = () => {
    setDividendStocks([]);
    setError(null);
    setSuccessMessage(null);
  };

  // Fetch stock symbols from eToro API and cache them
  const handleFetchSymbols = async () => {
    setFetchingSymbols(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/etoro/fetch-symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr: any) {
        const text = await response.text();
        throw new Error(`Failed to parse response: ${text.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      // Reload table from DB so dividend_per_share column shows updated values
      await handleLoadFromDb();

      if (data.fetched > 0) {
        setSuccessMessage(
          data.message ||
          `Fetched ${data.fetched} new symbols. ${data.cached} were already cached.` +
            (data.dividendPerShareUpdated > 0 ? ` Updated dividend per share for ${data.dividendPerShareUpdated} stocks.` : '')
        );
      } else if (data.errors && data.errors.length > 0) {
        // Show errors if nothing was fetched
        const errorCount = data.errors.length;
        const errorPreview = data.errorDetails ? data.errorDetails.slice(0, 3).join('; ') : data.errors.slice(0, 3).join('; ');
        const debugInfo = data.debug ? ` (Found ${data.debug.totalInstrumentIds} instrument IDs, ${data.debug.missingIdsCount} missing)` : '';
        setError(
          `Failed to fetch symbols: ${errorCount} errors${debugInfo}. ` +
          `First errors: ${errorPreview}${errorCount > 3 ? '...' : ''}. ` +
          `Check browser console for full details.`
        );
      } else {
        setSuccessMessage(
          data.message ||
          `No new symbols to fetch. ${data.cached} were already cached.` +
            (data.dividendPerShareUpdated > 0 ? ` Updated dividend per share for ${data.dividendPerShareUpdated} stocks.` : '')
        );
      }
      
      if (data.errors && data.errors.length > 0) {
        console.error('Symbol fetch errors:', data.errors);
        if (data.errorDetails) {
          console.error('Error details:', data.errorDetails);
        }
        if (data.debug) {
          console.error('Debug info:', data.debug);
        }
      }
    } catch (err: any) {
      console.error('Error fetching stock symbols:', err);
      setError(err.message || 'Failed to fetch stock symbols');
    } finally {
      setFetchingSymbols(false);
    }
  };

  // Get dividend per share from FMP for each row in stock_ticker_cache and update DB
  const handleGetDividendPerShare = async () => {
    setFetchingDividendPerShare(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/etoro/dividend-per-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.details || `HTTP ${response.status}`);
      }

      await handleLoadFromDb();

      setSuccessMessage(
        data.message ||
        `Updated dividend per share for ${data.updated ?? 0} of ${data.total ?? 0} symbols.`
      );
      if (data.errors?.length > 0) {
        console.warn('Dividend per share errors:', data.errors);
      }
      if (data.updated === 0 && data.debug?.firstSymbolResponse) {
        console.warn('Dividend per share debug (FMP response shape):', data.debug);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get dividend per share');
    } finally {
      setFetchingDividendPerShare(false);
    }
  };

  const updateStockTickerRow = (instrumentId: number, field: keyof StockTickerRow, value: string | number | boolean | null) => {
    setStockTickerRows((prev) =>
      prev.map((r) => (r.instrumentId === instrumentId ? { ...r, [field]: value } : r))
    );
  };

  const saveStockTickerRow = async (row: StockTickerRow) => {
    setSavingRowId(row.instrumentId);
    try {
      const res = await fetch('/api/etoro/stock-ticker-cache', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrumentId: row.instrumentId,
          symbolFull: row.symbolFull,
          displayName: row.displayName,
          exchange: row.exchange,
          type: row.type,
          dividendPerShare: row.dividendPerShare,
          ...(typeof row.isDividend === 'boolean' ? { isDividend: row.isDividend } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Update failed');
      setEditingRowId(null);
    } catch (err: unknown) {
      setStockTickerError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingRowId(null);
    }
  };

  const hasIsDividend = stockTickerRows.length > 0 && 'isDividend' in stockTickerRows[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Portfolio Overview
          </button>
          <button
            onClick={() => setActiveTab('stockinfo')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'stockinfo'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Stock Info
          </button>
        </div>

        {activeTab === 'overview' && (
        <>
        <div className="flex justify-end mb-6">
          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleLoad}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Load from Live'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || dividendStocks.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save to DB'}
            </button>
            <button
              onClick={handleLoadFromDb}
              disabled={loadingFromDb}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loadingFromDb ? 'Loading...' : 'Load from DB'}
            </button>
            <button
              onClick={handleRecalculate}
              disabled={dividendStocks.length === 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Recalculate
            </button>
            <button
              onClick={handleClear}
              disabled={dividendStocks.length === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={copyAskAiPrompt}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {askAiCopied ? 'Copied!' : 'Ask AI for Dividend Advice'}
            </button>
            <button
              type="button"
              onClick={copyPortfolioAdvicePrompt}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors"
            >
              {askPortfolioCopied ? 'Copied!' : 'Ask AI for Portfolio Advice'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading dividend stocks from eToro API...</div>
          </div>
        ) : dividendStocks.length === 0 && !error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Click &quot;Load from Live&quot; to fetch data from eToro API</div>
          </div>
        ) : (
          <>
            {/* Filter: Dividend (is_dividend = true) | Growth (is_dividend = false) | All */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show:</span>
              <button
                onClick={() => setFilter('dividend')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'dividend'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Dividend
              </button>
              <button
                onClick={() => setFilter('growth')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'growth'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Growth
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Value</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalValue)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  (${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Cost</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</div>
              </div>
              <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${
                totalGainLoss >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
              }`}>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Gain/Loss Amount</div>
                <div className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalGainLoss)}
                </div>
              </div>
              <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${
                totalGainLoss >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
              }`}>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Gain/Loss %</div>
                <div className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(totalGainLossPercent)}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Yearly Dividend</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAnnualDividend)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Monthly Dividend</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalMonthlyDividend)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Portfolio Yield</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalValue > 0 ? `${((totalAnnualDividend / totalValue) * 100).toFixed(2)}%` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Dividend Stocks Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Ticker</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ minWidth: '6rem' }}>Instrument ID</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Shares Owned</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Buy Cost</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Current Price</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Current Value</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Gain/Loss</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Dividend per Share</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Yearly Dividend</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Monthly Dividend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-500 dark:text-gray-400">
                          {dividendStocks.length === 0 ? 'No dividend stocks found' : 'No stocks match the current filter'}
                        </td>
                      </tr>
                    ) : (
                      filteredStocks.map((stock, index) => {
                        const price = Number(stock?.currentPrice);
                        const shares = Number(stock?.sharesOwned);
                        const buyCost = Number(stock?.buyCost);
                        const dps = Number(stock?.dividendPerShare);
                        const currentValue = Number.isFinite(price) && Number.isFinite(shares) ? price * shares : 0;
                        const totalCostRow = Number.isFinite(buyCost) && Number.isFinite(shares) ? buyCost * shares : 0;
                        const gainLoss = currentValue - totalCostRow;
                        const gainLossPercent = totalCostRow > 0 ? ((gainLoss / totalCostRow) * 100) : 0;
                        const yearlyDividend = Number.isFinite(dps) && Number.isFinite(shares) ? dps * shares : 0;
                        const monthlyDividend = yearlyDividend / 12;

                        return (
                          <tr 
                            key={stock?.positionId ?? stock?.instrumentId ?? index} 
                            className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">{displaySymbol(stock)}</td>
                            <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ minWidth: '6rem' }}>{stock?.instrumentId ?? '—'}</td>
                            <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{formatNumber(stock?.sharesOwned)}</td>
                            <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{formatCurrency(stock?.buyCost)}</td>
                            <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{formatCurrency(stock?.currentPrice)}</td>
                            <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">{formatCurrency(currentValue)}</td>
                            <td className={`py-3 px-4 text-center font-medium ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
                            </td>
                            <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{formatCurrency(stock?.dividendPerShare)}</td>
                            <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">{formatCurrency(yearlyDividend)}</td>
                            <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{formatCurrency(monthlyDividend)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredStocks.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">Total</td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">-</td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                          {formatNumber(filteredStocks.reduce((sum, s) => sum + (Number(s?.sharesOwned) || 0), 0))}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">-</td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">-</td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{formatCurrency(totalValue)}</td>
                        <td className={`py-3 px-4 text-center ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totalGainLoss)} ({formatPercent(totalGainLossPercent)})
                        </td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">-</td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{formatCurrency(totalAnnualDividend)}</td>
                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{formatCurrency(totalMonthlyDividend)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Total yearly dividend - prominent total at the end */}
            {filteredStocks.length > 0 && (
              <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 border-green-200 dark:border-green-800">
                <div className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Total yearly dividend (every year)
                </div>
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(totalAnnualDividend)}
                </div>
              </div>
            )}
          </>
        )}
        </>
        )}

        {activeTab === 'stockinfo' && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={handleFetchSymbols}
                disabled={fetchingSymbols}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {fetchingSymbols ? 'Fetching...' : 'Get Stock Symbols'}
              </button>
              <button
                onClick={handleGetDividendPerShare}
                disabled={fetchingDividendPerShare}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {fetchingDividendPerShare ? 'Updating...' : 'Get Dividend Per Share'}
              </button>
            </div>
            {stockTickerError && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                {stockTickerError}
              </div>
            )}
            {stockTickerLoading ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading stock ticker cache...</div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Instrument ID</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Symbol</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Display Name</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Dividend per Share</th>
                        {hasIsDividend && (
                          <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Is Dividend</th>
                        )}
                        <th className="w-24 text-center" />
                      </tr>
                    </thead>
                    <tbody>
                      {stockTickerRows.length === 0 ? (
                        <tr>
                          <td colSpan={hasIsDividend ? 6 : 5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                            No rows. Use the buttons above to populate the cache.
                          </td>
                        </tr>
                      ) : (
                        stockTickerRows.map((row) => {
                          const isEditing = editingRowId === row.instrumentId;
                          return (
                          <tr key={row.instrumentId} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isEditing ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                            <td className="py-2 px-4 text-center text-gray-700 dark:text-gray-300">{row.instrumentId}</td>
                            <td className="py-2 px-4 text-center">
                              {isEditing ? (
                                <input
                                  value={row.symbolFull}
                                  onChange={(e) => updateStockTickerRow(row.instrumentId, 'symbolFull', e.target.value)}
                                  className="w-full min-w-[6rem] px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                />
                              ) : (
                                <span className="text-gray-900 dark:text-white">{row.symbolFull || '—'}</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-center">
                              {isEditing ? (
                                <input
                                  value={row.displayName}
                                  onChange={(e) => updateStockTickerRow(row.instrumentId, 'displayName', e.target.value)}
                                  className="w-full min-w-[8rem] px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                />
                              ) : (
                                <span className="text-gray-900 dark:text-white">{row.displayName || '—'}</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={row.dividendPerShare ?? ''}
                                  onChange={(e) =>
                                    updateStockTickerRow(
                                      row.instrumentId,
                                      'dividendPerShare',
                                      e.target.value === '' ? null : parseFloat(e.target.value)
                                    )
                                  }
                                  className="w-24 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white mx-auto"
                                />
                              ) : (
                                <span className="text-gray-900 dark:text-white">{row.dividendPerShare != null ? Number(row.dividendPerShare) : '—'}</span>
                              )}
                            </td>
                            {hasIsDividend && (
                              <td className="py-2 px-4 text-center">
                                {isEditing ? (
                                  <select
                                    value={row.isDividend ? 'true' : 'false'}
                                    onChange={(e) =>
                                      updateStockTickerRow(row.instrumentId, 'isDividend', e.target.value === 'true')
                                    }
                                    className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                  >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <span className="text-gray-900 dark:text-white">{row.isDividend ? 'Yes' : 'No'}</span>
                                )}
                              </td>
                            )}
                            <td className="py-2 px-4 text-center">
                              {isEditing ? (
                                <div className="flex gap-2 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => saveStockTickerRow(row)}
                                    disabled={savingRowId === row.instrumentId}
                                    className="px-3 py-1 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded"
                                  >
                                    {savingRowId === row.instrumentId ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingRowId(null)}
                                    disabled={savingRowId === row.instrumentId}
                                    className="px-3 py-1 text-sm font-medium bg-gray-500 hover:bg-gray-600 text-white rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingRowId(row.instrumentId)}
                                  className="px-3 py-1 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
