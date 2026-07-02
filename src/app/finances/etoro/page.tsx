'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isUsableEtoroTicker } from '@/app/utils/etoroTicker';

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
  researchSymbol?: string;
  displayName: string;
  exchange: string;
  type: string;
  updatedAt: string | null;
  dividendPerShare: number | null;
  isDividend?: boolean;
}

type StockTickerSortKey = 'instrumentId' | 'symbolFull' | 'researchSymbol' | 'displayName' | 'dividendPerShare' | 'isDividend';
type SortDir = 'asc' | 'desc';

function stockTickerSortValue(row: StockTickerRow, key: StockTickerSortKey): number | string | boolean | null {
  switch (key) {
    case 'instrumentId':
      return row.instrumentId;
    case 'symbolFull':
      return row.symbolFull.toUpperCase();
    case 'researchSymbol':
      return (row.researchSymbol ?? '').toUpperCase();
    case 'displayName':
      return row.displayName.toUpperCase();
    case 'dividendPerShare':
      return row.dividendPerShare;
    case 'isDividend':
      return row.isDividend ?? null;
    default:
      return null;
  }
}

function compareStockTickerRows(a: StockTickerRow, b: StockTickerRow, key: StockTickerSortKey, dir: SortDir): number {
  const av = stockTickerSortValue(a, key);
  const bv = stockTickerSortValue(b, key);
  const mult = dir === 'asc' ? 1 : -1;

  if (key === 'symbolFull' || key === 'researchSymbol' || key === 'displayName') {
    return mult * String(av).localeCompare(String(bv));
  }

  if (key === 'isDividend') {
    const an = av === true ? 1 : av === false ? 0 : -1;
    const bn = bv === true ? 1 : bv === false ? 0 : -1;
    if (an === -1 && bn === -1) return a.instrumentId - b.instrumentId;
    if (an === -1) return 1;
    if (bn === -1) return -1;
    if (an === bn) return a.instrumentId - b.instrumentId;
    return mult * (an - bn);
  }

  const an = av == null || !Number.isFinite(Number(av)) ? null : Number(av);
  const bn = bv == null || !Number.isFinite(Number(bv)) ? null : Number(bv);
  if (an == null && bn == null) return a.instrumentId - b.instrumentId;
  if (an == null) return 1;
  if (bn == null) return -1;
  if (an === bn) return a.instrumentId - b.instrumentId;
  return mult * (an - bn);
}

function sortStockTickerRows(rows: StockTickerRow[], key: StockTickerSortKey, dir: SortDir): StockTickerRow[] {
  return [...rows].sort((a, b) => compareStockTickerRows(a, b, key, dir));
}

const symbolMappingThClass =
  'text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap';

function SymbolMappingSortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: StockTickerSortKey;
  activeKey: StockTickerSortKey;
  direction: SortDir;
  onSort: (key: StockTickerSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={symbolMappingThClass}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 mx-auto hover:text-gray-800 dark:hover:text-gray-200"
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!active}>
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

function parseFilterFromQuery(value: string | null): FilterType {
  if (value === 'dividend' || value === 'growth' || value === 'all') return value;
  return 'all';
}

