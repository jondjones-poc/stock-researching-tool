'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface StockValuation {
  id?: number;
  stock: string;
  buy_price?: number | null;
  active_price?: number | null;
  dcf_price?: number | null;
  ddm_price?: number | null;
  reit_valuation?: number | null;
  average_valuations?: number | null;
  dividend_per_share?: number | null;
  gross_profit_pct?: number | null;
  roic?: number | null;
  long_term_earning_growth?: number | null;
  simplywall_valuation?: number | null;
  change_pct?: number | null;
  year_high?: number | null;
  year_low?: number | null;
  pe?: number | null;
  eps?: number | null;
  bear_case_avg_price?: number | null;
  bear_case_low_price?: number | null;
  bear_case_high_price?: number | null;
  base_case_avg_price?: number | null;
  base_case_low_price?: number | null;
  base_case_high_price?: number | null;
  bull_case_avg_price?: number | null;
  bull_case_low_price?: number | null;
  bull_case_high_price?: number | null;
}

interface StockListItem {
  id: number;
  stock: string;
  buy_price: number | null;
  active_price: number | null;
  created_at: string;
}

interface Link {
  id: number;
  link: string;
  date_added: string;
  stock_valuations_id: number;
}

interface NewsItem {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  source: string;
  sentiment_label: string;
  sentiment_score: number;
  relevance_score: number;
}

