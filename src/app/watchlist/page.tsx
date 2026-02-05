'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
      const [financialsRes, peRatiosRes, earningsGrowthRes, fmpRes] = await Promise.allSettled([
        fetch(`/api/financials?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/pe-ratios?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/earnings-growth?symbol=${formData.stock.toUpperCase()}`),
        fetch(`/api/fmp?symbol=${formData.stock.toUpperCase()}`)
      ]);

      let updatedFields: Partial<StockValuation> = {};

      // Process Financials data for Gross Profit (%)
      if (financialsRes.status === 'fulfilled' && financialsRes.value.ok) {
        const financials = await financialsRes.value.json();
        if (financials.grossProfitMargin !== null && financials.grossProfitMargin !== undefined) {
          // Convert decimal to percentage and round to 2 decimal places (e.g., 0.8910 -> 89.10)
          updatedFields.gross_profit_pct = Math.round((financials.grossProfitMargin * 100) * 100) / 100;
        }
      }

      // Process PE Ratios data for Dividend Per Share, PE, Change %, Year High, Year Low
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

      // Process FMP data for Year High, Year Low, and Change (%) - use as fallback if not from pe-ratios
      if (fmpRes.status === 'fulfilled' && fmpRes.value.ok) {
        const fmp = await fmpRes.value.json();
        // Only use FMP values if not already set from pe-ratios
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Company Data
        </h1>

        {/* Dropdown Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            <label htmlFor="stock-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Stock:
            </label>
            <select
              id="stock-select"
              value={selectedStockId}
              onChange={(e) => handleStockSelect(e.target.value)}
              disabled={loadingList || loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Select a stock --</option>
              {stockList.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.stock} - {new Date(entry.created_at).toLocaleDateString()}
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
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              New
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {saving ? 'Updating...' : '🔄 Update From Live'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            {/* Change %} */}
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
      </div>
    </div>
  );
}