export default function EtoroPage() {
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
  const [hasResearchSymbol, setHasResearchSymbol] = useState(false);
  const [stockTickerLoading, setStockTickerLoading] = useState(false);
  const [stockTickerError, setStockTickerError] = useState<string | null>(null);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [askAiCopied, setAskAiCopied] = useState(false);
  const [mappingStatus, setMappingStatus] = useState<{
    total: number;
    mapped: number;
    unmapped: number;
    unmappedIds: number[];
  } | null>(null);
  const [mappingStatusLoading, setMappingStatusLoading] = useState(false);
  const [resolvingInstrumentId, setResolvingInstrumentId] = useState<number | null>(null);
  const [manualInstrumentId, setManualInstrumentId] = useState('');
  const [addingInstrumentId, setAddingInstrumentId] = useState(false);
  const [showPostLiveLoadBanner, setShowPostLiveLoadBanner] = useState(false);
  const [postLiveLoadBannerKey, setPostLiveLoadBannerKey] = useState(0);
  const [stockTickerSortKey, setStockTickerSortKey] = useState<StockTickerSortKey>('symbolFull');
  const [stockTickerSortDir, setStockTickerSortDir] = useState<SortDir>('asc');

  const loadMappingStatus = async () => {
    setMappingStatusLoading(true);
    try {
      const res = await fetch('/api/etoro/symbol-mapping-status');
      const data = await res.json();
      if (res.ok) {
        setMappingStatus({
          total: data.total ?? 0,
          mapped: data.mapped ?? 0,
          unmapped: data.unmapped ?? 0,
          unmappedIds: Array.isArray(data.unmappedIds) ? data.unmappedIds : [],
        });
      }
    } catch {
      // non-fatal
    } finally {
      setMappingStatusLoading(false);
    }
  };

  // Auto-hide post–live-load banner (mapping status + resolve + load from live) after 5 seconds
  useEffect(() => {
    if (!showPostLiveLoadBanner) return;
    const t = setTimeout(() => setShowPostLiveLoadBanner(false), 5000);
    return () => clearTimeout(t);
  }, [showPostLiveLoadBanner, postLiveLoadBannerKey]);

  // Sync filter state from URL on load and when URL changes (e.g. back/forward)
  useEffect(() => {
    setFilterState(filterFromUrl);
  }, [filterFromUrl]);

  // Default URL to ?filter=all when missing
  useEffect(() => {
    if (searchParams.get('filter')) return;
    const url = new URL(window.location.href);
    url.searchParams.set('filter', 'all');
    window.history.replaceState({}, '', url.pathname + url.search);
    setFilterState('all');
  }, [searchParams]);

  // Auto-hide "Loaded X positions from database" after 5 seconds
  useEffect(() => {
    if (successMessage == null || !successMessage.includes('positions from database')) return;
    const t = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Auto-hide "Successfully loaded data from eToro API" after 5 seconds
  useEffect(() => {
    if (successMessage !== 'Successfully loaded data from eToro API') return;
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
        if (!cancelled && typeof data.hasResearchSymbol === 'boolean') setHasResearchSymbol(data.hasResearchSymbol);
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

  const refreshStockTickerRows = async () => {
    const res = await fetch('/api/etoro/stock-ticker-cache');
    const data = await res.json();
    if (res.ok && data.rows) setStockTickerRows(data.rows);
    if (res.ok && typeof data.hasResearchSymbol === 'boolean') setHasResearchSymbol(data.hasResearchSymbol);
    if (!res.ok && data.error) setStockTickerError(data.error);
  };

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
  const isUnmappedStock = (stock: DividendStock): boolean => {
    return !isUsableEtoroTicker(stock?.ticker);
  };

  const displaySymbol = (stock: DividendStock): string => {
    const t = stock?.ticker;
    if (!isUsableEtoroTicker(t)) return '—';
    return t!.trim();
  };

  const unmappedInView = dividendStocks.filter(isUnmappedStock).length;

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
      await loadMappingStatus();
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
      await loadMappingStatus();
      setShowPostLiveLoadBanner(true);
      setPostLiveLoadBannerKey((k) => k + 1);
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
      await loadMappingStatus();
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

  // Fetch stock symbols from eToro API and cache them in stock_ticker_cache
  const handleFetchSymbols = async (options?: { instrumentIds?: number[]; force?: boolean }) => {
    setFetchingSymbols(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/etoro/fetch-symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(options?.instrumentIds?.length ? { instrumentIds: options.instrumentIds } : {}),
          ...(options?.force ? { force: true } : {}),
        }),
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
      await loadMappingStatus();
      if (activeTab === 'stockinfo') {
        await refreshStockTickerRows();
      }

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

  const handleLookupInstrument = async (instrumentId: number) => {
    setResolvingInstrumentId(instrumentId);
    setError(null);
    try {
      await handleFetchSymbols({ instrumentIds: [instrumentId], force: true });
    } finally {
      setResolvingInstrumentId(null);
    }
  };

  const handleAddInstrumentById = async () => {
    const id = parseInt(manualInstrumentId.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      setStockTickerError('Enter a valid instrument ID (e.g. 12345)');
      return;
    }

    setAddingInstrumentId(true);
    setStockTickerError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/etoro/fetch-symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrumentIds: [id], force: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.details || `HTTP ${response.status}`);
      }
      if (data.fetched > 0) {
        setSuccessMessage(`Added instrument ${id} to symbol cache.`);
        setManualInstrumentId('');
      } else if (data.errors?.length) {
        throw new Error(data.errors[0] || 'Lookup failed');
      } else {
        setSuccessMessage(data.message || `Instrument ${id} is already in the cache.`);
        setManualInstrumentId('');
      }
      await refreshStockTickerRows();
      await loadMappingStatus();
    } catch (err: unknown) {
      setStockTickerError(err instanceof Error ? err.message : 'Failed to add instrument');
    } finally {
      setAddingInstrumentId(false);
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
          ...(hasResearchSymbol ? { researchSymbol: row.researchSymbol ?? '' } : {}),
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
  const symbolMappingColSpan = 5 + (hasResearchSymbol ? 1 : 0) + (hasIsDividend ? 1 : 0);

  const handleStockTickerSort = (key: StockTickerSortKey) => {
    if (stockTickerSortKey === key) {
      setStockTickerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setStockTickerSortKey(key);
      setStockTickerSortDir(key === 'symbolFull' || key === 'researchSymbol' || key === 'displayName' ? 'asc' : 'desc');
    }
  };

  const sortedStockTickerRows = useMemo(
    () => sortStockTickerRows(stockTickerRows, stockTickerSortKey, stockTickerSortDir),
    [stockTickerRows, stockTickerSortKey, stockTickerSortDir]
  );

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
            Symbol mapping
          </button>
        </div>

        {activeTab === 'overview' && (
        <>
        {showPostLiveLoadBanner && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-blue-900 dark:text-blue-100">
              {mappingStatusLoading ? (
                'Checking symbol mappings…'
              ) : mappingStatus ? (
                <>
                  <span className="font-medium">{mappingStatus.mapped}</span> of{' '}
                  <span className="font-medium">{mappingStatus.total}</span> saved holdings have a resolved ticker
                  {mappingStatus.unmapped > 0 && (
                    <span className="text-amber-700 dark:text-amber-300">
                      {' '}· {mappingStatus.unmapped} unmapped
                      {unmappedInView > 0 ? ` (${unmappedInView} in current view)` : ''}
                    </span>
                  )}
                </>
              ) : (
                'Symbol mapping status unavailable'
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleLoad()}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Loading...' : 'Load from Live'}
              </button>
              <button
                type="button"
                onClick={() => handleFetchSymbols()}
                disabled={fetchingSymbols}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {fetchingSymbols ? 'Resolving…' : 'Resolve symbols from eToro'}
              </button>
            </div>
          </div>
        </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
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
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            {!showPostLiveLoadBanner && (
            <button
              onClick={handleLoad}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Load from Live'}
            </button>
            )}
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
                            <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">
                              <div className="flex flex-col items-center gap-1">
                                <span>{displaySymbol(stock)}</span>
                                {isUnmappedStock(stock) && stock?.instrumentId ? (
                                  <button
                                    type="button"
                                    onClick={() => handleLookupInstrument(stock.instrumentId!)}
                                    disabled={resolvingInstrumentId === stock.instrumentId || fetchingSymbols}
                                    className="px-2 py-0.5 text-xs font-medium bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded"
                                    title="Look up via eToro API and save to stock_ticker_cache"
                                  >
                                    {resolvingInstrumentId === stock.instrumentId ? 'Looking up…' : 'Lookup symbol'}
                                  </button>
                                ) : null}
                              </div>
                            </td>
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
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Instrument ID</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualInstrumentId}
                    onChange={(e) => setManualInstrumentId(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAddInstrumentById();
                    }}
                    placeholder="12345"
                    className="w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleAddInstrumentById()}
                  disabled={addingInstrumentId || !manualInstrumentId.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {addingInstrumentId ? 'Adding…' : 'Add & lookup'}
                </button>
              </div>
              <button
                onClick={() => handleFetchSymbols()}
                disabled={fetchingSymbols}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {fetchingSymbols ? 'Fetching...' : 'Resolve symbols from eToro'}
              </button>
              <button
                onClick={handleGetDividendPerShare}
                disabled={fetchingDividendPerShare}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {fetchingDividendPerShare ? 'Updating...' : 'Get Dividend Per Share'}
              </button>
            </div>
            {successMessage && (
              <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg">
                {successMessage}
              </div>
            )}
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
                        <SymbolMappingSortHeader
                          label="Instrument ID"
                          sortKey="instrumentId"
                          activeKey={stockTickerSortKey}
                          direction={stockTickerSortDir}
                          onSort={handleStockTickerSort}
                        />
                        <SymbolMappingSortHeader
                          label="Symbol"
                          sortKey="symbolFull"
                          activeKey={stockTickerSortKey}
                          direction={stockTickerSortDir}
                          onSort={handleStockTickerSort}
                        />
                        {hasResearchSymbol && (
                          <SymbolMappingSortHeader
                            label="Research symbol"
                            sortKey="researchSymbol"
                            activeKey={stockTickerSortKey}
                            direction={stockTickerSortDir}
                            onSort={handleStockTickerSort}
                          />
                        )}
                        <SymbolMappingSortHeader
                          label="Display Name"
                          sortKey="displayName"
                          activeKey={stockTickerSortKey}
                          direction={stockTickerSortDir}
                          onSort={handleStockTickerSort}
                        />
                        <SymbolMappingSortHeader
                          label="Dividend per Share"
                          sortKey="dividendPerShare"
                          activeKey={stockTickerSortKey}
                          direction={stockTickerSortDir}
                          onSort={handleStockTickerSort}
                        />
                        {hasIsDividend && (
                          <SymbolMappingSortHeader
                            label="Is Dividend"
                            sortKey="isDividend"
                            activeKey={stockTickerSortKey}
                            direction={stockTickerSortDir}
                            onSort={handleStockTickerSort}
                          />
                        )}
                        <th className="w-24 text-center" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStockTickerRows.length === 0 ? (
                        <tr>
                          <td colSpan={symbolMappingColSpan} className="py-8 text-center text-gray-500 dark:text-gray-400">
                            No rows. Use the buttons above to populate the cache.
                          </td>
                        </tr>
                      ) : (
                        sortedStockTickerRows.map((row) => {
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
                            {hasResearchSymbol && (
                              <td className="py-2 px-4 text-center">
                                {isEditing ? (
                                  <input
                                    value={row.researchSymbol ?? ''}
                                    onChange={(e) =>
                                      updateStockTickerRow(row.instrumentId, 'researchSymbol', e.target.value)
                                    }
                                    placeholder="e.g. META"
                                    className="w-full min-w-[5rem] px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                                  />
                                ) : (
                                  <span className="text-gray-900 dark:text-white">{row.researchSymbol || '—'}</span>
                                )}
                              </td>
                            )}
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
