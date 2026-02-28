'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Decimal from 'decimal.js';

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
  market_cap?: number | null;
  enterprise_value?: number | null;
  free_cash_flow?: number | null;
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
  const [bearTheoryLoading, setBearTheoryLoading] = useState(false);
  const [baseTheoryLoading, setBaseTheoryLoading] = useState(false);
  const [bullTheoryLoading, setBullTheoryLoading] = useState(false);
  const [marginOfSafety, setMarginOfSafety] = useState<number>(20);
  const [valueDriverClassification, setValueDriverClassification] = useState<{
    driverBuckets: string[];
    recommendedModel: string;
    explain: string[];
    hasMissingData?: boolean;
    missingDataFields?: string[];
    currentPrice?: number | null;
    annualDividendPerShare?: number | null;
    dividendYield?: number;
    dividendYieldPercent?: number;
    sharesOutstandingNow?: number | null;
    sharesOutstanding5yAgo?: number | null;
    shareChange5y?: number | null;
    shareChange5yPercent?: number | null;
    debug?: {
      lowYieldThreshold: number;
      buybackHeavyThreshold: number;
      dividendYieldBelowThreshold: boolean;
      shareChangeAvailable: boolean;
      shareChangeBelowBuybackThreshold: boolean;
      classificationPath: string;
    };
  } | null>(null);
  const [valueDriverLoading, setValueDriverLoading] = useState<boolean>(false);
  const [showDebugDetails, setShowDebugDetails] = useState<boolean>(false);
  const [validateAiClicked, setValidateAiClicked] = useState<boolean>(false);
  const [askAiClicked, setAskAiClicked] = useState<boolean>(false);
  const [askDcfAiClicked, setAskDcfAiClicked] = useState<boolean>(false);
  const [clearingDcfProjections, setClearingDcfProjections] = useState<boolean>(false);
  const [savingStockDetails, setSavingStockDetails] = useState<boolean>(false);
  
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
  const router = useRouter();

  useEffect(() => {
    loadStockList();
  }, []);

  // Load stock from query parameter on mount (check for symbol parameter)
  useEffect(() => {
    const symbol = searchParams.get('symbol');
    const stockId = searchParams.get('stock_id');
    
    // Only load if we have a symbol in the URL and haven't already loaded a stock
    if (symbol && stockList.length > 0 && !selectedStockId && !formData.stock && !stockId) {
      // Find the stock by symbol in the list
      const stockEntry = stockList.find(entry => entry.stock.toUpperCase() === symbol.toUpperCase());
      if (stockEntry) {
        handleStockSelect(stockEntry.id.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockList, searchParams]);

  // Load matching DCF entries, earnings, DCF projections, and value driver classification when stock symbol changes
  useEffect(() => {
    if (formData.stock) {
      loadMatchingDcfEntries(formData.stock);
      loadEarningsData(formData.stock);
      loadDcfProjections(formData.stock);
      fetchValueDriverClassification(formData.stock);
    } else {
      setMatchingDcfEntries([]);
      setEarningsCalendar(null);
      setValueDriverClassification(null);
    }
  }, [formData.stock]);

  // Sync DDM Price with DDM with Safety value when DDM data is loaded
  useEffect(() => {
    if (ddmData && ddmData.ddmWithSafety !== null && ddmData.ddmWithSafety !== undefined) {
      setFormData(prev => ({
        ...prev,
        ddm_price: ddmData.ddmWithSafety
      }));
    }
  }, [ddmData]);

  // Calculate Average Valuations from DDM Price, DCF Prediction Price (Bear Case Low), and REIT Valuation
  // Only include non-zero values in the calculation
  useEffect(() => {
    const values: number[] = [];
    
    // Add DDM Price if not null/undefined and not 0
    if (formData.ddm_price !== null && formData.ddm_price !== undefined && formData.ddm_price !== 0) {
      values.push(formData.ddm_price);
    }
    
    // Add DCF Prediction Price (Bear Case Low) if not null/undefined and not 0
    if (formData.bear_case_low_price !== null && formData.bear_case_low_price !== undefined && formData.bear_case_low_price !== 0) {
      values.push(formData.bear_case_low_price);
    }
    
    // Add REIT Valuation if not null/undefined and not 0
    if (formData.reit_valuation !== null && formData.reit_valuation !== undefined && formData.reit_valuation !== 0) {
      values.push(formData.reit_valuation);
    }
    
    // Calculate average if we have at least one value
    const average = values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : null;
    
    // Update average_valuations
    setFormData(prev => ({
      ...prev,
      average_valuations: average !== null ? Math.round(average * 100) / 100 : null
    }));
  }, [formData.ddm_price, formData.bear_case_low_price, formData.reit_valuation]);

  const loadEarningsData = async (symbol: string, forceRefresh: boolean = false) => {
    if (!symbol) return;
    
    setLoadingEarnings(true);
    try {
      const url = forceRefresh 
        ? `/api/earnings-calendar?symbol=${symbol.toUpperCase()}&force=true`
        : `/api/earnings-calendar?symbol=${symbol.toUpperCase()}`;
      
      console.log(`[Client] Fetching earnings data for ${symbol}, forceRefresh: ${forceRefresh}, URL: ${url}`);
      
      const response = await fetch(url);
      
      // Try to parse JSON, but handle cases where response might be empty or malformed
      let data: any = {};
      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch (parseError) {
        console.error(`[Client] Failed to parse earnings API response:`, parseError);
        data = { error: 'Invalid response from server' };
      }
      
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
        // Build a more descriptive error message
        const errorMessage = data.error || data.details || `HTTP ${response.status}: ${response.statusText}` || 'Failed to fetch earnings data';
        console.error(`[Client] Earnings API error (${response.status}):`, errorMessage, data);
        setEarningsCalendar({
          symbol: symbol.toUpperCase(),
          nextEarnings: null,
          error: errorMessage
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

  // Fetch value driver classification
  const fetchValueDriverClassification = async (symbol: string) => {
    if (!symbol) {
      setValueDriverClassification(null);
      return;
    }
    
    setValueDriverLoading(true);
    // Clear old data immediately when fetching new data
    setValueDriverClassification(null);
    try {
      const response = await fetch(`/api/value-driver-classification?symbol=${symbol}`);
      
      if (!response.ok) {
        console.error('Value driver classification API error:', response.status);
        setValueDriverClassification(null);
        return;
      }
      
      const result = await response.json();
      setValueDriverClassification({
        driverBuckets: result.driverBuckets || [],
        recommendedModel: result.recommendedModel || '',
        explain: result.explain || [],
        hasMissingData: result.hasMissingData || false,
        missingDataFields: result.missingDataFields || [],
        currentPrice: result.currentPrice,
        annualDividendPerShare: result.annualDividendPerShare,
        dividendYield: result.dividendYield,
        dividendYieldPercent: result.dividendYieldPercent,
        sharesOutstandingNow: result.sharesOutstandingNow,
        sharesOutstanding5yAgo: result.sharesOutstanding5yAgo,
        shareChange5y: result.shareChange5y,
        shareChange5yPercent: result.shareChange5yPercent,
        debug: result.debug
      });
    } catch (error) {
      console.error('Error fetching value driver classification:', error);
      setValueDriverClassification(null);
    } finally {
      setValueDriverLoading(false);
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

  // Fetch DCF data and calculate projections to update bear/base/bull case prices
  const loadDcfProjections = async (symbol: string) => {
    if (!symbol) return;
    
    try {
      const response = await fetch(`/api/dcf?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
      const result = await response.json();
      
      if (!response.ok || !result.data) {
        // No DCF data available, keep existing values
        return;
      }

      const dcfData = result.data;
      
      // Calculate projections for each scenario
      const scenarios: ('bear' | 'base' | 'bull')[] = ['bear', 'base', 'bull'];
      const years = 5;
      const projections: {
        bear: { low: number[]; high: number[] };
        base: { low: number[]; high: number[] };
        bull: { low: number[]; high: number[] };
      } = {
        bear: { low: [], high: [] },
        base: { low: [], high: [] },
        bull: { low: [], high: [] }
      };

      scenarios.forEach(scenario => {
        let currentRevenue = new Decimal(dcfData.revenue || 0);
        let currentNetIncome = new Decimal(dcfData.netIncome || 0);
        
        const revenueGrowth = dcfData.revenueGrowth?.[scenario] || 0;
        const netIncomeGrowth = dcfData.netIncomeGrowth?.[scenario] || 0;
        const peLow = dcfData.peLow?.[scenario] || 0;
        const peHigh = dcfData.peHigh?.[scenario] || 0;

        const sharesOutstanding = dcfData.sharesOutstanding && dcfData.sharesOutstanding > 0 
          ? dcfData.sharesOutstanding 
          : 50000000;

        let currentEps: Decimal | null = null;
        if (dcfData.currentEps && dcfData.currentEps > 0) {
          currentEps = new Decimal(dcfData.currentEps);
        } else if (sharesOutstanding > 0) {
          currentEps = currentNetIncome.div(sharesOutstanding);
        }

        for (let year = 0; year < years; year++) {
          if (year > 0) {
            currentRevenue = currentRevenue.mul(new Decimal(1).add(revenueGrowth));
            currentNetIncome = currentNetIncome.mul(new Decimal(1).add(netIncomeGrowth));
            if (currentEps) {
              currentEps = currentEps.mul(new Decimal(1).add(netIncomeGrowth));
            }
          }
          
          const eps = currentEps ?? currentNetIncome.div(sharesOutstanding);
          const sharePriceLow = eps.mul(peLow);
          const sharePriceHigh = eps.mul(peHigh);

          projections[scenario].low.push(sharePriceLow.toNumber());
          projections[scenario].high.push(sharePriceHigh.toNumber());
        }
      });

      // Extract final year prices and calculate averages
      const finalYear = years - 1;
      const updatedFields: Partial<StockValuation> = {};
      
      // Bear case
      if (projections.bear.low[finalYear] && projections.bear.high[finalYear]) {
        updatedFields.bear_case_low_price = projections.bear.low[finalYear];
        updatedFields.bear_case_high_price = projections.bear.high[finalYear];
        updatedFields.bear_case_avg_price = (projections.bear.low[finalYear] + projections.bear.high[finalYear]) / 2;
      }
      
      // Base case
      if (projections.base.low[finalYear] && projections.base.high[finalYear]) {
        updatedFields.base_case_low_price = projections.base.low[finalYear];
        updatedFields.base_case_high_price = projections.base.high[finalYear];
        updatedFields.base_case_avg_price = (projections.base.low[finalYear] + projections.base.high[finalYear]) / 2;
      }
      
      // Bull case
      if (projections.bull.low[finalYear] && projections.bull.high[finalYear]) {
        updatedFields.bull_case_low_price = projections.bull.low[finalYear];
        updatedFields.bull_case_high_price = projections.bull.high[finalYear];
        updatedFields.bull_case_avg_price = (projections.bull.low[finalYear] + projections.bull.high[finalYear]) / 2;
      }

      // Update formData with calculated prices
      if (Object.keys(updatedFields).length > 0) {
        setFormData(prev => ({ ...prev, ...updatedFields }));
      }
    } catch (error: any) {
      console.error('Error loading DCF projections:', error);
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
      setValueDriverClassification(null);
      // Remove symbol from URL
      router.push('/watchlist');
      return;
    }
    
    setSelectedStockId(id);
    setLoading(true);
    setMessage(null);
    // Clear old value driver classification data immediately when selecting a new stock
    setValueDriverClassification(null);
    
    // IMPORTANT: Reset ALL fields to null/defaults FIRST to prevent old data from persisting
    // This ensures no leftover data from the previous stock
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
      market_cap: null,
      enterprise_value: null,
      free_cash_flow: null,
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
    
    // Also clear other related state
    setDdmData(null);
    setNewsData([]);
    setEarningsCalendar(null);
    setMatchingDcfEntries([]);

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

      // NOW load the new stock's data - all fields are already reset to null
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
        market_cap: data.market_cap ?? null,
        enterprise_value: data.enterprise_value ?? null,
        free_cash_flow: data.free_cash_flow ?? null,
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
      
      // Update URL with stock symbol (only if different from current URL)
      if (data.stock) {
        const currentSymbol = searchParams.get('symbol');
        if (currentSymbol?.toUpperCase() !== data.stock.toUpperCase()) {
          router.push(`/watchlist?symbol=${data.stock.toUpperCase()}`);
        }
        
        // Fetch news, DDM data, DCF projections, and value driver classification for the selected stock
        fetchNewsData(data.stock);
        fetchDdmData(data.stock);
        loadDcfProjections(data.stock);
        fetchValueDriverClassification(data.stock);
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

  // Calculate Buy/Hold and margin of safety for a valuation
  const calculateValuationSignal = (valuation: number | null | undefined) => {
    if (!valuation || valuation === 0 || !formData.active_price) {
      return { signal: null, marginOfSafety: null };
    }

    const buyPrice = valuation * (1 - marginOfSafety / 100);
    const signal = formData.active_price <= buyPrice ? 'BUY' : 'HOLD';
    const marginOfSafetyValue = ((valuation - formData.active_price) / valuation) * 100;

    return { signal, marginOfSafety: marginOfSafetyValue };
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

      // Process PE Ratios data for Dividend Per Share, PE, EPS, Change %, Year High, Year Low, Active Price
      if (peRatiosRes.status === 'fulfilled' && peRatiosRes.value.ok) {
        const peRatios = await peRatiosRes.value.json();
        if (peRatios.dividendPerShare !== null && peRatios.dividendPerShare !== undefined) {
          // Round to 2 decimal places
          updatedFields.dividend_per_share = Math.round(peRatios.dividendPerShare * 100) / 100;
        }
        // Get Active Price (current price) from Finnhub - get this first as we need it for PE calculation
        if (peRatios.currentPrice !== null && peRatios.currentPrice !== undefined) {
          // Round to 2 decimal places
          updatedFields.active_price = Math.round(peRatios.currentPrice * 100) / 100;
        }
        // Get TTM EPS and calculate PE from latest price + TTM EPS (most accurate)
        if (peRatios.epsTTM !== null && peRatios.epsTTM !== undefined && peRatios.epsTTM > 0) {
          // Round to 2 decimal places
          updatedFields.eps = Math.round(peRatios.epsTTM * 100) / 100;
          
          // Calculate PE from latest price and TTM EPS
          if (peRatios.currentPrice !== null && peRatios.currentPrice !== undefined && peRatios.currentPrice > 0) {
            const calculatedPE = peRatios.currentPrice / peRatios.epsTTM;
            updatedFields.pe = Math.round(calculatedPE * 100) / 100;
            console.log('[Refresh] PE calculated from Finnhub:', {
              price: peRatios.currentPrice,
              eps: peRatios.epsTTM,
              calculatedPE: calculatedPE,
              roundedPE: updatedFields.pe
            });
          }
        } else if (peRatios.currentPE !== null && peRatios.currentPE !== undefined) {
          // Fallback to PE from Finnhub API if we can't calculate
          updatedFields.pe = Math.round(peRatios.currentPE * 100) / 100;
          console.log('[Refresh] PE from Finnhub API (fallback):', peRatios.currentPE);
        }
        // Get Change % from Finnhub (prioritize over FMP)
        if (peRatios.changePercent !== null && peRatios.changePercent !== undefined) {
          // Round to 2 decimal places - changePercent is already a percentage from Finnhub (e.g., 1.5 = 1.5%)
          updatedFields.change_pct = Math.round(peRatios.changePercent * 100) / 100;
          console.log('Change % from Finnhub (pe-ratios):', peRatios.changePercent, '->', updatedFields.change_pct);
        }

        // Market Cap from Finnhub/FMP (via pe-ratios API)
        // Note: Market Cap can be 0 for some stocks, so we check for null/undefined only
        if (peRatios.marketCap !== null && peRatios.marketCap !== undefined) {
          updatedFields.market_cap = Math.round(peRatios.marketCap * 100) / 100;
          console.log('[Refresh] Market Cap from API:', peRatios.marketCap, '->', updatedFields.market_cap);
        }

        // Enterprise Value from Finnhub/FMP (via pe-ratios API)
        if (peRatios.enterpriseValue !== null && peRatios.enterpriseValue !== undefined && peRatios.enterpriseValue > 0) {
          updatedFields.enterprise_value = Math.round(peRatios.enterpriseValue * 100) / 100;
          console.log('[Refresh] Enterprise Value:', peRatios.enterpriseValue, '->', updatedFields.enterprise_value);
        }

        // Free Cash Flow from FMP (via pe-ratios API)
        if (peRatios.freeCashFlow !== null && peRatios.freeCashFlow !== undefined && peRatios.freeCashFlow !== 0) {
          updatedFields.free_cash_flow = Math.round(peRatios.freeCashFlow * 100) / 100;
          console.log('[Refresh] Free Cash Flow:', peRatios.freeCashFlow, '->', updatedFields.free_cash_flow);
        }

        // 52-week high/low from Finnhub metrics (via pe-ratios API)
        // peRatios.yearHigh / peRatios.yearLow are sourced from Finnhub's 52WeekHigh / 52WeekLow
        if (peRatios.yearHigh !== null && peRatios.yearHigh !== undefined && peRatios.yearHigh > 0) {
          updatedFields.year_high = Math.round(peRatios.yearHigh * 100) / 100;
          console.log('[Refresh] Year High from Finnhub metrics (52-week):', peRatios.yearHigh, '->', updatedFields.year_high);
        }
        if (peRatios.yearLow !== null && peRatios.yearLow !== undefined && peRatios.yearLow > 0) {
          updatedFields.year_low = Math.round(peRatios.yearLow * 100) / 100;
          console.log('[Refresh] Year Low from Finnhub metrics (52-week):', peRatios.yearLow, '->', updatedFields.year_low);
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

      // Process FMP data for Change (%), PE, and Active Price
      // NOTE: Year High / Year Low now come exclusively from Finnhub metrics via the pe-ratios API
      if (fmpRes.status === 'fulfilled' && fmpRes.value.ok) {
        const fmp = await fmpRes.value.json();
        console.log('[Refresh] FMP full response:', JSON.stringify(fmp, null, 2));
        
        // Prioritize FMP's PE if available (FMP tends to have more current data)
        if (fmp.fmpPE !== null && fmp.fmpPE !== undefined && fmp.fmpPE > 0) {
          // Use FMP's PE if it's reasonable (between 1 and 1000) and either:
          // 1. We don't have a PE yet, OR
          // 2. The existing PE seems unreasonable (too high > 100 or negative), OR
          // 3. There's a significant difference (>30%) suggesting one might be outdated
          const existingPE = updatedFields.pe;
          const difference = existingPE ? Math.abs(existingPE - fmp.fmpPE) / Math.max(existingPE, fmp.fmpPE) : 1;
          const shouldUseFmpPE = !existingPE || 
                                 existingPE > 100 || 
                                 existingPE < 0 ||
                                 difference > 0.3; // More than 30% difference
          
          if (shouldUseFmpPE && fmp.fmpPE >= 1 && fmp.fmpPE <= 1000) {
            updatedFields.pe = Math.round(fmp.fmpPE * 100) / 100;
            console.log('[Refresh] PE from FMP (prioritized):', {
              fmpPE: fmp.fmpPE,
              previousPE: existingPE,
              difference: `${(difference * 100).toFixed(1)}%`,
              reason: !existingPE ? 'No existing PE' : existingPE > 100 ? 'Existing PE too high' : difference > 0.3 ? 'Significant difference' : 'Other'
            });
          } else {
            console.log('[Refresh] Keeping existing PE:', {
              existingPE: existingPE,
              fmpPE: fmp.fmpPE,
              difference: `${(difference * 100).toFixed(1)}%`,
              reason: 'FMP PE not significantly better or out of range'
            });
          }
        }
        
        // Only use FMP values if not already set from pe-ratios
        if (!updatedFields.active_price && fmp.price !== null && fmp.price !== undefined) {
          // Round to 2 decimal places
          updatedFields.active_price = Math.round(fmp.price * 100) / 100;
        }

        if (!updatedFields.change_pct && fmp.changePercent !== null && fmp.changePercent !== undefined) {
          // Round to 2 decimal places - changePercent is already a percentage from FMP (e.g., 1.5 = 1.5%)
          updatedFields.change_pct = Math.round(fmp.changePercent * 100) / 100;
          console.log('Change % from FMP (fallback):', fmp.changePercent, '->', updatedFields.change_pct);
        }
      } else {
        if (fmpRes.status === 'rejected') {
          console.error('[Refresh] FMP API request failed:', fmpRes.reason);
        } else if (fmpRes.status === 'fulfilled' && !fmpRes.value.ok) {
          console.error('[Refresh] FMP API response not OK. Status:', fmpRes.value.status);
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

  const handleValidateWithAI = async () => {
    if (!formData.stock) {
      setMessage({ type: 'error', text: 'Stock symbol is required' });
      return;
    }

    try {
      setValidateAiClicked(true);
      
      // Calculate dividend yield if available
      const dividendYield = formData.dividend_per_share && formData.active_price && formData.active_price > 0
        ? ((formData.dividend_per_share / formData.active_price) * 100).toFixed(2)
        : 'N/A';

      // Build the prompt with all Stock Details data
      const lines: string[] = [];
      lines.push('You are a financial data validation expert. Please review the following stock data and validate that it is up to date and accurate.');
      lines.push(`\nStock Symbol: ${formData.stock.toUpperCase()}`);
      lines.push(`\nCurrent Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
      lines.push('\n--- STOCK DETAILS DATA ---');
      lines.push(`\nPrice-to-Earnings (PE) Ratio: ${formData.pe !== null && formData.pe !== undefined ? formData.pe.toFixed(2) : 'N/A'}`);
      lines.push(`Earnings Per Share (EPS): ${formData.eps !== null && formData.eps !== undefined ? `$${formData.eps.toFixed(2)}` : 'N/A'}`);
      lines.push(`Change (%): ${formData.change_pct !== null && formData.change_pct !== undefined ? `${formData.change_pct.toFixed(2)}%` : 'N/A'}`);
      lines.push(`Year Low: ${formData.year_low !== null && formData.year_low !== undefined ? `$${formData.year_low.toFixed(2)}` : 'N/A'}`);
      lines.push(`Year High: ${formData.year_high !== null && formData.year_high !== undefined ? `$${formData.year_high.toFixed(2)}` : 'N/A'}`);
      lines.push(`Gross Profit Margin (%): ${formData.gross_profit_pct !== null && formData.gross_profit_pct !== undefined ? `${formData.gross_profit_pct.toFixed(2)}%` : 'N/A'}`);
      lines.push(`Long Term Earning Growth (%): ${formData.long_term_earning_growth !== null && formData.long_term_earning_growth !== undefined ? `${formData.long_term_earning_growth.toFixed(2)}%` : 'N/A'}`);
      lines.push(`Return on Invested Capital - ROIC (%): ${formData.roic !== null && formData.roic !== undefined ? `${formData.roic.toFixed(2)}%` : 'N/A'}`);
      lines.push(`Simplywall.st Valuation (%): ${formData.simplywall_valuation !== null && formData.simplywall_valuation !== undefined ? `${formData.simplywall_valuation.toFixed(2)}%` : 'N/A'}`);
      lines.push(`Dividend Per Share: ${formData.dividend_per_share !== null && formData.dividend_per_share !== undefined ? `$${formData.dividend_per_share.toFixed(2)}` : 'N/A'}`);
      lines.push(`Dividend Yield (%): ${dividendYield}%`);
      lines.push(`Shares Outstanding (Now): ${valueDriverClassification?.sharesOutstandingNow !== null && valueDriverClassification?.sharesOutstandingNow !== undefined ? valueDriverClassification.sharesOutstandingNow.toLocaleString() : 'N/A'}`);
      lines.push(`Shares Outstanding (5y ago): ${valueDriverClassification?.sharesOutstanding5yAgo !== null && valueDriverClassification?.sharesOutstanding5yAgo !== undefined ? valueDriverClassification.sharesOutstanding5yAgo.toLocaleString() : 'N/A'}`);
      lines.push(`Share Change (5y): ${valueDriverClassification?.shareChange5yPercent !== null && valueDriverClassification?.shareChange5yPercent !== undefined ? `${valueDriverClassification.shareChange5yPercent.toFixed(2)}%` : 'N/A'}`);
      lines.push(`Active Price: ${formData.active_price !== null && formData.active_price !== undefined ? `$${formData.active_price.toFixed(2)}` : 'N/A'}`);
      
      lines.push('\n--- VALIDATION REQUEST ---');
      lines.push('\nPlease:');
      lines.push('1. Verify that each metric is current and accurate based on the most recent financial data available');
      lines.push('2. Identify any values that appear outdated, incorrect, or inconsistent');
      lines.push('3. Suggest corrections or updates where necessary');
      lines.push('4. Note any missing critical data points that should be included');
      lines.push('5. Provide a summary of the overall data quality and reliability');
      
      const prompt = lines.join('\n');

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setMessage({ type: 'success', text: 'Validation prompt copied to clipboard! Paste into ChatGPT to validate the data.' });
        
        // Reset the clicked state after 3 seconds
        setTimeout(() => {
          setValidateAiClicked(false);
        }, 3000);
      } else {
        setMessage({ type: 'error', text: 'Could not access clipboard. Please copy the prompt manually.' });
        setValidateAiClicked(false);
      }
    } catch (error: any) {
      console.error('Error creating validation prompt:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to create validation prompt.' });
      setValidateAiClicked(false);
    }
  };

  const handleAskAI = async () => {
    if (!formData.stock) {
      setMessage({ type: 'error', text: 'Stock symbol is required' });
      return;
    }

    try {
      setAskAiClicked(true);
      
      // Calculate signals and margins for each valuation
      const ddmSignal = calculateValuationSignal(formData.ddm_price);
      const dcfSignal = calculateValuationSignal(formData.bear_case_low_price);
      const reitSignal = calculateValuationSignal(formData.reit_valuation);
      const avgSignal = calculateValuationSignal(formData.average_valuations);

      // Build the prompt with all Valuation Model Price Predictions data
      const lines: string[] = [];
      lines.push('You are a financial valuation expert. Please review the following valuation model price predictions and recommendations, then explain and validate the logic used.');
      lines.push(`\nStock Symbol: ${formData.stock.toUpperCase()}`);
      lines.push(`Current Price: ${formData.active_price !== null && formData.active_price !== undefined ? `$${formData.active_price.toFixed(2)}` : 'N/A'}`);
      lines.push(`\n--- VALUATION MODEL PRICE PREDICTIONS ---`);
      
      // DDM Prediction Price
      if (formData.ddm_price && formData.ddm_price !== 0) {
        lines.push(`\nDDM (Dividend Discount Model) Prediction Price: $${formData.ddm_price.toFixed(2)}`);
        if (ddmSignal.signal) {
          lines.push(`  - Investment Signal: ${ddmSignal.signal}`);
          if (ddmSignal.marginOfSafety !== null) {
            lines.push(`  - Margin of Safety: ${ddmSignal.marginOfSafety.toFixed(2)}%`);
          }
        }
      }
      
      // DCF Prediction Price
      if (formData.bear_case_low_price !== null && formData.bear_case_low_price !== undefined) {
        lines.push(`\nDCF (Discounted Cash Flow) Prediction Price: $${formData.bear_case_low_price.toFixed(2)}`);
        if (dcfSignal.signal) {
          lines.push(`  - Investment Signal: ${dcfSignal.signal}`);
          if (dcfSignal.marginOfSafety !== null) {
            lines.push(`  - Margin of Safety: ${dcfSignal.marginOfSafety.toFixed(2)}%`);
          }
        }
      }
      
      // REIT Valuation
      if (formData.reit_valuation && formData.reit_valuation !== 0) {
        lines.push(`\nREIT Valuation: $${formData.reit_valuation.toFixed(2)}`);
        if (reitSignal.signal) {
          lines.push(`  - Investment Signal: ${reitSignal.signal}`);
          if (reitSignal.marginOfSafety !== null) {
            lines.push(`  - Margin of Safety: ${reitSignal.marginOfSafety.toFixed(2)}%`);
          }
        }
      }
      
      // Average Valuations
      if (formData.average_valuations !== null && formData.average_valuations !== undefined) {
        lines.push(`\nAverage Valuations: $${formData.average_valuations.toFixed(2)}`);
        if (avgSignal.signal) {
          lines.push(`  - Investment Signal: ${avgSignal.signal}`);
          if (avgSignal.marginOfSafety !== null) {
            lines.push(`  - Margin of Safety: ${avgSignal.marginOfSafety.toFixed(2)}%`);
          }
        }
      }
      
      lines.push(`\nMargin of Safety Setting: ${marginOfSafety}%`);
      
      // Recommended Price Projection Model
      if (valueDriverClassification) {
        lines.push(`\n--- RECOMMENDED PRICE PROJECTION MODEL ---`);
        
        if (valueDriverClassification.hasMissingData) {
          lines.push(`Status: Missing Data`);
          lines.push(`Missing Fields: ${valueDriverClassification.missingDataFields?.join(', ') || 'Required data unavailable'}`);
        } else {
          lines.push(`Primary Value Driver(s): ${valueDriverClassification.driverBuckets.join(', ')}`);
          lines.push(`Recommended Model: ${valueDriverClassification.recommendedModel || 'Unable to determine'}`);
          
          if (valueDriverClassification.explain.length > 0) {
            lines.push(`\nAnalysis:`);
            valueDriverClassification.explain.forEach((line) => {
              lines.push(`  - ${line}`);
            });
          }
          
          // Include supporting data
          if (valueDriverClassification.currentPrice !== null && valueDriverClassification.currentPrice !== undefined) {
            lines.push(`\nSupporting Data:`);
            lines.push(`  - Current Price: $${valueDriverClassification.currentPrice.toFixed(2)}`);
            if (valueDriverClassification.annualDividendPerShare !== null && valueDriverClassification.annualDividendPerShare !== undefined) {
              lines.push(`  - Annual Dividend Per Share: $${valueDriverClassification.annualDividendPerShare.toFixed(4)}`);
            }
            if (valueDriverClassification.dividendYieldPercent !== undefined && isFinite(valueDriverClassification.dividendYieldPercent)) {
              lines.push(`  - Dividend Yield: ${valueDriverClassification.dividendYieldPercent.toFixed(4)}%`);
            }
            if (valueDriverClassification.sharesOutstandingNow !== null && valueDriverClassification.sharesOutstandingNow !== undefined) {
              lines.push(`  - Shares Outstanding (Now): ${valueDriverClassification.sharesOutstandingNow.toLocaleString()}`);
            }
            if (valueDriverClassification.sharesOutstanding5yAgo !== null && valueDriverClassification.sharesOutstanding5yAgo !== undefined) {
              lines.push(`  - Shares Outstanding (5y ago): ${valueDriverClassification.sharesOutstanding5yAgo.toLocaleString()}`);
            }
            if (valueDriverClassification.shareChange5yPercent !== null && valueDriverClassification.shareChange5yPercent !== undefined) {
              lines.push(`  - Share Change (5y): ${valueDriverClassification.shareChange5yPercent.toFixed(2)}%`);
            }
          }
        }
      }
      
      lines.push(`\n--- VALIDATION REQUEST ---`);
      lines.push('\nPlease:');
      lines.push('1. Explain the logic and methodology behind each valuation model (DDM, DCF, REIT)');
      lines.push('2. Validate whether the recommended price projection model is appropriate given the stock\'s characteristics');
      lines.push('3. Assess the reasonableness of each price prediction relative to the current price');
      lines.push('4. Evaluate the margin of safety calculations and investment signals (BUY/HOLD)');
      lines.push('5. Identify any inconsistencies, potential errors, or areas where the logic could be improved');
      lines.push('6. Provide recommendations on which valuation model(s) should be given the most weight and why');
      lines.push('7. Comment on the overall investment thesis based on these valuations');
      
      const prompt = lines.join('\n');

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setMessage({ type: 'success', text: 'Valuation analysis prompt copied to clipboard! Paste into ChatGPT to explain and validate the logic.' });
        
        // Reset the clicked state after 3 seconds
        setTimeout(() => {
          setAskAiClicked(false);
        }, 3000);
      } else {
        setMessage({ type: 'error', text: 'Could not access clipboard. Please copy the prompt manually.' });
        setAskAiClicked(false);
      }
    } catch (error: any) {
      console.error('Error creating valuation analysis prompt:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to create valuation analysis prompt.' });
      setAskAiClicked(false);
    }
  };

  const handleAskDcfAI = async () => {
    if (!formData.stock) {
      setMessage({ type: 'error', text: 'Stock symbol is required' });
      return;
    }

    try {
      setAskDcfAiClicked(true);
      
      // Build the prompt with all DCF Projections data
      const lines: string[] = [];
      lines.push('You are a financial valuation expert specializing in Discounted Cash Flow (DCF) analysis. Please review the following DCF projections and validate whether the predictions seem correct.');
      lines.push(`\nStock Symbol: ${formData.stock.toUpperCase()}`);
      lines.push(`Current Price: ${formData.active_price !== null && formData.active_price !== undefined ? `$${formData.active_price.toFixed(2)}` : 'N/A'}`);
      lines.push(`\n--- DCF PROJECTIONS ---`);
      
      // Low Price Targets
      if (formData.bear_case_low_price || formData.base_case_low_price || formData.bull_case_low_price) {
        lines.push(`\nLow Price Targets:`);
        if (formData.bear_case_low_price !== null && formData.bear_case_low_price !== undefined) {
          lines.push(`  - Bear Case Low: $${formData.bear_case_low_price.toFixed(2)}`);
        }
        if (formData.base_case_low_price !== null && formData.base_case_low_price !== undefined) {
          lines.push(`  - Base Case Low: $${formData.base_case_low_price.toFixed(2)}`);
        }
        if (formData.bull_case_low_price !== null && formData.bull_case_low_price !== undefined) {
          lines.push(`  - Bull Case Low: $${formData.bull_case_low_price.toFixed(2)}`);
        }
        // Investment Signal
        if (formData.active_price && formData.bear_case_low_price) {
          const signal = formData.active_price <= formData.bear_case_low_price ? 'BUY' : 'HOLD';
          lines.push(`  - Investment Signal: ${signal}`);
        }
      }
      
      // Bear Case
      if (formData.bear_case_avg_price || formData.bear_case_low_price || formData.bear_case_high_price) {
        lines.push(`\nBear Case Scenario:`);
        if (formData.bear_case_avg_price !== null && formData.bear_case_avg_price !== undefined) {
          lines.push(`  - Average Price: $${formData.bear_case_avg_price.toFixed(2)}`);
        }
        if (formData.bear_case_low_price !== null && formData.bear_case_low_price !== undefined) {
          lines.push(`  - Low Price: $${formData.bear_case_low_price.toFixed(2)}`);
        }
        if (formData.bear_case_high_price !== null && formData.bear_case_high_price !== undefined) {
          lines.push(`  - High Price: $${formData.bear_case_high_price.toFixed(2)}`);
        }
      }
      
      // Base Case
      if (formData.base_case_avg_price || formData.base_case_low_price || formData.base_case_high_price) {
        lines.push(`\nBase Case Scenario:`);
        if (formData.base_case_avg_price !== null && formData.base_case_avg_price !== undefined) {
          lines.push(`  - Average Price: $${formData.base_case_avg_price.toFixed(2)}`);
        }
        if (formData.base_case_low_price !== null && formData.base_case_low_price !== undefined) {
          lines.push(`  - Low Price: $${formData.base_case_low_price.toFixed(2)}`);
        }
        if (formData.base_case_high_price !== null && formData.base_case_high_price !== undefined) {
          lines.push(`  - High Price: $${formData.base_case_high_price.toFixed(2)}`);
        }
      }
      
      // Bull Case
      if (formData.bull_case_avg_price || formData.bull_case_low_price || formData.bull_case_high_price) {
        lines.push(`\nBull Case Scenario:`);
        if (formData.bull_case_avg_price !== null && formData.bull_case_avg_price !== undefined) {
          lines.push(`  - Average Price: $${formData.bull_case_avg_price.toFixed(2)}`);
        }
        if (formData.bull_case_low_price !== null && formData.bull_case_low_price !== undefined) {
          lines.push(`  - Low Price: $${formData.bull_case_low_price.toFixed(2)}`);
        }
        if (formData.bull_case_high_price !== null && formData.bull_case_high_price !== undefined) {
          lines.push(`  - High Price: $${formData.bull_case_high_price.toFixed(2)}`);
        }
      }
      
      lines.push(`\n--- VALIDATION REQUEST ---`);
      lines.push('\nPlease:');
      lines.push('1. Review the DCF projections across all three scenarios (Bear, Base, Bull)');
      lines.push('2. Validate whether the price ranges (low, average, high) are reasonable and internally consistent');
      lines.push('3. Assess if the scenarios are properly differentiated (Bear < Base < Bull)');
      lines.push('4. Evaluate whether the investment signal (BUY/HOLD) based on Bear Case Low is appropriate');
      lines.push('5. Check if the projections align with typical DCF methodology and assumptions');
      lines.push('6. Identify any potential errors, inconsistencies, or areas where the logic could be improved');
      lines.push('7. Provide recommendations on the reasonableness of these DCF projections');
      
      const prompt = lines.join('\n');

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setMessage({ type: 'success', text: 'DCF validation prompt copied to clipboard! Paste into ChatGPT to check if the predictions seem correct.' });
        
        // Reset the clicked state after 3 seconds
        setTimeout(() => {
          setAskDcfAiClicked(false);
        }, 3000);
      } else {
        setMessage({ type: 'error', text: 'Could not access clipboard. Please copy the prompt manually.' });
        setAskDcfAiClicked(false);
      }
    } catch (error: any) {
      console.error('Error creating DCF validation prompt:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to create DCF validation prompt.' });
      setAskDcfAiClicked(false);
    }
  };

  const handleClearDcfProjections = async () => {
    if (!stockValuationId) {
      setMessage({ type: 'error', text: 'No stock valuation selected. Please save the stock first.' });
      return;
    }

    if (!confirm('Are you sure you want to clear all DCF projection data? This will only clear the DCF fields, not other stock data.')) {
      return;
    }

    setClearingDcfProjections(true);
    setMessage(null);

    try {
      // Prepare data with only DCF fields set to null
      const dcfFieldsToClear = {
        bear_case_avg_price: null,
        bear_case_low_price: null,
        bear_case_high_price: null,
        base_case_avg_price: null,
        base_case_low_price: null,
        base_case_high_price: null,
        bull_case_avg_price: null,
        bull_case_low_price: null,
        bull_case_high_price: null,
      };

      const response = await fetch(`/api/stock-valuations?id=${stockValuationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ...dcfFieldsToClear,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to clear DCF projections' });
        return;
      }

      // Update formData to clear DCF fields
      setFormData(prev => ({
        ...prev,
        ...dcfFieldsToClear,
      }));

      setMessage({ type: 'success', text: 'DCF projections cleared successfully!' });
    } catch (error: any) {
      console.error('Error clearing DCF projections:', error);
      setMessage({ 
        type: 'error', 
        text: `Error clearing DCF projections: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setClearingDcfProjections(false);
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

  const handleSaveStockDetails = async () => {
    if (!formData.stock) {
      setMessage({ type: 'error', text: 'Stock symbol is required' });
      return;
    }

    if (!stockValuationId) {
      setMessage({ type: 'error', text: 'Please save the stock first using the main Save button at the bottom of the page.' });
      return;
    }

    setSavingStockDetails(true);
    setMessage(null);

    try {
      // Prepare data with only Stock Details fields
      // These are the fields in the Stock Details section:
      // - pe, eps, change_pct, year_low, year_high, gross_profit_pct, 
      //   long_term_earning_growth, roic, simplywall_valuation, dividend_per_share,
      //   market_cap, enterprise_value, free_cash_flow
      // Also include active_price as it's part of the Stock Details conceptually
      const stockDetailsData: Partial<StockValuation> = {
        stock: formData.stock,
        active_price: formData.active_price ?? null,
        pe: formData.pe ?? null,
        eps: formData.eps ?? null,
        change_pct: formData.change_pct ?? null,
        year_low: formData.year_low ?? null,
        year_high: formData.year_high ?? null,
        gross_profit_pct: formData.gross_profit_pct ?? null,
        long_term_earning_growth: formData.long_term_earning_growth ?? null,
        roic: formData.roic ?? null,
        simplywall_valuation: formData.simplywall_valuation ?? null,
        dividend_per_share: formData.dividend_per_share ?? null,
        market_cap: formData.market_cap ?? null,
        enterprise_value: formData.enterprise_value ?? null,
        free_cash_flow: formData.free_cash_flow ?? null,
      };

      // Debug: Log what we're sending
      console.log('[Save Stock Details] Sending data:', {
        market_cap: stockDetailsData.market_cap,
        enterprise_value: stockDetailsData.enterprise_value,
        free_cash_flow: stockDetailsData.free_cash_flow,
        formData_market_cap: formData.market_cap,
      });

      const response = await fetch(`/api/stock-valuations?id=${stockValuationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ...stockDetailsData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to save stock details' 
        });
        return;
      }

      setMessage({ 
        type: 'success', 
        text: 'Stock details saved successfully!' 
      });
    } catch (error: any) {
      console.error('Error saving stock details:', error);
      setMessage({ 
        type: 'error', 
        text: `Error saving stock details: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setSavingStockDetails(false);
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
        market_cap: null,
        enterprise_value: null,
        free_cash_flow: null,
      });
      setStockValuationId(null);
      setSelectedStockId('');
      setLinks([]);
      setNewLink('');
      setValueDriverClassification(null);
      
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
                setValueDriverClassification(null);
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

          {/* AI Theory Prompt Buttons Row */}
          <div className="mt-4 flex flex-col md:flex-row gap-2 md:max-w-2xl">
            <button
              type="button"
              disabled={!formData.stock || bearTheoryLoading}
              onClick={async () => {
                if (!formData.stock) {
                  setMessage({ type: 'error', text: 'Please enter a stock symbol first.' });
                  return;
                }
                try {
                  setBearTheoryLoading(true);
                  const symbol = formData.stock.toUpperCase();
                  const lines: string[] = [];
                  lines.push(
                    'You are a fundamentals-focused equity analyst. Build a detailed BEAR CASE thesis for this stock.'
                  );
                  lines.push(`\nStock symbol: ${symbol}`);
                  lines.push(
                    '\nYour tasks:',
                    '1. Summarise the most important bear-case arguments and structural risks for this business today (competitive threats, balance sheet, margins, growth, management, regulation, etc.).',
                    '2. Explain why a cautious investor might decide this stock is NOT worth buying at the current price, focusing on downside scenarios.',
                    '3. Highlight key red flags in valuation, fundamentals, or macro environment that make the risk/reward unattractive.',
                    '4. Suggest what would need to change (price, fundamentals, catalysts) before the bear case weakens and the stock might become interesting again.'
                  );
                  const prompt = lines.join('\n');

                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(prompt);
                    setMessage({ type: 'success', text: 'Bear case theory prompt copied. Paste into ChatGPT.' });
                  } else {
                    setMessage({ type: 'error', text: 'Could not access clipboard. Please copy the prompt manually.' });
                  }
                } catch (error: any) {
                  console.error('Error creating bear case theory prompt:', error);
                  setMessage({ type: 'error', text: error?.message || 'Failed to create bear case theory prompt.' });
                } finally {
                  setBearTheoryLoading(false);
                }
              }}
              className="w-full md:flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-xs font-medium transition-colors text-center"
            >
              {bearTheoryLoading ? 'Bear Theory...' : 'Bear Case Theory Prompt'}
            </button>

            <button
              type="button"
              disabled={!formData.stock || baseTheoryLoading}
              onClick={async () => {
                if (!formData.stock) {
                  setMessage({ type: 'error', text: 'Please enter a stock symbol first.' });
                  return;
                }
                try {
                  setBaseTheoryLoading(true);
                  const symbol = formData.stock.toUpperCase();
                  const lines: string[] = [];
                  lines.push(
                    'You are a fundamentals-focused equity analyst. Build a balanced BASE CASE thesis for this stock.'
                  );
                  lines.push(`\nStock symbol: ${symbol}`);
                  lines.push(
                    '\nYour tasks:',
                    '1. Summarise the key drivers of the business (revenue, margins, growth, capital allocation) under a realistic, base-case scenario.',
                    '2. Outline both the main opportunities and the main risks, and how they roughly balance out for a long-term investor.',
                    '3. Comment on whether the current valuation looks roughly fair, modestly cheap, or modestly expensive in this base case, and why.',
                    '4. Suggest what key metrics or catalysts you would monitor to see if the story is tracking this base case or drifting toward bear/bull outcomes.'
                  );
                  const prompt = lines.join('\n');

                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(prompt);
                    setMessage({ type: 'success', text: 'Base case theory prompt copied. Paste into ChatGPT.' });
                  } else {
                    setMessage({ type: 'error', text: 'Could not access clipboard. Please copy the prompt manually.' });
                  }
                } catch (error: any) {
                  console.error('Error creating base case theory prompt:', error);
                  setMessage({ type: 'error', text: error?.message || 'Failed to create base case theory prompt.' });
                } finally {
                  setBaseTheoryLoading(false);
                }
              }}
              className="w-full md:flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-xs font-medium transition-colors text-center"
            >
              {baseTheoryLoading ? 'Base Theory...' : 'Base Case Theory Prompt'}
            </button>

            <button
              type="button"
              disabled={!formData.stock || bullTheoryLoading}
              onClick={async () => {
                if (!formData.stock) {
                  setMessage({ type: 'error', text: 'Please enter a stock symbol first.' });
                  return;
                }
                try {
                  setBullTheoryLoading(true);
                  const symbol = formData.stock.toUpperCase();
                  const lines: string[] = [];
                  lines.push(
                    'You are a fundamentals-focused equity analyst. Build an optimistic but realistic BULL CASE thesis for this stock.'
                  );
                  lines.push(`\nStock symbol: ${symbol}`);
                  lines.push(
                    '\nYour tasks:',
                    '1. Describe the upside scenario: how revenue, margins, growth, and capital allocation could play out if things go well over the next 3–5+ years.',
                    '2. Explain what catalysts (product wins, market share gains, industry tailwinds, cost improvements, etc.) would need to happen for this bull case to materialise.',
                    '3. Assess whether the current valuation already prices in this bull case, partially prices it in, or still underestimates it.',
                    '4. Highlight the main risks to the bull thesis — what could derail it — so an investor understands both upside and downside in this optimistic view.'
                  );
                  const prompt = lines.join('\n');

                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(prompt);
                    setMessage({ type: 'success', text: 'Bull case theory prompt copied. Paste into ChatGPT.' });
                  } else {
                    setMessage({ type: 'error', text: 'Could not access clipboard. Please copy the prompt manually.' });
                  }
                } catch (error: any) {
                  console.error('Error creating bull case theory prompt:', error);
                  setMessage({ type: 'error', text: error?.message || 'Failed to create bull case theory prompt.' });
                } finally {
                  setBullTheoryLoading(false);
                }
              }}
              className="w-full md:flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-xs font-medium transition-colors text-center"
            >
              {bullTheoryLoading ? 'Bull Theory...' : 'Bull Case Theory Prompt'}
            </button>
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpdateFromLive}
                disabled={saving || !formData.stock}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {saving ? 'Updating...' : '🔄 Refresh'}
              </button>
              <button
                onClick={handleSaveStockDetails}
                disabled={savingStockDetails || !formData.stock || !stockValuationId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {savingStockDetails ? 'Saving...' : '💾 Save'}
              </button>
              <button
                onClick={handleValidateWithAI}
                disabled={!formData.stock || validateAiClicked}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  validateAiClicked
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                }`}
              >
                {validateAiClicked ? '✓ Copied!' : '🤖 Validate With AI'}
              </button>
            </div>
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

              {/* Dividend Yield */}
              <div>
                <label htmlFor="dividend_yield" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dividend Yield (%)
                </label>
                <input
                  type="text"
                  id="dividend_yield"
                  readOnly
                  value={(() => {
                    if (formData.dividend_per_share && formData.active_price && formData.active_price > 0) {
                      const yieldValue = (formData.dividend_per_share / formData.active_price) * 100;
                      return yieldValue.toFixed(2);
                    }
                    return '';
                  })()}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Market Cap, Enterprise Value, Free Cash Flow Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Market Cap */}
              <div>
                <label htmlFor="market_cap" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Market Cap ($)
                </label>
                <input
                  type="number"
                  id="market_cap"
                  step="0.01"
                  value={formData.market_cap ?? ''}
                  onChange={(e) => handleInputChange('market_cap', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Enterprise Value */}
              <div>
                <label htmlFor="enterprise_value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enterprise Value ($)
                </label>
                <input
                  type="number"
                  id="enterprise_value"
                  step="0.01"
                  value={formData.enterprise_value ?? ''}
                  onChange={(e) => handleInputChange('enterprise_value', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Free Cash Flow */}
              <div>
                <label htmlFor="free_cash_flow" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Free Cash Flow ($)
                </label>
                <input
                  type="number"
                  id="free_cash_flow"
                  step="0.01"
                  value={formData.free_cash_flow ?? ''}
                  onChange={(e) => handleInputChange('free_cash_flow', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Shares Outstanding Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Shares Outstanding (Now) */}
              <div>
                <label htmlFor="shares_outstanding_now" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shares Outstanding (Now)
                </label>
                <input
                  type="text"
                  id="shares_outstanding_now"
                  value={valueDriverClassification?.sharesOutstandingNow !== null && valueDriverClassification?.sharesOutstandingNow !== undefined ? valueDriverClassification.sharesOutstandingNow.toLocaleString() : ''}
                  readOnly
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Shares Outstanding (5y ago) */}
              <div>
                <label htmlFor="shares_outstanding_5y" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shares Outstanding (5y ago)
                </label>
                <input
                  type="text"
                  id="shares_outstanding_5y"
                  value={valueDriverClassification?.sharesOutstanding5yAgo !== null && valueDriverClassification?.sharesOutstanding5yAgo !== undefined ? valueDriverClassification.sharesOutstanding5yAgo.toLocaleString() : ''}
                  readOnly
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Share Change (5y) */}
              <div>
                <label htmlFor="share_change_5y" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Share Change (5y)
                </label>
                <input
                  type="text"
                  id="share_change_5y"
                  readOnly
                  value={valueDriverClassification?.shareChange5yPercent !== null && valueDriverClassification?.shareChange5yPercent !== undefined ? `${valueDriverClassification.shareChange5yPercent.toFixed(2)}%` : ''}
                  placeholder="0.00%"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

        </div>
        )}

        {/* Valuation Section */}
        {showSections && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Valuation Model Price Predictions
              </h2>
              <button
                onClick={handleAskAI}
                disabled={!formData.stock || askAiClicked}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  askAiClicked
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                }`}
              >
                {askAiClicked ? '✓ Copied!' : '🤖 Ask AI'}
              </button>
            </div>
            <div className={`grid grid-cols-1 gap-6 ${
              (formData.ddm_price && formData.ddm_price !== 0) && (formData.reit_valuation && formData.reit_valuation !== 0) 
                ? 'md:grid-cols-4' 
                : (formData.ddm_price && formData.ddm_price !== 0) || (formData.reit_valuation && formData.reit_valuation !== 0)
                  ? 'md:grid-cols-3'
                  : 'md:grid-cols-2'
            }`}>
              {/* DDM Price - Only show if set */}
              {formData.ddm_price && formData.ddm_price !== 0 && (
                <div>
                  <label htmlFor="ddm_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    DDM Prediction Price
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
                  {(() => {
                    const signal = calculateValuationSignal(formData.ddm_price);
                    return signal.signal ? (
                      <div className="mt-2">
                        <div className={`text-xs font-semibold ${signal.signal === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {signal.signal}
                        </div>
                        {signal.marginOfSafety !== null && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Margin: {signal.marginOfSafety.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* DCF Prediction Price - Read-only, displays Bear Case Low */}
              <div>
                <label htmlFor="dcf_prediction_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  DCF Prediction Price
                </label>
                <input
                  type="number"
                  id="dcf_prediction_price"
                  step="0.01"
                  value={formData.bear_case_low_price !== null && formData.bear_case_low_price !== undefined ? formData.bear_case_low_price.toFixed(2) : ''}
                  readOnly
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
                {(() => {
                  const signal = calculateValuationSignal(formData.bear_case_low_price);
                  return signal.signal ? (
                    <div className="mt-2">
                      <div className={`text-xs font-semibold ${signal.signal === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {signal.signal}
                      </div>
                      {signal.marginOfSafety !== null && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Margin: {signal.marginOfSafety.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* REIT Valuation - Only show if not 0.00 */}
              {formData.reit_valuation && formData.reit_valuation !== 0 && (
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
                  {(() => {
                    const signal = calculateValuationSignal(formData.reit_valuation);
                    return signal.signal ? (
                      <div className="mt-2">
                        <div className={`text-xs font-semibold ${signal.signal === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {signal.signal}
                        </div>
                        {signal.marginOfSafety !== null && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Margin: {signal.marginOfSafety.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Average Valuations */}
              <div>
                <label htmlFor="average_valuations" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Average Valuations
                </label>
                <input
                  type="number"
                  id="average_valuations"
                  step="0.01"
                  value={formData.average_valuations !== null && formData.average_valuations !== undefined ? formData.average_valuations.toFixed(2) : ''}
                  readOnly
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                />
                {(() => {
                  const signal = calculateValuationSignal(formData.average_valuations);
                  return signal.signal ? (
                    <div className="mt-2">
                      <div className={`text-xs font-semibold ${signal.signal === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {signal.signal}
                      </div>
                      {signal.marginOfSafety !== null && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Margin: {signal.marginOfSafety.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Margin of Safety Row */}
            <div className="mt-6">
              <div className="max-w-xs">
                <label htmlFor="margin_of_safety" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Margin of Safety (%)
                </label>
                <input
                  type="number"
                  id="margin_of_safety"
                  step="0.01"
                  min="0"
                  max="100"
                  value={marginOfSafety}
                  onChange={(e) => setMarginOfSafety(parseFloat(e.target.value) || 20)}
                  placeholder="20.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Price Projection Model Recommendation */}
            {formData.stock && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recommended Price Projection Model To Use
                </h3>
                {valueDriverLoading ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Loading recommendation...
                  </div>
                ) : valueDriverClassification ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column (50%): Primary value driver and recommendation */}
                    <div className="space-y-4">
                      {/* Primary value driver checkboxes - only show if we have enough data */}
                      {!valueDriverClassification.hasMissingData && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Primary value driver appears to be:
                          </p>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={valueDriverClassification.driverBuckets.includes('Dividends')}
                                readOnly
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Dividends</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={valueDriverClassification.driverBuckets.includes('Buybacks')}
                                readOnly
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Buybacks</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={valueDriverClassification.driverBuckets.includes('Reinvestment growth')}
                                readOnly
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Reinvestment growth</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Model recommendation */}
                      <div>
                        {valueDriverClassification.hasMissingData ? (
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                              Missing data: {valueDriverClassification.missingDataFields?.join(', ') || 'Required data unavailable'}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                              {valueDriverClassification.recommendedModel ? (
                                <>→ {valueDriverClassification.recommendedModel}</>
                              ) : (
                                <>→ Unable to determine</>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column (50%): Analysis and Debug Details */}
                    <div className="space-y-4">
                      {/* Explanation - only show if we have enough data */}
                      {!valueDriverClassification.hasMissingData && valueDriverClassification.explain.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Analysis:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {valueDriverClassification.explain.map((line, index) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Debug Details */}
                      <div>
                        <button
                          onClick={() => setShowDebugDetails(!showDebugDetails)}
                          className="flex items-center gap-2 text-xs font-semibold text-white mb-2 hover:text-gray-300 transition-colors"
                        >
                          {showDebugDetails ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              Debug Details:
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Debug Details:
                            </>
                          )}
                        </button>
                        {showDebugDetails && valueDriverClassification && (
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded text-xs space-y-1 font-mono text-white">
                            <div>
                              Current Price:{' '}
                              {valueDriverClassification.currentPrice !== null && valueDriverClassification.currentPrice !== undefined
                                ? `$${valueDriverClassification.currentPrice.toFixed(2)}`
                                : 'N/A'}
                            </div>
                            <div>
                              Annual Dividend/Share:{' '}
                              {valueDriverClassification.annualDividendPerShare !== null &&
                              valueDriverClassification.annualDividendPerShare !== undefined
                                ? `$${valueDriverClassification.annualDividendPerShare.toFixed(4)}`
                                : 'N/A'}
                            </div>
                            <div>
                              Dividend Yield:{' '}
                              {valueDriverClassification.dividendYieldPercent !== undefined &&
                              isFinite(valueDriverClassification.dividendYieldPercent)
                                ? `${valueDriverClassification.dividendYieldPercent.toFixed(4)}%`
                                : '0.00%'}
                            </div>
                            <div>
                              Shares Outstanding (Now):{' '}
                              {valueDriverClassification.sharesOutstandingNow !== null &&
                              valueDriverClassification.sharesOutstandingNow !== undefined
                                ? valueDriverClassification.sharesOutstandingNow.toLocaleString()
                                : 'N/A'}
                            </div>
                            <div>
                              Shares Outstanding (5y ago):{' '}
                              {valueDriverClassification.sharesOutstanding5yAgo !== null &&
                              valueDriverClassification.sharesOutstanding5yAgo !== undefined
                                ? valueDriverClassification.sharesOutstanding5yAgo.toLocaleString()
                                : 'N/A'}
                            </div>
                            <div>
                              Share Change (5y):{' '}
                              {valueDriverClassification.shareChange5yPercent !== null &&
                              valueDriverClassification.shareChange5yPercent !== undefined
                                ? `${valueDriverClassification.shareChange5yPercent.toFixed(2)}%`
                                : 'N/A'}
                            </div>
                            {valueDriverClassification.debug && (
                              <>
                                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                                  <div>Low Yield Threshold: {valueDriverClassification.debug.lowYieldThreshold}%</div>
                                  <div>Buyback Heavy Threshold: {valueDriverClassification.debug.buybackHeavyThreshold}%</div>
                                  <div>Yield Below Threshold: {valueDriverClassification.debug.dividendYieldBelowThreshold ? 'Yes' : 'No'}</div>
                                  <div>Share Change Available: {valueDriverClassification.debug.shareChangeAvailable ? 'Yes' : 'No'}</div>
                                  <div>Share Change Below Buyback Threshold: {valueDriverClassification.debug.shareChangeBelowBuybackThreshold ? 'Yes' : 'No'}</div>
                                  <div>Classification Path: {valueDriverClassification.debug.classificationPath}</div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Unable to load recommendation. Please ensure API keys are configured.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DCF Summary */}
        {showSections && formData.stock && (matchingDcfEntries.length > 0 || formData.bear_case_low_price || formData.base_case_low_price || formData.bull_case_low_price) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl mt-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">DCF Projections</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAskDcfAI}
                  disabled={!formData.stock || askDcfAiClicked}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    askDcfAiClicked
                      ? 'bg-green-600 text-white cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                  }`}
                >
                  {askDcfAiClicked ? '✓ Copied!' : '🤖 Ask AI'}
                </button>
                <button
                  onClick={handleClearDcfProjections}
                  disabled={!stockValuationId || clearingDcfProjections}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                >
                  {clearingDcfProjections ? 'Clearing...' : '🗑️ Clear Projections'}
                </button>
              </div>
            </div>
            
            {/* Low Prices Row */}
            {(formData.bear_case_low_price || formData.base_case_low_price || formData.bull_case_low_price) && (
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 rounded-lg p-6 mb-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-600 mb-4 text-lg text-center">Low Price Targets</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bear Case Low</div>
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(formData.bear_case_low_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Base Case Low</div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(formData.base_case_low_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Bull Case Low</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(formData.bull_case_low_price)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Investment Signal</div>
                    <div className={`text-2xl font-bold ${
                      formData.active_price && formData.bear_case_low_price && 
                      formData.active_price <= formData.bear_case_low_price ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formData.active_price && formData.bear_case_low_price && 
                       formData.active_price <= formData.bear_case_low_price ? 'BUY' : 'HOLD'}
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

            {/* Open DCF Page Button */}
            <div className="flex justify-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Link
                href={
                  matchingDcfEntries.length > 0
                    ? `/dcf?id=${matchingDcfEntries[0].id}`
                    : `/dcf?symbol=${formData.stock}`
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                View DCF Projections
              </Link>
            </div>
          </div>
        )}

        {/* DDM Projections Section */}
        {showSections && formData.stock && ddmData && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl mt-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white text-center">DDM Projections</h2>
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
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">DDM Forecast</h3>
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
                
                // Find last earnings (most recent past date)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const pastEarnings = allEarnings.filter((e: any) => {
                  const earningsDate = new Date(e.date);
                  earningsDate.setHours(0, 0, 0, 0);
                  return earningsDate < today;
                });
                const lastEarnings = pastEarnings.length > 0 
                  ? pastEarnings.reduce((latest: any, current: any) => {
                      const latestDate = new Date(latest.date);
                      const currentDate = new Date(current.date);
                      return currentDate > latestDate ? current : latest;
                    })
                  : null;
                
                return (
                  <div className="space-y-4">
                    {/* Last Earnings */}
                    {lastEarnings && (
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Last Earnings</h3>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Date: </span>
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400 ml-1">
                              {new Date(lastEarnings.date).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>
                          {lastEarnings.quarter && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Quarter: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                {lastEarnings.quarter} {lastEarnings.year}
                              </span>
                            </div>
                          )}
                          {lastEarnings.actualEps !== null && lastEarnings.actualEps !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Actual EPS: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${lastEarnings.actualEps.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {lastEarnings.estimatedEps !== null && lastEarnings.estimatedEps !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated EPS: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${lastEarnings.estimatedEps.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {lastEarnings.actualRevenue !== null && lastEarnings.actualRevenue !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Actual Revenue: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${(lastEarnings.actualRevenue / 1000000).toFixed(2)}M
                              </span>
                            </div>
                          )}
                          {lastEarnings.estimatedRevenue !== null && lastEarnings.estimatedRevenue !== undefined && (
                            <div className="flex items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Revenue: </span>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                                ${(lastEarnings.estimatedRevenue / 1000000).toFixed(2)}M
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
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
                                {earnings.actualEps !== null && earnings.actualEps !== undefined && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Actual EPS: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${earnings.actualEps.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {earnings.estimatedEps !== null && earnings.estimatedEps !== undefined && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Estimated EPS: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${earnings.estimatedEps.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {earnings.actualRevenue !== null && earnings.actualRevenue !== undefined && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Actual Revenue: </span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      ${(earnings.actualRevenue / 1000000).toFixed(2)}M
                                    </span>
                                  </div>
                                )}
                                {earnings.estimatedRevenue !== null && earnings.estimatedRevenue !== undefined && (
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