export default function CompanyWatchlistPage() {
  const [stockList, setStockList] = useState<StockListItem[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [loadingList, setLoadingList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stockValuationId, setStockValuationId] = useState<number | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [matchingDcfEntries, setMatchingDcfEntries] = useState<Array<{ id: string; symbol: string; stock_price: number; revenue: number; created_at: string }>>([]);
  const [loadingMatchingEntries, setLoadingMatchingEntries] = useState(false);
  const [earningsCalendar, setEarningsCalendar] = useState<{
    symbol: string;
    nextEarnings: {
      date: string;
      epsEstimate: number | null;
      revenueEstimate: number | null;
      quarter: string | null;
      year: number | null;
      actualEps?: number | null;
      estimatedEps?: number | null;
      actualRevenue?: number | null;
      estimatedRevenue?: number | null;
    } | null;
    allEarnings?: Array<{
      date: string;
      epsEstimate: number | null;
      revenueEstimate: number | null;
      quarter: string | null;
      year: number | null;
      actualEps?: number | null;
      estimatedEps?: number | null;
      actualRevenue?: number | null;
      estimatedRevenue?: number | null;
    }>;
    error?: string;
  } | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [savingEarnings, setSavingEarnings] = useState(false);
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);
  const [ddmData, setDdmData] = useState<{
    currentPrice: number | null;
    intrinsicValue: number | null;
    ddmWithSafety: number | null;
    verdict: string | null;
  } | null>(null);
  const [ddmLoading, setDdmLoading] = useState<boolean>(false);
  
  const [formData, setFormData] = useState<StockValuation>({
    stock: '',
    buy_price: null,
    active_price: null,
    dcf_price: null,
    ddm_price: null,
    reit_valuation: null,
    average_valuations: null,
    dividend_per_share: null,
    gross_profit_pct: null,
    roic: null,
    long_term_earning_growth: null,
    simplywall_valuation: null,
    change_pct: null,
    year_high: null,
    year_low: null,
    pe: null,
    eps: null,
    bear_case_avg_price: null,
    bear_case_low_price: null,
    bear_case_high_price: null,
    base_case_avg_price: null,
    base_case_low_price: null,
    base_case_high_price: null,
    bull_case_avg_price: null,
    bull_case_low_price: null,
    bull_case_high_price: null,
  });

  const searchParams = useSearchParams();

  useEffect(() => {
    loadStockList();
  }, []);

  // Load matching DCF entries and earnings when stock symbol changes
  useEffect(() => {
    if (formData.stock) {
      loadMatchingDcfEntries(formData.stock);
      loadEarningsData(formData.stock);
    } else {
      setMatchingDcfEntries([]);
      setEarningsCalendar(null);
    }
  }, [formData.stock]);

  const loadEarningsData = async (symbol: string, forceRefresh: boolean = false) => {
    if (!symbol) return;
    
    setLoadingEarnings(true);
    try {
      const url = forceRefresh 
        ? `/api/earnings-calendar?symbol=${symbol.toUpperCase()}&force=true`
        : `/api/earnings-calendar?symbol=${symbol.toUpperCase()}`;
      
      console.log(`[Client] Fetching earnings data for ${symbol}, forceRefresh: ${forceRefresh}, URL: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`[Client] Earnings API response for ${symbol}:`, JSON.stringify(data, null, 2));
      console.log(`[Client] Response status: ${response.status}, ok: ${response.ok}`);
      
      if (response.ok) {
        console.log(`[Client] Next earnings date:`, data.nextEarnings?.date);
        console.log(`[Client] All earnings dates:`, data.allEarnings?.map((e: any) => e.date));
        console.log(`[Client] Today's date:`, new Date().toISOString());
        
        if (data.nextEarnings) {
          const earningsDate = new Date(data.nextEarnings.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          earningsDate.setHours(0, 0, 0, 0);
          console.log(`[Client] Earnings date comparison: ${earningsDate.toISOString()} > ${today.toISOString()} = ${earningsDate > today}`);
        }
        
        setEarningsCalendar(data);
      } else {
        console.error(`[Client] Earnings API error:`, data);
        setEarningsCalendar({
          symbol: symbol.toUpperCase(),
          nextEarnings: null,
          error: data.error || 'Failed to fetch earnings data'
        });
      }
    } catch (error: any) {
      console.error('[Client] Error loading earnings data:', error);
      setEarningsCalendar({
        symbol: symbol.toUpperCase(),
        nextEarnings: null,
        error: 'Failed to fetch earnings data'
      });
    } finally {
      setLoadingEarnings(false);
    }
  };

  const handleSaveEarnings = async () => {
    if (!earningsCalendar || !formData.stock) {
      setMessage({ type: 'error', text: 'No earnings data to save' });
      return;
    }

    setSavingEarnings(true);
    try {
      const earningsData = earningsCalendar.nextEarnings;
      
      if (!earningsData || !earningsData.date) {
        setMessage({ type: 'error', text: 'No earnings date available to save' });
        return;
      }

      const response = await fetch('/api/earnings-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: formData.stock,
          nextEarnings: earningsData
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Earnings data saved successfully!' });
        // Refresh the earnings data
        setTimeout(() => {
          loadEarningsData(formData.stock);
        }, 500);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save earnings data' });
      }
    } catch (error: any) {
      console.error('Error saving earnings data:', error);
      setMessage({ type: 'error', text: `Error saving earnings data: ${error.message}` });
    } finally {
      setSavingEarnings(false);
    }
  };

  // Fetch news data for a symbol
  const fetchNewsData = async (symbol: string) => {
    setNewsLoading(true);
    try {
      const response = await fetch(`/api/news?symbol=${symbol}`);
      
      if (!response.ok) {
        console.error('News API error:', response.status);
        setNewsData([]);
        return;
      }
      
      const result = await response.json();
      setNewsData(result.data || []);
    } catch (error) {
      console.error('Error fetching news data:', error);
      setNewsData([]);
    } finally {
      setNewsLoading(false);
    }
  };

  // Fetch DDM data for a symbol
  const fetchDdmData = async (symbol: string) => {
    setDdmLoading(true);
    try {
      const response = await fetch(`/api/ddm-data?symbol=${symbol}`);
      
      if (!response.ok) {
        // If 404, no DDM data exists for this symbol
        if (response.status === 404) {
          setDdmData(null);
          return;
        }
        console.error('DDM API error:', response.status);
        setDdmData(null);
        return;
      }
      
      const result = await response.json();
      
      // Determine verdict based on current price, DDM with safety, and intrinsic value
      // Logic matches DDM page: BUY if price <= ddmWithSafety, HOLD if price <= intrinsicValue, else WAIT
      let verdict: string | null = null;
      if (result.currentPrice !== null && result.ddmWithSafety !== null && result.intrinsicValue !== null) {
        if (result.currentPrice <= result.ddmWithSafety) {
          verdict = 'BUY';
        } else if (result.currentPrice <= result.intrinsicValue) {
          verdict = 'HOLD';
        } else {
          verdict = 'WAIT';
        }
      }
      
      setDdmData({
        currentPrice: result.currentPrice,
        intrinsicValue: result.intrinsicValue,
        ddmWithSafety: result.ddmWithSafety,
        verdict: verdict
      });
    } catch (error) {
      console.error('Error fetching DDM data:', error);
      setDdmData(null);
    } finally {
      setDdmLoading(false);
    }
  };

  const loadMatchingDcfEntries = async (symbol: string) => {
    if (!symbol) return;
    
    setLoadingMatchingEntries(true);
    try {
      const response = await fetch(`/api/dcf/list?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
      const result = await response.json();
      
      if (response.ok && result.data) {
        setMatchingDcfEntries(result.data);
      } else {
        setMatchingDcfEntries([]);
      }
    } catch (error: any) {
      console.error('Error loading matching DCF entries:', error);
      setMatchingDcfEntries([]);
    } finally {
      setLoadingMatchingEntries(false);
    }
  };

  useEffect(() => {
    // Check if stock_id is in URL query params and auto-select it
    const stockId = searchParams.get('stock_id');
    if (stockId && stockList.length > 0 && !selectedStockId) {
      // Check if the stock exists in the list
      const stockExists = stockList.some(stock => stock.id.toString() === stockId);
      if (stockExists) {
        // Wait a bit for component to be ready, then select
        const timer = setTimeout(() => {
          handleStockSelect(stockId);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, stockList]);

  const loadStockList = async () => {
    setLoadingList(true);
    setMessage(null);
    try {
      const response = await fetch('/api/stock-valuations/list');
      const result = await response.json();
      
      if (response.ok && result.data) {
        setStockList(result.data);
      } else {
        const errorMsg = result.details || result.error || 'Failed to load stock list';
        console.error('Failed to load stock list:', errorMsg, result);
        setMessage({ 
          type: 'error', 
          text: `Failed to load stock list: ${errorMsg}${result.hint ? ` (${result.hint})` : ''}` 
        });
        setStockList([]);
      }
    } catch (error: any) {
      console.error('Error loading stock list:', error);
      setMessage({ 
        type: 'error', 
        text: `Error loading stock list: ${error.message || 'Unknown error'}` 
      });
      setStockList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const handleStockSelect = async (id: string) => {
    if (!id) {
      // Reset form and hide sections
      setFormData({
        stock: '',
        buy_price: null,
        active_price: null,
        dcf_price: null,
        ddm_price: null,
        reit_valuation: null,
        average_valuations: null,
        dividend_per_share: null,
        gross_profit_pct: null,
        roic: null,
        long_term_earning_growth: null,
        simplywall_valuation: null,
        change_pct: null,
        year_high: null,
        year_low: null,
        pe: null,
        eps: null,
        bear_case_avg_price: null,
        bear_case_low_price: null,
        bear_case_high_price: null,
        base_case_avg_price: null,
        base_case_low_price: null,
        base_case_high_price: null,
        bull_case_avg_price: null,
        bull_case_low_price: null,
        bull_case_high_price: null,
      });
      setStockValuationId(null);
      setLinks([]);
      setNewLink('');
      setShowSections(false);
      setDdmData(null);
      setNewsData([]);
      return;
    }
    
    setSelectedStockId(id);
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/stock-valuations?id=${id}`);
      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to load from database' });
        setLoading(false);
        return;
      }

      const data = result.data;
      setStockValuationId(result.id);

      setFormData({
        stock: data.stock || '',
        buy_price: data.buy_price ?? null,
        active_price: data.active_price ?? null,
        dcf_price: data.dcf_price ?? null,
        ddm_price: data.ddm_price ?? null,
        reit_valuation: data.reit_valuation ?? null,
        average_valuations: data.average_valuations ?? null,
        dividend_per_share: data.dividend_per_share ?? null,
        gross_profit_pct: data.gross_profit_pct ?? null,
        roic: data.roic ?? null,
        long_term_earning_growth: data.long_term_earning_growth ?? null,
        simplywall_valuation: data.simplywall_valuation ?? null,
        change_pct: data.change_pct ?? null,
        year_high: data.year_high ?? null,
        year_low: data.year_low ?? null,
        pe: data.pe ?? null,
        eps: data.eps ?? null,
        bear_case_avg_price: data.bear_case_avg_price ?? null,
        bear_case_low_price: data.bear_case_low_price ?? null,
        bear_case_high_price: data.bear_case_high_price ?? null,
        base_case_avg_price: data.base_case_avg_price ?? null,
        base_case_low_price: data.base_case_low_price ?? null,
        base_case_high_price: data.base_case_high_price ?? null,
        bull_case_avg_price: data.bull_case_avg_price ?? null,
        bull_case_low_price: data.bull_case_low_price ?? null,
        bull_case_high_price: data.bull_case_high_price ?? null,
      });

      // Show sections when stock is selected
      setShowSections(true);
      
      // Fetch news and DDM data for the selected stock
      if (data.stock) {
        fetchNewsData(data.stock);
        fetchDdmData(data.stock);
      }

      // Load links for this stock
      await loadLinks(result.id);
    } catch (error: any) {
      console.error('Error loading stock valuation:', error);
      setMessage({ 
        type: 'error', 
        text: `Error loading stock valuation: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLinks = async (stockValuationId: number) => {
    setLoadingLinks(true);
    try {
      const response = await fetch(`/api/links?stock_valuations_id=${stockValuationId}`);
      const result = await response.json();

      if (response.ok && result.data) {
        setLinks(result.data);
      } else {
        console.error('Failed to load links:', result.error);
        setLinks([]);
      }
    } catch (error: any) {
      console.error('Error loading links:', error);
      setLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleAddLink = async () => {
    if (!newLink.trim() || !stockValuationId) {
      setMessage({ type: 'error', text: 'Please enter a valid URL and select a stock' });
      return;
    }

    // Validate URL format
    try {
      new URL(newLink);
    } catch {
      setMessage({ type: 'error', text: 'Please enter a valid URL (e.g., https://example.com)' });
      return;
    }

    setAddingLink(true);
    setMessage(null);

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          link: newLink.trim(),
          stock_valuations_id: stockValuationId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to add link' });
        return;
      }

      setMessage({ type: 'success', text: 'Link added successfully!' });
      setNewLink('');
      await loadLinks(stockValuationId);
    } catch (error: any) {
      console.error('Error adding link:', error);
      setMessage({ type: 'error', text: `Error adding link: ${error.message || 'Unknown error'}` });
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    if (!confirm('Are you sure you want to delete this link?')) {
      return;
    }

    try {
      const response = await fetch(`/api/links?id=${linkId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to delete link' });
        return;
      }

      setMessage({ type: 'success', text: 'Link deleted successfully!' });
      if (stockValuationId) {
        await loadLinks(stockValuationId);
      }
    } catch (error: any) {
      console.error('Error deleting link:', error);
      setMessage({ type: 'error', text: `Error deleting link: ${error.message || 'Unknown error'}` });
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleInputChange = (field: keyof StockValuation, value: string) => {
    if (field === 'stock') {
      setFormData(prev => ({ ...prev, [field]: value.toUpperCase() }));
    } else {
      const numValue = value === '' ? null : parseFloat(value);
      setFormData(prev => ({ ...prev, [field]: isNaN(numValue as number) ? null : numValue }));
    }
  };

  const handleUpdateFromLive = async () => {
    if (!formData.stock) {
      setMessage({ type: 'error', text: 'Stock symbol is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Fetch data from APIs
      const [financialsRes, peRatiosRes, earningsGrowthRes, fmpRes, keyMetricsRes] = await Promise.allSettled([
        fetch(`/api/financials?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/pe-ratios?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/earnings-growth?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/fmp?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/key-metrics?symbol=${formData.stock.toUpperCase()}`)
      ]);

      const updatedFields: Partial<StockValuation> = {};

      // Process Financials data for Gross Profit (%)
      if (financialsRes.status === 'fulfilled' && financialsRes.value.ok) {
        const financials = await financialsRes.value.json();
        if (financials.grossProfitMargin !== null && financials.grossProfitMargin !== undefined) {
          // Convert decimal to percentage and round to 2 decimal places (e.g., 0.8910 -> 89.10)
          updatedFields.gross_profit_pct = Math.round((financials.grossProfitMargin * 100) * 100) / 100;
        }
      }

      // Process PE Ratios data for Dividend Per Share, PE, Change %, Year High, Year Low, Active Price
      if (peRatiosRes.status === 'fulfilled' && peRatiosRes.value.ok) {
        const peRatios = await peRatiosRes.value.json();
        if (peRatios.dividendPerShare !== null && peRatios.dividendPerShare !== undefined) {
          // Round to 2 decimal places
          updatedFields.dividend_per_share = Math.round(peRatios.dividendPerShare * 100) / 100;
        }
        // Get PE ratio
        if (peRatios.currentPE !== null && peRatios.currentPE !== undefined) {
          // Round to 2 decimal places
          updatedFields.pe = Math.round(peRatios.currentPE * 100) / 100;
        }
        // Get Active Price (current price) from Finnhub
        if (peRatios.currentPrice !== null && peRatios.currentPrice !== undefined) {
          // Round to 2 decimal places
          updatedFields.active_price = Math.round(peRatios.currentPrice * 100) / 100;
        }
        // Get Change % from Finnhub (prioritize over FMP)
        if (peRatios.changePercent !== null && peRatios.changePercent !== undefined) {
          // Round to 2 decimal places - changePercent is already a percentage from Finnhub (e.g., 1.5 = 1.5%)
          updatedFields.change_pct = Math.round(peRatios.changePercent * 100) / 100;
          console.log('Change % from Finnhub (pe-ratios):', peRatios.changePercent, '->', updatedFields.change_pct);
        }
        // Get Year High from Finnhub (prioritize over FMP)
        if (peRatios.yearHigh !== null && peRatios.yearHigh !== undefined) {
          updatedFields.year_high = Math.round(peRatios.yearHigh * 100) / 100;
        }
        // Get Year Low from Finnhub (prioritize over FMP)
        if (peRatios.yearLow !== null && peRatios.yearLow !== undefined) {
          updatedFields.year_low = Math.round(peRatios.yearLow * 100) / 100;
        }
      }

      // Process Earnings Growth data for Long Term Earning Growth (%)
      if (earningsGrowthRes.status === 'fulfilled' && earningsGrowthRes.value.ok) {
        const earningsGrowth = await earningsGrowthRes.value.json();
        // Use analystGrowthRate if available, otherwise use historicalGrowthRate
        const growthRate = earningsGrowth.analystGrowthRate ?? earningsGrowth.historicalGrowthRate;
        if (growthRate !== null && growthRate !== undefined) {
          // Convert decimal to percentage and round to 2 decimal places (e.g., 0.137 -> 13.70)
          updatedFields.long_term_earning_growth = Math.round((growthRate * 100) * 100) / 100;
        }
      }

      // Process FMP data for Year High, Year Low, Change (%), PE, and Active Price - use as fallback if not from pe-ratios
      if (fmpRes.status === 'fulfilled' && fmpRes.value.ok) {
        const fmp = await fmpRes.value.json();
        // Only use FMP values if not already set from pe-ratios
        if (!updatedFields.active_price && fmp.price !== null && fmp.price !== undefined) {
          // Round to 2 decimal places
          updatedFields.active_price = Math.round(fmp.price * 100) / 100;
        }
        if (!updatedFields.year_high && fmp.yearHigh !== null && fmp.yearHigh !== undefined) {
          // Round to 2 decimal places
          updatedFields.year_high = Math.round(fmp.yearHigh * 100) / 100;
        }
        if (!updatedFields.year_low && fmp.yearLow !== null && fmp.yearLow !== undefined) {
          // Round to 2 decimal places
          updatedFields.year_low = Math.round(fmp.yearLow * 100) / 100;
        }
        if (!updatedFields.change_pct && fmp.changePercent !== null && fmp.changePercent !== undefined) {
          // Round to 2 decimal places - changePercent is already a percentage from FMP (e.g., 1.5 = 1.5%)
          updatedFields.change_pct = Math.round(fmp.changePercent * 100) / 100;
          console.log('Change % from FMP (fallback):', fmp.changePercent, '->', updatedFields.change_pct);
        }
        // Also try to get PE from FMP if not already set from pe-ratios
        if (!updatedFields.pe && fmp.fmpPE !== null && fmp.fmpPE !== undefined) {
          // Round to 2 decimal places
          updatedFields.pe = Math.round(fmp.fmpPE * 100) / 100;
        }
      }

      // Process Key Metrics data for ROIC (%)
      if (keyMetricsRes.status === 'fulfilled' && keyMetricsRes.value.ok) {
        try {
          const keyMetrics = await keyMetricsRes.value.json();
          console.log('Key Metrics full response:', JSON.stringify(keyMetrics, null, 2));
          
          // Check if there's an error in the response (API might return 200 with error field)
          if (keyMetrics.error) {
            console.log('Key Metrics API returned error:', keyMetrics.error);
          } else {
            console.log('ROIC value:', keyMetrics.roic);
            console.log('ROIC type:', typeof keyMetrics.roic);
            console.log('ROIC is null?', keyMetrics.roic === null);
            console.log('ROIC is undefined?', keyMetrics.roic === undefined);
            
            // ROIC is returned as a decimal (e.g., 0.20 = 20%), convert to percentage
            // Check explicitly for null/undefined, but allow 0 as a valid value
            if (keyMetrics.roic !== null && keyMetrics.roic !== undefined && typeof keyMetrics.roic === 'number') {
              // Convert decimal to percentage and round to 2 decimal places (e.g., 0.20 -> 20.00)
              updatedFields.roic = Math.round((keyMetrics.roic * 100) * 100) / 100;
              console.log('ROIC converted to percentage:', updatedFields.roic);
            } else {
              console.log('ROIC not set - value is null/undefined or not a number:', keyMetrics.roic);
            }
          }
        } catch (jsonError) {
          console.error('Error parsing Key Metrics JSON:', jsonError);
        }
      } else {
        if (keyMetricsRes.status === 'fulfilled') {
          console.log('Key Metrics API response not OK. Status:', keyMetricsRes.value.status);
          try {
            const errorText = await keyMetricsRes.value.text();
            console.log('Key Metrics error response:', errorText);
          } catch (e) {
            console.log('Could not read error response');
          }
        } else {
          console.log('Key Metrics API request rejected:', keyMetricsRes.reason);
        }
      }

      // Update form data with fetched values
      if (Object.keys(updatedFields).length > 0) {
        setFormData(prev => ({ ...prev, ...updatedFields }));
        setMessage({ 
          type: 'success', 
          text: 'Successfully updated from live data!' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: 'No data available to update. Please check the stock symbol.' 
        });
      }
    } catch (error: any) {
      console.error('Error updating from live data:', error);
      setMessage({ 
        type: 'error', 
        text: `Error updating from live data: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.stock) {
      setMessage({ type: 'error', text: 'Stock symbol is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const url = stockValuationId 
        ? `/api/stock-valuations?id=${stockValuationId}`
        : '/api/stock-valuations';
      
      const method = stockValuationId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ 
          type: 'error', 
          text: result.error || `Failed to ${stockValuationId ? 'update' : 'save'} stock valuation` 
        });
        return;
      }

      setMessage({ 
        type: 'success', 
        text: `Stock valuation ${stockValuationId ? 'updated' : 'saved'} successfully!` 
      });
      
      if (!stockValuationId) {
        setStockValuationId(result.id);
      }
      
      // Reload the list to show the new/updated entry
      await loadStockList();
    } catch (error: any) {
      console.error('Error saving stock valuation:', error);
      setMessage({ 
        type: 'error', 
        text: `Error saving stock valuation: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!stockValuationId) {
      setMessage({ type: 'error', text: 'No stock valuation selected to delete' });
      return;
    }

    if (!confirm('Are you sure you want to delete this stock valuation?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/stock-valuations?id=${stockValuationId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to delete stock valuation' });
        return;
      }

      setMessage({ type: 'success', text: 'Stock valuation deleted successfully!' });
      
      // Reset form
      setFormData({
        stock: '',
        buy_price: null,
        active_price: null,
        dcf_price: null,
        ddm_price: null,
        reit_valuation: null,
        average_valuations: null,
        dividend_per_share: null,
        gross_profit_pct: null,
        roic: null,
        long_term_earning_growth: null,
        simplywall_valuation: null,
        change_pct: null,
        year_high: null,
        year_low: null,
        pe: null,
        eps: null,
      });
      setStockValuationId(null);
      setSelectedStockId('');
      setLinks([]);
      setNewLink('');
      
      // Reload the list
      await loadStockList();
    } catch (error: any) {
      console.error('Error deleting stock valuation:', error);
      setMessage({ 
        type: 'error', 
        text: `Error deleting stock valuation: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Dropdown Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            <select
              id="stock-select"
              value={selectedStockId}
              onChange={(e) => handleStockSelect(e.target.value)}
              disabled={loadingList || loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Select a stock --</option>
              {[...stockList].sort((a, b) => a.stock.localeCompare(b.stock)).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.stock}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setShowSections(true);
                setSelectedStockId('');
                setStockValuationId(null);
                setFormData({
                  stock: '',
                  buy_price: null,
                  active_price: null,
                  dcf_price: null,
                  ddm_price: null,
                  reit_valuation: null,
                  average_valuations: null,
                  dividend_per_share: null,
                  gross_profit_pct: null,
                  roic: null,
                  long_term_earning_growth: null,
                  simplywall_valuation: null,
                  change_pct: null,
                  year_high: null,
                  year_low: null,
                  pe: null,
                  eps: null,
                  bear_case_avg_price: null,
                  bear_case_low_price: null,
                  bear_case_high_price: null,
                  base_case_avg_price: null,
                  base_case_low_price: null,
                  base_case_high_price: null,
                  bull_case_avg_price: null,
                  bull_case_low_price: null,
                  bull_case_high_price: null,
                });
                setLinks([]);
                setNewLink('');
                setMessage(null);
              }}
              className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stock Basic Info Section */}
        {showSections && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Stock */}
            <div>
              <label htmlFor="stock" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock *
              </label>
              <input
                type="text"
                id="stock"
                value={formData.stock}
                onChange={(e) => handleInputChange('stock', e.target.value)}
                placeholder="e.g., CRM"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Buy Price */}
            <div>
              <label htmlFor="buy_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                My Buy Price
              </label>
              <input
                type="number"
                id="buy_price"
                step="0.01"
                value={formData.buy_price ?? ''}
                onChange={(e) => handleInputChange('buy_price', e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Active Price */}
            <div>
              <label htmlFor="active_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Active Price
              </label>
              <input
                type="number"
                id="active_price"
                step="0.01"
                value={formData.active_price ?? ''}
                onChange={(e) => handleInputChange('active_price', e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Buy Indicator */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Buy
              </label>
              <div className={`w-full px-4 py-2 rounded-lg border-2 flex items-center justify-center font-semibold ${
                formData.buy_price !== null && formData.buy_price !== undefined && 
                formData.active_price !== null && formData.active_price !== undefined && 
                Number(formData.active_price) < Number(formData.buy_price)
                  ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400'
              }`}>
                {formData.buy_price !== null && formData.buy_price !== undefined && 
                 formData.active_price !== null && formData.active_price !== undefined && 
                 Number(formData.active_price) < Number(formData.buy_price) ? (
                  <span className="text-lg">✓</span>
                ) : (
                  <span className="text-lg">✗</span>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Form Section */}
        {showSections && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Stock Details
            </h2>
            <button
              onClick={handleUpdateFromLive}
              disabled={saving || !formData.stock}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? 'Updating...' : '🔄 Refresh'}
            </button>
          </div>

          <div className="space-y-6">
            {/* Row 1: PE, EPS, Change (%) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* PE */}
              <div>
                <label htmlFor="pe" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  PE
                </label>
                <input
                  type="number"
                  id="pe"
                  step="0.01"
                  value={formData.pe ?? ''}
                  onChange={(e) => handleInputChange('pe', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* EPS */}
              <div>
                <label htmlFor="eps" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  EPS
                </label>
                <input
                  type="number"
                  id="eps"
                  step="0.01"
                  value={formData.eps ?? ''}
                  onChange={(e) => handleInputChange('eps', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Change (%) */}
              <div>
                <label htmlFor="change_pct" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Change (%)
                </label>
                <input
                  type="number"
                  id="change_pct"
                  step="0.01"
                  value={formData.change_pct ?? ''}
                  onChange={(e) => handleInputChange('change_pct', e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formData.change_pct !== null && formData.change_pct !== undefined
                      ? formData.change_pct > 0
                        ? 'border-green-500 text-green-600 dark:text-green-400 dark:border-green-400'
                        : formData.change_pct < 0
                        ? 'border-red-500 text-red-600 dark:text-red-400 dark:border-red-400'
                        : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
                      : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
                  }`}
                />
              </div>
            </div>

            {/* Row 2: Year Low, Year High, Gross Profit (%) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Year Low */}
              <div>
                <label htmlFor="year_low" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year Low
                </label>
                <input
                  type="number"
                  id="year_low"
                  step="0.01"
                  value={formData.year_low ?? ''}
                  onChange={(e) => handleInputChange('year_low', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Year High */}
              <div>
                <label htmlFor="year_high" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year High
                </label>
                <input
                  type="number"
                  id="year_high"
                  step="0.01"
                  value={formData.year_high ?? ''}
                  onChange={(e) => handleInputChange('year_high', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Gross Profit (%) */}
              <div>
                <label htmlFor="gross_profit_pct" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gross Profit (%)
                </label>
                <input
                  type="number"
                  id="gross_profit_pct"
                  step="0.01"
                  value={formData.gross_profit_pct ?? ''}
                  onChange={(e) => handleInputChange('gross_profit_pct', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Row 3: Long Term Earning Growth (%), ROIC (%), Simplywall.st Valuation (%) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Long Term Earning Growth */}
              <div>
                <label htmlFor="long_term_earning_growth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Long Term Earning Growth (%)
                </label>
                <input
                  type="number"
                  id="long_term_earning_growth"
                  step="0.01"
                  value={formData.long_term_earning_growth ?? ''}
                  onChange={(e) => handleInputChange('long_term_earning_growth', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* ROIC */}
              <div>
                <label htmlFor="roic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ROIC (%)
                </label>
                <input
                  type="number"
                  id="roic"
                  step="0.01"
                  value={formData.roic ?? ''}
                  onChange={(e) => handleInputChange('roic', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Simplywall.st Valuation */}
              <div>
                <label htmlFor="simplywall_valuation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Simplywall.st Valuation (%)
                </label>
                <input
                  type="number"
                  id="simplywall_valuation"
                  step="0.01"
                  value={formData.simplywall_valuation ?? ''}
                  onChange={(e) => handleInputChange('simplywall_valuation', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Rest of the fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Dividend Per Share */}
              <div>
                <label htmlFor="dividend_per_share" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dividend Per Share
                </label>
                <input
                  type="number"
                  id="dividend_per_share"
                  step="0.01"
                  value={formData.dividend_per_share ?? ''}
                  onChange={(e) => handleInputChange('dividend_per_share', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

        </div>
        )}

        {/* Share Price Summary */}
        {showSections && formData.stock && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl mt-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 text-center">Share Price Summary</h2>
            
            {/* Current Price Row */}
            {formData.active_price && (
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 rounded-lg p-6 mb-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-600 mb-4 text-lg">Current Market Price</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Price</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {formatCurrency(formData.active_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Investment Signal</div>
                    <div className={`text-2xl font-bold ${
                      formData.active_price && formData.base_case_avg_price && 
                      formData.active_price < formData.base_case_avg_price ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formData.active_price && formData.base_case_avg_price && 
                       formData.active_price < formData.base_case_avg_price ? 'BUY' : 'HOLD'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Bear Case Row */}
            {(formData.bear_case_avg_price || formData.bear_case_low_price || formData.bear_case_high_price) && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-6 mb-4 border border-red-200 dark:border-red-800">
                <h3 className="font-bold text-red-600 mb-4 text-lg">Bear Case</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(formData.bear_case_avg_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(formData.bear_case_low_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(formData.bear_case_high_price)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Base Case Row */}
            {(formData.base_case_avg_price || formData.base_case_low_price || formData.base_case_high_price) && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-blue-600 mb-4 text-lg">Base Case</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(formData.base_case_avg_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(formData.base_case_low_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(formData.base_case_high_price)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bull Case Row */}
            {(formData.bull_case_avg_price || formData.bull_case_low_price || formData.bull_case_high_price) && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 mb-4 border border-green-200 dark:border-green-800">
                <h3 className="font-bold text-green-600 mb-4 text-lg">Bull Case</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(formData.bull_case_avg_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(formData.bull_case_low_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(formData.bull_case_high_price)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DCF Entry Buttons */}
            {matchingDcfEntries.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {matchingDcfEntries.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/dcf?id=${entry.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Calculations - {new Date(entry.created_at).toLocaleDateString()}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dividend Projections Section */}
        {showSections && formData.stock && ddmData && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl mt-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Dividend Projections</h2>
            {ddmLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500 dark:text-gray-400">Loading DDM data...</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Current Price</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ddmData.currentPrice !== null ? `£${ddmData.currentPrice.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Intrinsic Value</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ddmData.intrinsicValue !== null ? `£${ddmData.intrinsicValue.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">DDM with Safety</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {ddmData.ddmWithSafety !== null ? `£${ddmData.ddmWithSafety.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    ddmData.verdict === 'BUY' 
                      ? 'bg-green-100 dark:bg-green-900/20' 
                      : ddmData.verdict === 'HOLD' 
                      ? 'bg-yellow-100 dark:bg-yellow-900/20' 
                      : ddmData.verdict === 'WAIT'
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Verdict</h3>
                    <p className={`text-2xl font-bold ${
                      ddmData.verdict === 'BUY' 
                        ? 'text-green-600 dark:text-green-400' 
                        : ddmData.verdict === 'HOLD' 
                        ? 'text-yellow-600 dark:text-yellow-400' 
                        : ddmData.verdict === 'WAIT'
                        ? 'text-gray-600 dark:text-gray-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>{ddmData.verdict || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex justify-center mt-6">
                  <Link
                    href={`/ddm?symbol=${formData.stock}`}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    View Data
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* Earnings Section */}
        {showSections && formData.stock && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span>📅</span> Earnings
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadEarningsData(formData.stock, true)}
                  disabled={loadingEarnings || !formData.stock}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                  title="Refresh from API"
                >
                  {loadingEarnings ? 'Loading...' : '🔄 Refresh'}
                </button>
                {earningsCalendar && earningsCalendar.nextEarnings && (
                  <button
                    onClick={handleSaveEarnings}
                    disabled={savingEarnings}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                  >
                    {savingEarnings ? 'Saving...' : '💾 Save'}
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              {(() => {
                if (loadingEarnings) {
                  return (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        Loading earnings data...
                      </p>
                    </div>
                  );
                }
                
                if (!earningsCalendar) {
                  return (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No earnings data available
                      </p>
                    </div>
                  );
                }
                
                if (!earningsCalendar.nextEarnings) {
                  return (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        {earningsCalendar?.error || 'No earnings data available'}
                      </p>
                      {earningsCalendar?.error && earningsCalendar.error.includes('API_NINJAS_API_KEY') && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Please add your API Ninjas key to the environment variables to use this feature.
                        </p>
                      )}
                    </div>
                  );
                }
                
                const nextEarnings = earningsCalendar.nextEarnings;
                const allEarnings = earningsCalendar.allEarnings || [];
                
                return (
                  <div className="space-y-4">
                    {/* Next Earnings */}
                    {nextEarnings && (
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Next Earnings</h3>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Date: </span>
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 ml-1">
                              {new Date(nextEarnings.date).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>
                          {nextEarnings.quarter && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Quarter: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                {nextEarnings.quarter} {nextEarnings.year}
                              </span>
                            </div>
                          )}
                          {nextEarnings.actualEps !== null && nextEarnings.actualEps !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Actual EPS: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${nextEarnings.actualEps.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {nextEarnings.estimatedEps !== null && nextEarnings.estimatedEps !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated EPS: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${nextEarnings.estimatedEps.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {nextEarnings.actualRevenue !== null && nextEarnings.actualRevenue !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Actual Revenue: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${(nextEarnings.actualRevenue / 1000000).toFixed(2)}M
                              </span>
                            </div>
                          )}
                          {nextEarnings.estimatedRevenue !== null && nextEarnings.estimatedRevenue !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Revenue: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${(nextEarnings.estimatedRevenue / 1000000).toFixed(2)}M
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* All Earnings */}
                    {allEarnings.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">All Earnings</h3>
                        <div className="space-y-4">
                          {allEarnings.map((earnings: any, index: number) => (
                            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                              <div className="flex items-center mb-2">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  {new Date(earnings.date).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                {earnings.quarter && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                    ({earnings.quarter} {earnings.year})
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {earnings.actualEps !== null && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Actual EPS: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${earnings.actualEps.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {earnings.estimatedEps !== null && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Estimated EPS: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${earnings.estimatedEps.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {earnings.actualRevenue !== null && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Actual Revenue: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${(earnings.actualRevenue / 1000000).toFixed(2)}M
                                    </span>
                                  </div>
                                )}
                                {earnings.estimatedRevenue !== null && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Estimated Revenue: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${(earnings.estimatedRevenue / 1000000).toFixed(2)}M
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Research Section */}
        {showSections && stockValuationId && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Research
              </h2>
            </div>

            {/* Add Link Section */}
            <div className="mb-6 flex gap-2">
              <input
                type="url"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddLink();
                  }
                }}
                placeholder="https://example.com/article"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddLink}
                disabled={addingLink || !newLink.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              >
                {addingLink ? 'Adding...' : (
                  <>
                    <span className="text-xl">+</span>
                    <span>Add Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Links List */}
            {loadingLinks ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Loading links...
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No research links yet. Add your first link above.
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <a
                        href={link.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {link.link}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Added: {new Date(link.date_added).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteLink(link.id)}
                      className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Valuation Section */}
        {showSections && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Valuation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* DDM Price */}
              <div>
                <label htmlFor="ddm_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  DDM Price
                </label>
                <input
                  type="number"
                  id="ddm_price"
                  step="0.01"
                  value={formData.ddm_price ?? ''}
                  onChange={(e) => handleInputChange('ddm_price', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* REIT Valuation */}
              <div>
                <label htmlFor="reit_valuation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  REIT Valuation
                </label>
                <input
                  type="number"
                  id="reit_valuation"
                  step="0.01"
                  value={formData.reit_valuation ?? ''}
                  onChange={(e) => handleInputChange('reit_valuation', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Average Valuations */}
              <div>
                <label htmlFor="average_valuations" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Average Valuations
                </label>
                <input
                  type="number"
                  id="average_valuations"
                  step="0.01"
                  value={formData.average_valuations ?? ''}
                  onChange={(e) => handleInputChange('average_valuations', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - Bottom of page */}
        {showSections && (
          <div className="flex justify-center items-center gap-4 mt-8 mb-8">
            <button
              onClick={handleSave}
              disabled={saving || !formData.stock}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? 'Saving...' : stockValuationId ? '💾 Update' : '💾 Save'}
            </button>
            {stockValuationId && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        )}

        {/* News Section - Bottom of page */}
        {showSections && formData.stock && (
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Latest News</h2>
            {newsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500 dark:text-gray-400">Loading news...</div>
              </div>
            ) : newsData.length > 0 ? (
              <div className="space-y-2">
                {newsData.map((news, index) => {
                  // Parse the timestamp
                  const timeStr = news.time_published;
                  const year = timeStr.slice(0, 4);
                  const month = timeStr.slice(4, 6);
                  const day = timeStr.slice(6, 8);
                  const hour = timeStr.slice(9, 11);
                  const minute = timeStr.slice(11, 13);
                  const formattedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
                  const timeAgo = Math.floor((Date.now() - formattedDate.getTime()) / (1000 * 60 * 60));
                  
                  // Determine sentiment color
                  const sentimentColor = 
                    news.sentiment_label === 'Bullish' ? 'text-green-600 dark:text-green-400' :
                    news.sentiment_label === 'Bearish' ? 'text-red-600 dark:text-red-400' :
                    news.sentiment_label === 'Somewhat-Bullish' ? 'text-green-500 dark:text-green-500' :
                    news.sentiment_label === 'Somewhat-Bearish' ? 'text-orange-500 dark:text-orange-400' :
                    'text-gray-600 dark:text-gray-400';
                  
                  return (
                    <a
                      key={index}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-medium text-green-900 dark:text-green-300 line-clamp-2 mb-1">
                            {news.title}
                          </h5>
                          <p className="text-xs text-green-700 dark:text-green-400 line-clamp-2 mb-2">
                            {news.summary}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                            <span className="font-medium">{news.source}</span>
                            <span>•</span>
                            <span>{timeAgo}h ago</span>
                            {news.sentiment_label && (
                              <>
                                <span>•</span>
                                <span className={sentimentColor}>{news.sentiment_label}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h5 className="text-sm font-medium text-orange-900 dark:text-orange-300">No News Available</h5>
                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                      Unable to fetch news. This may be due to API rate limiting.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
