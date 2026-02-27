'use client';

import { useEffect, useState } from 'react';
import { getDCFData, DCFData, hasDCFData, storeDCFData } from '../utils/dcfData';
import Decimal from 'decimal.js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface DCFProjections {
  revenue: { bear: number[]; base: number[]; bull: number[] };
  netIncome: { bear: number[]; base: number[]; bull: number[] };
  eps: { bear: number[]; base: number[]; bull: number[] };
  sharePriceLow: { bear: number[]; base: number[]; bull: number[] };
  sharePriceHigh: { bear: number[]; base: number[]; bull: number[] };
  cagrLow: { bear: number; base: number; bull: number };
  cagrHigh: { bear: number; base: number; bull: number };
}

export default function DCFCalculator() {
  const [dcfData, setDcfData] = useState<DCFData | null>(null);
  const [projections, setProjections] = useState<DCFProjections | null>(null);
  const [formData, setFormData] = useState({
    revenueGrowth: { bear: 0, base: 0, bull: 0 },
    netIncomeGrowth: { bear: 0, base: 0, bull: 0 },
    peLow: { bear: 0, base: 0, bull: 0 },
    peHigh: { bear: 0, base: 0, bull: 0 },
    stockPrice: 0
  });
  const [dbSymbol, setDbSymbol] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbMessage, setDbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dcfDbId, setDcfDbId] = useState<string | null>(null);
  const [dcfList, setDcfList] = useState<Array<{ id: string; symbol: string; stock_price: number; revenue: number; created_at: string }>>([]);
  const [selectedDcfId, setSelectedDcfId] = useState<string>('');
  const [loadingList, setLoadingList] = useState(false);
  const [savingToWatchlist, setSavingToWatchlist] = useState(false);
  const [matchingDcfEntries, setMatchingDcfEntries] = useState<Array<{ id: string; symbol: string; stock_price: number; revenue: number; created_at: string }>>([]);
  const [loadingMatchingEntries, setLoadingMatchingEntries] = useState(false);
  const [bearPromptLoading, setBearPromptLoading] = useState(false);
  const [basePromptLoading, setBasePromptLoading] = useState(false);
  const [bullPromptLoading, setBullPromptLoading] = useState(false);
  const [bearCopyLoading, setBearCopyLoading] = useState(false);
  const [baseCopyLoading, setBaseCopyLoading] = useState(false);
  const [bullCopyLoading, setBullCopyLoading] = useState(false);
  const [bearCopyCopied, setBearCopyCopied] = useState(false);
  const [baseCopyCopied, setBaseCopyCopied] = useState(false);
  const [bullCopyCopied, setBullCopyCopied] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    loadDcfList();
    loadData();
    
    // Check for id parameter in URL
    const idParam = searchParams.get('id');
    if (idParam) {
      // Scroll to top when loading from URL parameter
      window.scrollTo(0, 0);
      handleDcfSelect(idParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Load matching DCF entries when symbol changes
  useEffect(() => {
    if (dcfData?.symbol) {
      loadMatchingDcfEntries(dcfData.symbol);
    } else {
      setMatchingDcfEntries([]);
    }
  }, [dcfData?.symbol, dcfDbId]);

  // If DCF data exists in local storage and there is a matching DB entry, auto-load that entry
  useEffect(() => {
    // Don't override an explicit selection from URL or user
    if (!dcfData?.symbol || dcfList.length === 0 || selectedDcfId) return;

    const upperSymbol = dcfData.symbol.toUpperCase();
    const matchingEntry = dcfList.find(
      (entry) => entry.symbol && entry.symbol.toUpperCase() === upperSymbol
    );

    if (matchingEntry) {
      handleDcfSelect(matchingEntry.id);
    }
  }, [dcfData?.symbol, dcfList, selectedDcfId]);

  const loadMatchingDcfEntries = async (symbol: string) => {
    if (!symbol) return;
    
    setLoadingMatchingEntries(true);
    try {
      const response = await fetch(`/api/dcf/list?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
      const result = await response.json();
      
      if (response.ok && result.data) {
        // Filter out the current entry if we have a dcfDbId
        const filtered = dcfDbId 
          ? result.data.filter((entry: { id: string }) => entry.id !== dcfDbId)
          : result.data;
        setMatchingDcfEntries(filtered);
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

  const loadDcfList = async () => {
    setLoadingList(true);
    setDbMessage(null);
    try {
      const response = await fetch('/api/dcf/list');
      const result = await response.json();
      
      if (response.ok && result.data) {
        setDcfList(result.data);
        if (result.data.length === 0) {
          setDbMessage({ type: 'error', text: 'No DCF entries found in database' });
        }
      } else {
        const errorMsg = result.details || result.error || 'Failed to load DCF list';
        console.error('Failed to load DCF list:', errorMsg, result);
        setDbMessage({ 
          type: 'error', 
          text: `Failed to load DCF list: ${errorMsg}${result.hint ? ` (${result.hint})` : ''}` 
        });
        setDcfList([]);
      }
    } catch (error: any) {
      console.error('Error loading DCF list:', error);
      setDbMessage({ 
        type: 'error', 
        text: `Error loading DCF list: ${error.message || 'Unknown error'}` 
      });
      setDcfList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const handleDcfSelect = async (id: string) => {
    if (!id) return;
    
    setSelectedDcfId(id);
    setDbLoading(true);
    setDbMessage(null);

    try {
      const response = await fetch(`/api/dcf?id=${id}`);
      const result = await response.json();

      if (!response.ok) {
        setDbMessage({ type: 'error', text: result.error || 'Failed to load from database' });
        setDbLoading(false);
        return;
      }

      const data = result.data;
      setDcfDbId(result.id);

      // Update dcfData state
      setDcfData(data);

      // Update formData state
      setFormData({
        revenueGrowth: {
          bear: (data.revenueGrowth.bear || 0) * 100,
          base: (data.revenueGrowth.base || 0) * 100,
          bull: (data.revenueGrowth.bull || 0) * 100
        },
        netIncomeGrowth: {
          bear: (data.netIncomeGrowth.bear || 0) * 100,
          base: (data.netIncomeGrowth.base || 0) * 100,
          bull: (data.netIncomeGrowth.bull || 0) * 100
        },
        peLow: {
          bear: Math.round(data.peLow.bear || 0),
          base: Math.round(data.peLow.base || 0),
          bull: Math.round(data.peLow.bull || 0)
        },
        peHigh: {
          bear: Math.round(data.peHigh.bear || 0),
          base: Math.round(data.peHigh.base || 0),
          bull: Math.round(data.peHigh.bull || 0)
        },
        stockPrice: data.stockPrice || 0
      });

      // Store in localStorage as well
      storeDCFData(data);

      // Calculate projections
      calculateProjections(data);

      // Scroll to top after loading data
      window.scrollTo(0, 0);

      setDbMessage({ type: 'success', text: `Loaded DCF data for ${data.symbol} from database` });
    } catch (error: any) {
      console.error('Error loading from database:', error);
      setDbMessage({ type: 'error', text: error.message || 'Failed to load from database' });
    } finally {
      setDbLoading(false);
    }
  };

  // Debug projections state changes
  useEffect(() => {
    console.log('Projections state changed:', projections);
  }, [projections]);

  // Debug dcfData state changes
  useEffect(() => {
    console.log('DCF data state changed:', dcfData);
  }, [dcfData]);

  const loadData = () => {
    try {
      console.log('loadData called');
      if (hasDCFData()) {
        const data = getDCFData();
        console.log('DCF data loaded:', data);
        if (data && data.revenueGrowth && data.netIncomeGrowth && data.peLow && data.peHigh) {
          console.log('Data validation passed, setting dcfData and formData');
          setDcfData(data);
          setFormData({
            revenueGrowth: {
              bear: (data.revenueGrowth.bear || 0) * 100,
              base: (data.revenueGrowth.base || 0) * 100,
              bull: (data.revenueGrowth.bull || 0) * 100
            },
            netIncomeGrowth: {
              bear: (data.netIncomeGrowth.bear || 0) * 100,
              base: (data.netIncomeGrowth.base || 0) * 100,
              bull: (data.netIncomeGrowth.bull || 0) * 100
            },
            peLow: {
              bear: Math.round(data.peLow.bear || 0),
              base: Math.round(data.peLow.base || 0),
              bull: Math.round(data.peLow.bull || 0)
            },
            peHigh: {
              bear: Math.round(data.peHigh.bear || 0),
              base: Math.round(data.peHigh.base || 0),
              bull: Math.round(data.peHigh.bull || 0)
            },
            stockPrice: data.stockPrice || 0
          });
          console.log('Calling calculateProjections with data:', data);
          calculateProjections(data);
        } else {
          // Data is corrupted or incomplete
          setDcfData(null);
          setProjections(null);
        }
      } else {
        // No data available
        setDcfData(null);
        setProjections(null);
      }
    } catch (error) {
      console.error('Error loading DCF data:', error);
      setDcfData(null);
      setProjections(null);
    }
  };

  const calculateProjections = (data: DCFData) => {
    try {
      console.log('calculateProjections called with data:', data);
      if (!data || !data.revenueGrowth || !data.netIncomeGrowth || !data.peLow || !data.peHigh) {
        console.warn('Invalid data for projections calculation', {
          hasData: !!data,
          hasRevenueGrowth: !!data?.revenueGrowth,
          hasNetIncomeGrowth: !!data?.netIncomeGrowth,
          hasPeLow: !!data?.peLow,
          hasPeHigh: !!data?.peHigh
        });
        setProjections(null);
        return;
      }

      const years = 5;
      const revenueProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const netIncomeProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const epsProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const sharePriceLowProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const sharePriceHighProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };

      // Calculate for each scenario
      const scenarios: ('bear' | 'base' | 'bull')[] = ['bear', 'base', 'bull'];
      
      scenarios.forEach(scenario => {
        let currentRevenue = new Decimal(data.revenue);
        let currentNetIncome = new Decimal(data.netIncome);
        
        const revenueGrowth = data.revenueGrowth[scenario];
        const netIncomeGrowth = data.netIncomeGrowth[scenario];
        const peLow = data.peLow[scenario];
        const peHigh = data.peHigh[scenario];

        // Handle zero or missing shares outstanding - use a reasonable default
        const sharesOutstanding = data.sharesOutstanding && data.sharesOutstanding > 0 
          ? data.sharesOutstanding 
          : 50000000; // Default to 50M shares if not available

        // Track EPS separately so it grows with net income growth (assuming stable share count)
        let currentEps: Decimal | null = null;
        if (data.currentEps && data.currentEps > 0) {
          currentEps = new Decimal(data.currentEps);
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
          
          // Fallback to deriving EPS from net income and shares if we don't have a starting EPS
          const eps = currentEps ?? currentNetIncome.div(sharesOutstanding);
          
          const sharePriceLow = eps.mul(peLow);
          const sharePriceHigh = eps.mul(peHigh);

          revenueProjections[scenario].push(currentRevenue.toNumber());
          netIncomeProjections[scenario].push(currentNetIncome.toNumber());
          epsProjections[scenario].push(eps.toNumber());
          sharePriceLowProjections[scenario].push(sharePriceLow.toNumber());
          sharePriceHighProjections[scenario].push(sharePriceHigh.toNumber());
        }
      });

    // Calculate CAGR
    const cagrLow = {
      bear: Math.pow(sharePriceLowProjections.bear[years - 1] / data.stockPrice, 1 / years) - 1,
      base: Math.pow(sharePriceLowProjections.base[years - 1] / data.stockPrice, 1 / years) - 1,
      bull: Math.pow(sharePriceLowProjections.bull[years - 1] / data.stockPrice, 1 / years) - 1
    };

    const cagrHigh = {
      bear: Math.pow(sharePriceHighProjections.bear[years - 1] / data.stockPrice, 1 / years) - 1,
      base: Math.pow(sharePriceHighProjections.base[years - 1] / data.stockPrice, 1 / years) - 1,
      bull: Math.pow(sharePriceHighProjections.bull[years - 1] / data.stockPrice, 1 / years) - 1
    };

      const projectionsData = {
        revenue: revenueProjections,
        netIncome: netIncomeProjections,
        eps: epsProjections,
        sharePriceLow: sharePriceLowProjections,
        sharePriceHigh: sharePriceHighProjections,
        cagrLow,
        cagrHigh
      };
      
      console.log('Setting projections:', projectionsData);
      console.log('Projections data structure check:', {
        hasRevenue: !!projectionsData.revenue,
        hasNetIncome: !!projectionsData.netIncome,
        hasEps: !!projectionsData.eps,
        hasSharePriceLow: !!projectionsData.sharePriceLow,
        hasSharePriceHigh: !!projectionsData.sharePriceHigh,
        revenueLength: projectionsData.revenue?.bear?.length,
        netIncomeLength: projectionsData.netIncome?.bear?.length,
        epsLength: projectionsData.eps?.bear?.length
      });
      setProjections(projectionsData);
    } catch (error) {
      console.error('Error calculating projections:', error);
      setProjections(null);
    }
  };

  const handleInputChange = (field: keyof typeof formData, scenario: 'bear' | 'base' | 'bull', value: string) => {
    const numValue = parseFloat(value) || 0;
    
    setFormData(prev => {
      const nextField = {
        ...(prev[field] as { bear: number; base: number; bull: number }),
        [scenario]: numValue
      };

      const nextForm = {
        ...prev,
        [field]: nextField
      };

      // Live-update projections to match textbox assumptions
      if (dcfData) {
        const updatedData: DCFData = {
          ...dcfData,
          revenueGrowth: {
            bear: nextForm.revenueGrowth.bear / 100,
            base: nextForm.revenueGrowth.base / 100,
            bull: nextForm.revenueGrowth.bull / 100
          },
          netIncomeGrowth: {
            bear: nextForm.netIncomeGrowth.bear / 100,
            base: nextForm.netIncomeGrowth.base / 100,
            bull: nextForm.netIncomeGrowth.bull / 100
          },
          peLow: {
            bear: Math.round(nextForm.peLow.bear),
            base: Math.round(nextForm.peLow.base),
            bull: Math.round(nextForm.peLow.bull)
          },
          peHigh: {
            bear: Math.round(nextForm.peHigh.bear),
            base: Math.round(nextForm.peHigh.base),
            bull: Math.round(nextForm.peHigh.bull)
          },
          stockPrice: nextForm.stockPrice,
          sharesOutstanding: dcfData.sharesOutstanding || 50000000,
          currentEps: dcfData.currentEps || 0,
          revenue: dcfData.revenue,
          netIncome: dcfData.netIncome
        };

        calculateProjections(updatedData);
      }

      return nextForm;
    });
  };

  const handleRefresh = () => {
    try {
      if (dcfData) {
        console.log('Before refresh - dcfData:', dcfData);
        console.log('Before refresh - formData:', formData);
        
        const updatedData: DCFData = {
          ...dcfData,
          revenueGrowth: {
            bear: formData.revenueGrowth.bear / 100,
            base: formData.revenueGrowth.base / 100,
            bull: formData.revenueGrowth.bull / 100
          },
          netIncomeGrowth: {
            bear: formData.netIncomeGrowth.bear / 100,
            base: formData.netIncomeGrowth.base / 100,
            bull: formData.netIncomeGrowth.bull / 100
          },
          peLow: {
            bear: Math.round(formData.peLow.bear),
            base: Math.round(formData.peLow.base),
            bull: Math.round(formData.peLow.bull)
          },
          peHigh: {
            bear: Math.round(formData.peHigh.bear),
            base: Math.round(formData.peHigh.base),
            bull: Math.round(formData.peHigh.bull)
          },
          stockPrice: formData.stockPrice,
          revenue: dcfData.revenue, // Keep the updated revenue value
          netIncome: dcfData.netIncome, // Keep the updated net income value
          sharesOutstanding: dcfData.sharesOutstanding || 50000000,
          currentEps: dcfData.currentEps || 0 // Keep the updated EPS value
        };
        
        console.log('Saving updated data:', updatedData);
        console.log('EPS value being saved:', updatedData.currentEps);
        
        // Update state and projections based on the latest textbox values
        setDcfData(updatedData);
        calculateProjections(updatedData);

        // Store updated data in localStorage for persistence
        storeDCFData(updatedData);
      } else {
        console.warn('No DCF data available for refresh');
      }
    } catch (error) {
      console.error('Error during refresh:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const loadFromDatabase = async () => {
    if (!dbSymbol.trim()) {
      setDbMessage({ type: 'error', text: 'Please enter a symbol' });
      return;
    }

    setDbLoading(true);
    setDbMessage(null);

    try {
      const response = await fetch(`/api/dcf?symbol=${encodeURIComponent(dbSymbol.trim().toUpperCase())}`);
      const result = await response.json();

      if (!response.ok) {
        setDbMessage({ type: 'error', text: result.error || 'Failed to load from database' });
        setDbLoading(false);
        return;
      }

      const data = result.data;
      setDcfDbId(result.id);

      // Update dcfData state
      setDcfData(data);

      // Update formData state
      setFormData({
        revenueGrowth: {
          bear: (data.revenueGrowth.bear || 0) * 100,
          base: (data.revenueGrowth.base || 0) * 100,
          bull: (data.revenueGrowth.bull || 0) * 100
        },
        netIncomeGrowth: {
          bear: (data.netIncomeGrowth.bear || 0) * 100,
          base: (data.netIncomeGrowth.base || 0) * 100,
          bull: (data.netIncomeGrowth.bull || 0) * 100
        },
        peLow: {
          bear: Math.round(data.peLow.bear || 0),
          base: Math.round(data.peLow.base || 0),
          bull: Math.round(data.peLow.bull || 0)
        },
        peHigh: {
          bear: Math.round(data.peHigh.bear || 0),
          base: Math.round(data.peHigh.base || 0),
          bull: Math.round(data.peHigh.bull || 0)
        },
        stockPrice: data.stockPrice || 0
      });

      // Store in localStorage as well
      storeDCFData(data);

      // Calculate projections
      calculateProjections(data);

      // Scroll to top after loading data
      window.scrollTo(0, 0);

      setDbMessage({ type: 'success', text: `Loaded DCF data for ${data.symbol} from database` });
    } catch (error: any) {
      console.error('Error loading from database:', error);
      setDbMessage({ type: 'error', text: error.message || 'Failed to load from database' });
    } finally {
      setDbLoading(false);
    }
  };

  const handleSaveDcf = async () => {
    if (!dcfData || !dcfData.symbol) {
      setDbMessage({ type: 'error', text: 'No DCF data or symbol to save' });
      return;
    }

    setDbSaving(true);
    setDbMessage(null);

    try {
      const dataToSave: DCFData = {
        ...dcfData,
        revenueGrowth: {
          bear: formData.revenueGrowth.bear / 100,
          base: formData.revenueGrowth.base / 100,
          bull: formData.revenueGrowth.bull / 100
        },
        netIncomeGrowth: {
          bear: formData.netIncomeGrowth.bear / 100,
          base: formData.netIncomeGrowth.base / 100,
          bull: formData.netIncomeGrowth.bull / 100
        },
        peLow: {
          bear: Math.round(formData.peLow.bear),
          base: Math.round(formData.peLow.base),
          bull: Math.round(formData.peLow.bull)
        },
        peHigh: {
          bear: Math.round(formData.peHigh.bear),
          base: Math.round(formData.peHigh.base),
          bull: Math.round(formData.peHigh.bull)
        },
        stockPrice: formData.stockPrice,
        timestamp: new Date().toISOString()
      };

      // First, check if a record with this symbol exists in DCF table
      const checkResponse = await fetch(`/api/dcf?symbol=${encodeURIComponent(dcfData.symbol.toUpperCase())}`);
      const checkResult = await checkResponse.json();

      let response;
      let isUpdate = false;

      if (checkResponse.ok && checkResult.id) {
        // Symbol exists, update the existing record
        isUpdate = true;
        response = await fetch(`/api/dcf?id=${checkResult.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        });
        setDcfDbId(checkResult.id);
      } else {
        // Symbol doesn't exist, create new record
        response = await fetch('/api/dcf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        });
      }

      const result = await response.json();

      if (!response.ok) {
        setDbMessage({ type: 'error', text: result.error || 'Failed to save to database' });
        setDbSaving(false);
        return;
      }

      if (result.id && !isUpdate) {
        setDcfDbId(result.id);
      }

      // Calculate DCF price from projections (use base case share price high from final year)
      let dcfPrice = null;
      if (projections && projections.sharePriceHigh && projections.sharePriceHigh.base) {
        const basePrices = projections.sharePriceHigh.base;
        if (basePrices.length > 0) {
          dcfPrice = basePrices[basePrices.length - 1]; // Get the final year price
        }
      }

      // Check if symbol exists in stock_valuations table and update dcf_price
      if (dcfPrice !== null) {
        try {
          const watchlistCheckResponse = await fetch(`/api/stock-valuations?stock=${encodeURIComponent(dcfData.symbol.toUpperCase())}`);
          const watchlistCheckResult = await watchlistCheckResponse.json();

          if (watchlistCheckResponse.ok && watchlistCheckResult.data && watchlistCheckResult.id) {
            // Symbol exists in watchlist, update dcf_price
            const updateResponse = await fetch(`/api/stock-valuations?id=${watchlistCheckResult.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stock: watchlistCheckResult.data.stock,
                buy_price: watchlistCheckResult.data.buy_price,
                active_price: watchlistCheckResult.data.active_price,
                dcf_price: dcfPrice,
                ddm_price: watchlistCheckResult.data.ddm_price,
                reit_valuation: watchlistCheckResult.data.reit_valuation,
                average_valuations: watchlistCheckResult.data.average_valuations,
                dividend_per_share: watchlistCheckResult.data.dividend_per_share,
                gross_profit_pct: watchlistCheckResult.data.gross_profit_pct,
                roic: watchlistCheckResult.data.roic,
                long_term_earning_growth: watchlistCheckResult.data.long_term_earning_growth,
                simplywall_valuation: watchlistCheckResult.data.simplywall_valuation,
                change_pct: watchlistCheckResult.data.change_pct,
                year_high: watchlistCheckResult.data.year_high,
                year_low: watchlistCheckResult.data.year_low,
                pe: watchlistCheckResult.data.pe,
                eps: watchlistCheckResult.data.eps
              })
            });

            if (!updateResponse.ok) {
              console.warn('Failed to update watchlist dcf_price:', await updateResponse.json());
            }
          }
        } catch (watchlistError) {
          console.warn('Error updating watchlist dcf_price:', watchlistError);
          // Don't fail the whole save if watchlist update fails
        }
      }

      // Reload the list to show the updated/new entry
      await loadDcfList();

      setDbMessage({ 
        type: 'success', 
        text: isUpdate ? `DCF data for ${dcfData.symbol} updated in database` : `DCF data for ${dcfData.symbol} saved to database` 
      });
    } catch (error: any) {
      console.error('Error saving to database:', error);
      setDbMessage({ type: 'error', text: error.message || 'Failed to save to database' });
    } finally {
      setDbSaving(false);
    }
  };

  const saveToDatabase = async () => {
    if (!dcfData || !dcfData.symbol) {
      setDbMessage({ type: 'error', text: 'No DCF data or symbol to save' });
      return;
    }

    setDbSaving(true);
    setDbMessage(null);

    try {
      const dataToSave: DCFData = {
        ...dcfData,
        revenueGrowth: {
          bear: formData.revenueGrowth.bear / 100,
          base: formData.revenueGrowth.base / 100,
          bull: formData.revenueGrowth.bull / 100
        },
        netIncomeGrowth: {
          bear: formData.netIncomeGrowth.bear / 100,
          base: formData.netIncomeGrowth.base / 100,
          bull: formData.netIncomeGrowth.bull / 100
        },
        peLow: {
          bear: Math.round(formData.peLow.bear),
          base: Math.round(formData.peLow.base),
          bull: Math.round(formData.peLow.bull)
        },
        peHigh: {
          bear: Math.round(formData.peHigh.bear),
          base: Math.round(formData.peHigh.base),
          bull: Math.round(formData.peHigh.bull)
        },
        stockPrice: formData.stockPrice,
        timestamp: new Date().toISOString()
      };

      // First, check if a record with this symbol exists
      const checkResponse = await fetch(`/api/dcf?symbol=${encodeURIComponent(dcfData.symbol.toUpperCase())}`);
      const checkResult = await checkResponse.json();

      let response;
      let isUpdate = false;

      if (checkResponse.ok && checkResult.id) {
        // Symbol exists, update the existing record
        isUpdate = true;
        response = await fetch(`/api/dcf?id=${checkResult.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        });
        setDcfDbId(checkResult.id);
      } else {
        // Symbol doesn't exist, create new record
        response = await fetch('/api/dcf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        });
      }

      const result = await response.json();

      if (!response.ok) {
        setDbMessage({ type: 'error', text: result.error || 'Failed to save to database' });
        setDbSaving(false);
        return;
      }

      if (result.id && !isUpdate) {
        setDcfDbId(result.id);
      }

      // Reload the list to show the updated/new entry
      await loadDcfList();

      setDbMessage({ 
        type: 'success', 
        text: isUpdate ? `DCF data for ${dcfData.symbol} updated in database` : `DCF data for ${dcfData.symbol} saved to database` 
      });
    } catch (error: any) {
      console.error('Error saving to database:', error);
      setDbMessage({ type: 'error', text: error.message || 'Failed to save to database' });
    } finally {
      setDbSaving(false);
    }
  };

  const handleAddToWatchlist = async () => {
    if (!dcfData || !dcfData.symbol || !projections) {
      setDbMessage({ type: 'error', text: 'DCF data and projections are required to add to watchlist' });
      return;
    }

    setSavingToWatchlist(true);
    setDbMessage(null);

    try {
      // Calculate bear/base/bull case prices from projections (year 5, index 4)
      const bearCaseAvg = (projections.sharePriceLow.bear[4] + projections.sharePriceHigh.bear[4]) / 2;
      const bearCaseLow = projections.sharePriceLow.bear[4];
      const bearCaseHigh = projections.sharePriceHigh.bear[4];
      
      const baseCaseAvg = (projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2;
      const baseCaseLow = projections.sharePriceLow.base[4];
      const baseCaseHigh = projections.sharePriceHigh.base[4];
      
      const bullCaseAvg = (projections.sharePriceLow.bull[4] + projections.sharePriceHigh.bull[4]) / 2;
      const bullCaseLow = projections.sharePriceLow.bull[4];
      const bullCaseHigh = projections.sharePriceHigh.bull[4];

      // Check if stock exists in stock_valuations table
      const checkResponse = await fetch(`/api/stock-valuations?stock=${encodeURIComponent(dcfData.symbol.toUpperCase())}`);
      const checkResult = await checkResponse.json();

      if (checkResponse.ok && checkResult.data && checkResult.id) {
        // Stock exists, update with bear/base/bull case prices
        const updateResponse = await fetch(`/api/stock-valuations?id=${checkResult.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...checkResult.data,
            bear_case_avg_price: bearCaseAvg,
            bear_case_low_price: bearCaseLow,
            bear_case_high_price: bearCaseHigh,
            base_case_avg_price: baseCaseAvg,
            base_case_low_price: baseCaseLow,
            base_case_high_price: baseCaseHigh,
            bull_case_avg_price: bullCaseAvg,
            bull_case_low_price: bullCaseLow,
            bull_case_high_price: bullCaseHigh,
          }),
        });

        const updateResult = await updateResponse.json();

        if (!updateResponse.ok) {
          setDbMessage({ type: 'error', text: updateResult.error || 'Failed to update watchlist' });
          setSavingToWatchlist(false);
          return;
        }

        setDbMessage({ type: 'success', text: 'Share Price Summary data added to watchlist successfully!' });
      } else {
        // Stock doesn't exist, create new entry
        const createResponse = await fetch('/api/stock-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock: dcfData.symbol.toUpperCase(),
            active_price: dcfData.stockPrice,
            bear_case_avg_price: bearCaseAvg,
            bear_case_low_price: bearCaseLow,
            bear_case_high_price: bearCaseHigh,
            base_case_avg_price: baseCaseAvg,
            base_case_low_price: baseCaseLow,
            base_case_high_price: baseCaseHigh,
            bull_case_avg_price: bullCaseAvg,
            bull_case_low_price: bullCaseLow,
            bull_case_high_price: bullCaseHigh,
          }),
        });

        const createResult = await createResponse.json();

        if (!createResponse.ok) {
          setDbMessage({ type: 'error', text: createResult.error || 'Failed to create watchlist entry' });
          setSavingToWatchlist(false);
          return;
        }

        setDbMessage({ type: 'success', text: 'Share Price Summary data added to watchlist successfully!' });
      }
    } catch (error: any) {
      console.error('Error adding to watchlist:', error);
      setDbMessage({ type: 'error', text: `Error adding to watchlist: ${error.message || 'Unknown error'}` });
    } finally {
      setSavingToWatchlist(false);
    }
  };

  if (!dcfData) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-8 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">
                No DCF Data Available
              </h2>
              <p className="text-yellow-700 dark:text-yellow-300 mb-6 text-lg">
                Load existing DCF data from the database or search for a stock symbol on the Company Research page
              </p>
              
              {/* DCF Dropdown Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-4">
                  <select
                    value={selectedDcfId}
                    onChange={(e) => handleDcfSelect(e.target.value)}
                    disabled={loadingList || dbLoading}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select a DCF entry --</option>
                    {[...dcfList].sort((a, b) => a.symbol.localeCompare(b.symbol)).map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.symbol}
                      </option>
                    ))}
                  </select>
                </div>
                {loadingList && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Loading DCF entries...</p>
                )}
                {dbMessage && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${
                    dbMessage.type === 'success' 
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                  }`}>
                    {dbMessage.text}
                  </div>
                )}
              </div>

              <Link
                href="/research"
                className="inline-block px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Go to Company Research
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">

        {/* DCF Dropdown Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <select
              value={selectedDcfId}
              onChange={(e) => handleDcfSelect(e.target.value)}
              disabled={loadingList || dbLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              <option value="">-- Select a DCF entry --</option>
              {[...dcfList].sort((a, b) => a.symbol.localeCompare(b.symbol)).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.symbol}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveDcf}
              disabled={dbSaving || !dcfData || !dcfData.symbol}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-sm"
            >
              {dbSaving ? 'Saving...' : (
                <>
                  <span className="mr-1">💾</span>
                  Save
                </>
              )}
            </button>
          </div>
          {loadingList && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading DCF entries...</p>
          )}
          {dbMessage && dbMessage.text.includes('DCF list') && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              dbMessage.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}>
              {dbMessage.text}
            </div>
          )}
        </div>

        {/* Input Forms */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
          {/* Top Row - Revenue Growth, Net Income Growth, PE Low, PE High (1/4 each) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Revenue Growth */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📈</span>
                Revenue Growth (%)
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bear:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueGrowth.bear}
                    onChange={(e) => handleInputChange('revenueGrowth', 'bear', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Base:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueGrowth.base}
                    onChange={(e) => handleInputChange('revenueGrowth', 'base', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bull:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueGrowth.bull}
                    onChange={(e) => handleInputChange('revenueGrowth', 'bull', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Net Income Growth */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">💰</span>
                Net Income Growth (%)
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bear:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netIncomeGrowth.bear}
                    onChange={(e) => handleInputChange('netIncomeGrowth', 'bear', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Base:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netIncomeGrowth.base}
                    onChange={(e) => handleInputChange('netIncomeGrowth', 'base', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bull:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netIncomeGrowth.bull}
                    onChange={(e) => handleInputChange('netIncomeGrowth', 'bull', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* PE Low */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📉</span>
                PE Low
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bear:</label>
                  <input
                    type="number"
                    value={formData.peLow.bear}
                    onChange={(e) => handleInputChange('peLow', 'bear', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Base:</label>
                  <input
                    type="number"
                    value={formData.peLow.base}
                    onChange={(e) => handleInputChange('peLow', 'base', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bull:</label>
                  <input
                    type="number"
                    value={formData.peLow.bull}
                    onChange={(e) => handleInputChange('peLow', 'bull', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* PE High */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📈</span>
                PE High
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bear:</label>
                  <input
                    type="number"
                    value={formData.peHigh.bear}
                    onChange={(e) => handleInputChange('peHigh', 'bear', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Base:</label>
                  <input
                    type="number"
                    value={formData.peHigh.base}
                    onChange={(e) => handleInputChange('peHigh', 'base', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-16 text-sm font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-center flex-shrink-0">Bull:</label>
                  <input
                    type="number"
                    value={formData.peHigh.bull}
                    onChange={(e) => handleInputChange('peHigh', 'bull', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue, Net Income, Stock Price, and Shares Outstanding Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Revenue */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📊</span>
                Revenue
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-sm font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-center flex-shrink-0">$:</label>
                <input
                  type="number"
                  step="0.01"
                  value={dcfData ? dcfData.revenue : 0}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, revenue: parseFloat(e.target.value) || 0 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 min-w-0 px-3 py-2 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Net Income */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">💰</span>
                Net Income
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-sm font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-center flex-shrink-0">$:</label>
                <input
                  type="number"
                  step="0.01"
                  value={dcfData ? dcfData.netIncome : 0}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, netIncome: parseFloat(e.target.value) || 0 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 min-w-0 px-3 py-2 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Stock Price */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">💲</span>
                Stock Price
              </h3>
              <div className="flex items-center gap-1">
                <label className="w-10 text-sm font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-1 py-1 rounded text-center flex-shrink-0">$:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stockPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, stockPrice: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 min-w-0 px-2 py-1 border border-indigo-200 dark:border-indigo-800 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Shares Outstanding */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📈</span>
                Shares Outstanding
              </h3>
              <div className="flex items-center gap-1">
                <label className="w-10 text-sm font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-1 py-1 rounded text-center flex-shrink-0">#:</label>
                <input
                  type="number"
                  step="1"
                  value={dcfData ? (dcfData.sharesOutstanding || 50000000) : 50000000}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, sharesOutstanding: parseFloat(e.target.value) || 50000000 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 min-w-0 px-2 py-1 border border-purple-200 dark:border-purple-800 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                  placeholder="50000000"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                {dcfData && dcfData.sharesOutstanding === 0 ? '⚠️ Not loaded from Company Research' : '✓ Loaded from Company Research'}
              </div>
            </div>
          </div>

          {/* Buttons Row with EPS Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Symbol Display */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📈</span>
                Symbol
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-sm font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">SYM:</label>
                <input
                  type="text"
                  value={dcfData?.symbol || ''}
                  placeholder="Symbol"
                  readOnly
                  className="flex-1 px-3 py-2 border border-indigo-200 dark:border-indigo-800 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold text-center"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {dcfData?.symbol ? `✓ Loaded from database` : 'No symbol loaded'}
              </div>
            </div>

            {/* EPS Input */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center justify-center">
                <span className="mr-1">📊</span>
                Current EPS
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-sm font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-center flex-shrink-0">EPS:</label>
                <input
                  type="number"
                  step="0.01"
                  value={dcfData ? (dcfData.currentEps || 0) : 0}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, currentEps: parseFloat(e.target.value) || 0 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 min-w-0 px-3 py-2 border border-purple-200 dark:border-purple-800 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-800 dark:text-white text-sm font-medium text-center"
                  placeholder="0.00"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                {dcfData && dcfData.currentEps === 0 ? '⚠️ Not loaded from Company Research' : '✓ Loaded from Company Research'}
              </div>
            </div>

            <div className="flex flex-col justify-center items-center h-full gap-3">
              {/* AI Advice Buttons - Bear/Base/Bull for DCF */}
              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  disabled={!dcfData?.symbol || bearPromptLoading}
                  onClick={async () => {
                      try {
                        setBearPromptLoading(true);
                        const lines: string[] = [];
                        lines.push(
                          'You are a financial analyst. Using up-to-date data, help me choose conservative (bear) DCF assumptions for this stock.'
                        );
                        if (dcfData?.symbol) {
                          lines.push(`\nStock symbol: ${dcfData.symbol}`);
                        }
                        lines.push(
                          '\nMy current bear-case DCF inputs (percentages are per year):',
                          `- Revenue growth (bear): ${formData.revenueGrowth.bear.toFixed(2)}%`,
                          `- Net income growth (bear): ${formData.netIncomeGrowth.bear.toFixed(2)}%`,
                          `- P/E low (bear): ${formData.peLow.bear.toFixed(0)}x`,
                          `- P/E high (bear): ${formData.peHigh.bear.toFixed(0)}x`,
                          `- Current stock price: ${formatCurrency(formData.stockPrice)}`
                        );
                        if (projections) {
                          lines.push(
                            '\nBear-case 5-year output from my current model:',
                            `- Average target price (year 5): ${formatCurrency((projections.sharePriceLow.bear[4] + projections.sharePriceHigh.bear[4]) / 2)}`,
                            `- Low target price (year 5): ${formatCurrency(projections.sharePriceLow.bear[4])}`,
                            `- High target price (year 5): ${formatCurrency(projections.sharePriceHigh.bear[4])}`
                          );
                        }
                        lines.push(
                          '\nInstructions (bear case):',
                          '1. Based on recent fundamentals, growth, margins and valuation, suggest realistic bear-case values for revenue growth, net income growth, and P/E low/high.',
                          '2. Highlight where my current bear assumptions are too optimistic or unnecessarily pessimistic.',
                          '3. Suggest a reasonable 5-year bear-case price range and compare it to today’s price.',
                          '4. Provide a short explanation of why your suggested bear-case inputs make sense.'
                        );

                        const prompt = lines.join('\n');

                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          await navigator.clipboard.writeText(prompt);
                          setDbMessage({
                            type: 'success',
                            text: 'Bear-case advice prompt copied. Paste into ChatGPT to refine your bear assumptions.'
                          });
                        } else {
                          setDbMessage({
                            type: 'error',
                            text: 'Could not access clipboard. Please copy the prompt manually.'
                          });
                        }
                      } catch (error: any) {
                        console.error('Error creating bear-case advice prompt for DCF:', error);
                        setDbMessage({
                          type: 'error',
                          text: error?.message || 'Failed to create bear-case advice prompt.'
                        });
                      } finally {
                        setBearPromptLoading(false);
                      }
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  {bearPromptLoading ? 'Bear Prompt...' : 'Bear Advice Prompt'}
                </button>

                <button
                  type="button"
                  disabled={!dcfData?.symbol || basePromptLoading}
                  onClick={async () => {
                      try {
                        setBasePromptLoading(true);
                        const lines: string[] = [];
                        lines.push(
                          'You are a financial analyst. Using up-to-date data, help me choose realistic base-case DCF assumptions for this stock.'
                        );
                        if (dcfData?.symbol) {
                          lines.push(`\nStock symbol: ${dcfData.symbol}`);
                        }
                        lines.push(
                          '\nMy current base-case DCF inputs (percentages are per year):',
                          `- Revenue growth (base): ${formData.revenueGrowth.base.toFixed(2)}%`,
                          `- Net income growth (base): ${formData.netIncomeGrowth.base.toFixed(2)}%`,
                          `- P/E low (base): ${formData.peLow.base.toFixed(0)}x`,
                          `- P/E high (base): ${formData.peHigh.base.toFixed(0)}x`,
                          `- Current stock price: ${formatCurrency(formData.stockPrice)}`
                        );
                        if (projections) {
                          lines.push(
                            '\nBase-case 5-year output from my current model:',
                            `- Average target price (year 5): ${formatCurrency((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2)}`,
                            `- Low target price (year 5): ${formatCurrency(projections.sharePriceLow.base[4])}`,
                            `- High target price (year 5): ${formatCurrency(projections.sharePriceHigh.base[4])}`
                          );
                        }
                        lines.push(
                          '\nInstructions (base case):',
                          '1. Suggest base-case revenue and net income growth rates that align with consensus expectations and recent company performance.',
                          '2. Suggest reasonable P/E low and high values for a base scenario.',
                          '3. Comment on whether my current base-case output looks realistic vs today’s price.',
                          '4. Provide any tweaks you’d make to turn this into a solid, defensible base-case model.'
                        );

                        const prompt = lines.join('\n');

                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          await navigator.clipboard.writeText(prompt);
                          setDbMessage({
                            type: 'success',
                            text: 'Base-case advice prompt copied. Paste into ChatGPT to refine your base assumptions.'
                          });
                        } else {
                          setDbMessage({
                            type: 'error',
                            text: 'Could not access clipboard. Please copy the prompt manually.'
                          });
                        }
                      } catch (error: any) {
                        console.error('Error creating base-case advice prompt for DCF:', error);
                        setDbMessage({
                          type: 'error',
                          text: error?.message || 'Failed to create base-case advice prompt.'
                        });
                      } finally {
                        setBasePromptLoading(false);
                      }
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  {basePromptLoading ? 'Base Prompt...' : 'Base Advice Prompt'}
                </button>

                <button
                  type="button"
                  disabled={!dcfData?.symbol || bullPromptLoading}
                  onClick={async () => {
                      try {
                        setBullPromptLoading(true);
                        const lines: string[] = [];
                        lines.push(
                          'You are a financial analyst. Using up-to-date data, help me choose optimistic but plausible bull-case DCF assumptions for this stock.'
                        );
                        if (dcfData?.symbol) {
                          lines.push(`\nStock symbol: ${dcfData.symbol}`);
                        }
                        lines.push(
                          '\nMy current bull-case DCF inputs (percentages are per year):',
                          `- Revenue growth (bull): ${formData.revenueGrowth.bull.toFixed(2)}%`,
                          `- Net income growth (bull): ${formData.netIncomeGrowth.bull.toFixed(2)}%`,
                          `- P/E low (bull): ${formData.peLow.bull.toFixed(0)}x`,
                          `- P/E high (bull): ${formData.peHigh.bull.toFixed(0)}x`,
                          `- Current stock price: ${formatCurrency(formData.stockPrice)}`
                        );
                        if (projections) {
                          lines.push(
                            '\nBull-case 5-year output from my current model:',
                            `- Average target price (year 5): ${formatCurrency((projections.sharePriceLow.bull[4] + projections.sharePriceHigh.bull[4]) / 2)}`,
                            `- Low target price (year 5): ${formatCurrency(projections.sharePriceLow.bull[4])}`,
                            `- High target price (year 5): ${formatCurrency(projections.sharePriceHigh.bull[4])}`
                          );
                        }
                        lines.push(
                          '\nInstructions (bull case):',
                          '1. Suggest bull-case growth and P/E assumptions that are optimistic but still grounded in reality for this business and sector.',
                          '2. Highlight if my current bull assumptions are unrealistic in either direction.',
                          '3. Provide a reasonable bull-case 5-year price range and compare it to today’s price.',
                          '4. Provide a short rationale for your suggested bull-case inputs.'
                        );

                        const prompt = lines.join('\n');

                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          await navigator.clipboard.writeText(prompt);
                          setDbMessage({
                            type: 'success',
                            text: 'Bull-case advice prompt copied. Paste into ChatGPT to refine your bull assumptions.'
                          });
                        } else {
                          setDbMessage({
                            type: 'error',
                            text: 'Could not access clipboard. Please copy the prompt manually.'
                          });
                        }
                      } catch (error: any) {
                        console.error('Error creating bull-case advice prompt for DCF:', error);
                        setDbMessage({
                          type: 'error',
                          text: error?.message || 'Failed to create bull-case advice prompt.'
                        });
                      } finally {
                        setBullPromptLoading(false);
                      }
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  {bullPromptLoading ? 'Bull Prompt...' : 'Bull Advice Prompt'}
                </button>
              </div>

              <button
                onClick={loadDcfList}
                disabled={loadingList}
                className="w-full px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-xs flex items-center justify-center"
              >
                {loadingList ? 'Loading...' : (
                  <>
                    <span className="mr-1">🔄</span>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Reset Button - Outside and under 2nd section */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => {
              localStorage.removeItem('dcfData');
              window.location.reload();
            }}
            className="px-6 py-2 bg-pink-200 text-pink-800 rounded-md hover:bg-pink-300 transition-colors duration-200 font-medium text-sm flex items-center justify-center"
          >
            <span className="mr-1">🗑️</span>
            Reset
          </button>
        </div>

        {/* Share Price Summary */}
        {dcfData && projections && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Share Price Summary</h2>
              <button
                onClick={handleAddToWatchlist}
                disabled={savingToWatchlist || !dcfData?.symbol}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {savingToWatchlist ? 'Adding...' : '💾 Add To WatchList data'}
              </button>
            </div>

            {/* Current Price Row */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 rounded-lg p-6 mb-4 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg text-white mb-1">Current Market Price</div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    &nbsp;
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Current Price</div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {formatCurrency(dcfData?.stockPrice || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Investment Signal</div>
                  <div className={`text-2xl font-bold ${dcfData && dcfData.stockPrice < ((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2) ? 'text-green-600' : 'text-red-600'}`}>
                    {dcfData && dcfData.stockPrice < ((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2) ? 'BUY' : 'HOLD'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bear Case Row */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-6 mb-4 border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg text-white mb-1">Bear Case</div>
                  <div className="text-xl font-bold text-red-600">
                    &nbsp;
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency((projections.sharePriceLow.bear[4] + projections.sharePriceHigh.bear[4]) / 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(projections.sharePriceLow.bear[4])}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(projections.sharePriceHigh.bear[4])}
                  </div>
                </div>
              </div>
            </div>

            {/* Base Case Row */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg text-white mb-1">Base Case</div>
                  <div className="text-xl font-bold text-blue-600">
                    &nbsp;
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(projections.sharePriceLow.base[4])}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(projections.sharePriceHigh.base[4])}
                  </div>
                </div>
              </div>
            </div>

            {/* Bull Case Row */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 mb-4 border border-green-200 dark:border-green-800">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg text-white mb-1">Bull Case</div>
                  <div className="text-xl font-bold text-green-600">
                    &nbsp;
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency((projections.sharePriceLow.bull[4] + projections.sharePriceHigh.bull[4]) / 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(projections.sharePriceLow.bull[4])}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(projections.sharePriceHigh.bull[4])}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Validation Buttons */}
            <div className="mt-4 mb-2 flex flex-col md:flex-row gap-3 md:gap-4 items-center">
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">AI Prompt</span>
              <button
                type="button"
                disabled={bearPromptLoading}
                onClick={async () => {
                  try {
                    setBearPromptLoading(true);
                    const lines: string[] = [];
                    lines.push('You are a financial analyst. Please validate the following bearish DCF assumptions against up-to-date market data and recent business performance.');
                    if (dcfData?.symbol) {
                      lines.push(`\nStock symbol: ${dcfData.symbol}`);
                    }
                    lines.push(
                      '\nBear Case Inputs (all per-year growth as %):',
                      `- Revenue growth (bear): ${formData.revenueGrowth.bear.toFixed(2)}%`,
                      `- Net income growth (bear): ${formData.netIncomeGrowth.bear.toFixed(2)}%`,
                      `- P/E low (bear): ${formData.peLow.bear.toFixed(0)}x`,
                      `- P/E high (bear): ${formData.peHigh.bear.toFixed(0)}x`,
                      `- Current stock price: ${formatCurrency(formData.stockPrice)}`
                    );

                    lines.push(
                      '\nBear Case 5-Year Price Outputs:',
                      `- Average target price (year 5): ${formatCurrency((projections.sharePriceLow.bear[4] + projections.sharePriceHigh.bear[4]) / 2)}`,
                      `- Low target price (year 5): ${formatCurrency(projections.sharePriceLow.bear[4])}`,
                      `- High target price (year 5): ${formatCurrency(projections.sharePriceHigh.bear[4])}`
                    );

                    lines.push(
                      '\nInstructions:',
                      '1. Compare these bear-case assumptions to current analyst expectations and historical trends.',
                      '2. Highlight where revenue growth, net income growth, or P/E multiples look too aggressive or too conservative.',
                      "3. Comment on whether the year-5 bear-case price range is reasonable relative to today's price.",
                      '4. Suggest any tweaks to the bear-case inputs to make the scenario more realistic.'
                    );

                    const prompt = lines.join('\n');

                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(prompt);
                      setDbMessage({
                        type: 'success',
                        text: 'Bear case AI prompt copied. Paste this into ChatGPT to validate your assumptions.'
                      });
                    } else {
                      setDbMessage({
                        type: 'error',
                        text: 'Could not access clipboard. Please copy the prompt manually.'
                      });
                    }
                  } catch (error: any) {
                    console.error('Error creating bear-case AI prompt for DCF:', error);
                    setDbMessage({
                      type: 'error',
                      text: error?.message || 'Failed to create bear-case AI prompt.'
                    });
                  } finally {
                    setBearPromptLoading(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {bearPromptLoading ? 'Creating Bear Prompt...' : 'Validate Bear Case Prompt'}
              </button>

              <button
                type="button"
                disabled={basePromptLoading}
                onClick={async () => {
                  try {
                    setBasePromptLoading(true);
                    const lines: string[] = [];
                    lines.push('You are a financial analyst. Please validate the following base-case DCF assumptions against up-to-date market data and recent business performance.');
                    if (dcfData?.symbol) {
                      lines.push(`\nStock symbol: ${dcfData.symbol}`);
                    }
                    lines.push(
                      '\nBase Case Inputs (all per-year growth as %):',
                      `- Revenue growth (base): ${formData.revenueGrowth.base.toFixed(2)}%`,
                      `- Net income growth (base): ${formData.netIncomeGrowth.base.toFixed(2)}%`,
                      `- P/E low (base): ${formData.peLow.base.toFixed(0)}x`,
                      `- P/E high (base): ${formData.peHigh.base.toFixed(0)}x`,
                      `- Current stock price: ${formatCurrency(formData.stockPrice)}`
                    );

                    lines.push(
                      '\nBase Case 5-Year Price Outputs:',
                      `- Average target price (year 5): ${formatCurrency((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2)}`,
                      `- Low target price (year 5): ${formatCurrency(projections.sharePriceLow.base[4])}`,
                      `- High target price (year 5): ${formatCurrency(projections.sharePriceHigh.base[4])}`
                    );

                    lines.push(
                      '\nInstructions:',
                      '1. Compare these base-case assumptions to current analyst expectations and historical trends.',
                      '2. Highlight where revenue growth, net income growth, or P/E multiples look too aggressive or too conservative.',
                      "3. Comment on whether the year-5 base-case price range is reasonable relative to today's price.",
                      '4. Suggest any tweaks to the base-case inputs to make the scenario more realistic.'
                    );

                    const prompt = lines.join('\n');

                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(prompt);
                      setDbMessage({
                        type: 'success',
                        text: 'Base case AI prompt copied. Paste this into ChatGPT to validate your assumptions.'
                      });
                    } else {
                      setDbMessage({
                        type: 'error',
                        text: 'Could not access clipboard. Please copy the prompt manually.'
                      });
                    }
                  } catch (error: any) {
                    console.error('Error creating base-case AI prompt for DCF:', error);
                    setDbMessage({
                      type: 'error',
                      text: error?.message || 'Failed to create base-case AI prompt.'
                    });
                  } finally {
                    setBasePromptLoading(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {basePromptLoading ? 'Creating Base Prompt...' : 'Validate Base Case Prompt'}
              </button>

              <button
                type="button"
                disabled={bullPromptLoading}
                onClick={async () => {
                  try {
                    setBullPromptLoading(true);
                    const lines: string[] = [];
                    lines.push('You are a financial analyst. Please validate the following bull-case DCF assumptions against up-to-date market data and recent business performance.');
                    if (dcfData?.symbol) {
                      lines.push(`\nStock symbol: ${dcfData.symbol}`);
                    }
                    lines.push(
                      '\nBull Case Inputs (all per-year growth as %):',
                      `- Revenue growth (bull): ${formData.revenueGrowth.bull.toFixed(2)}%`,
                      `- Net income growth (bull): ${formData.netIncomeGrowth.bull.toFixed(2)}%`,
                      `- P/E low (bull): ${formData.peLow.bull.toFixed(0)}x`,
                      `- P/E high (bull): ${formData.peHigh.bull.toFixed(0)}x`,
                      `- Current stock price: ${formatCurrency(formData.stockPrice)}`
                    );

                    lines.push(
                      '\nBull Case 5-Year Price Outputs:',
                      `- Average target price (year 5): ${formatCurrency((projections.sharePriceLow.bull[4] + projections.sharePriceHigh.bull[4]) / 2)}`,
                      `- Low target price (year 5): ${formatCurrency(projections.sharePriceLow.bull[4])}`,
                      `- High target price (year 5): ${formatCurrency(projections.sharePriceHigh.bull[4])}`
                    );

                    lines.push(
                      '\nInstructions:',
                      '1. Compare these bull-case assumptions to current analyst expectations and historical trends.',
                      '2. Highlight where revenue growth, net income growth, or P/E multiples look too aggressive or too conservative.',
                      "3. Comment on whether the year-5 bull-case price range is reasonable relative to today's price.",
                      '4. Suggest any tweaks to the bull-case inputs to make the scenario more realistic.'
                    );

                    const prompt = lines.join('\n');

                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(prompt);
                      setDbMessage({
                        type: 'success',
                        text: 'Bull case AI prompt copied. Paste this into ChatGPT to validate your assumptions.'
                      });
                    } else {
                      setDbMessage({
                        type: 'error',
                        text: 'Could not access clipboard. Please copy the prompt manually.'
                      });
                    }
                  } catch (error: any) {
                    console.error('Error creating bull-case AI prompt for DCF:', error);
                    setDbMessage({
                      type: 'error',
                      text: error?.message || 'Failed to create bull-case AI prompt.'
                    });
                  } finally {
                    setBullPromptLoading(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {bullPromptLoading ? 'Creating Bull Prompt...' : 'Validate Bull Case Prompt'}
              </button>
            </div>
          </div>
        )}

        {/* CAGR Summary */}
        {dcfData && projections && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-6 text-lg flex items-center">
                  <span className="mr-2">📉</span>
                  CAGR Low
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-red-600 font-semibold">Bear:</span>
                    <span className="font-mono text-lg font-bold text-red-600">{formatPercentage(projections.cagrLow.bear)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-blue-600 font-semibold">Base:</span>
                    <span className="font-mono text-lg font-bold text-blue-600">{formatPercentage(projections.cagrLow.base)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="text-green-600 font-semibold">Bull:</span>
                    <span className="font-mono text-lg font-bold text-green-600">{formatPercentage(projections.cagrLow.bull)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-6 text-lg flex items-center">
                  <span className="mr-2">📈</span>
                  CAGR High
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-red-600 font-semibold">Bear:</span>
                    <span className="font-mono text-lg font-bold text-red-600">{formatPercentage(projections.cagrHigh.bear)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-blue-600 font-semibold">Base:</span>
                    <span className="font-mono text-lg font-bold text-blue-600">{formatPercentage(projections.cagrHigh.base)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="text-green-600 font-semibold">Bull:</span>
                    <span className="font-mono text-lg font-bold text-green-600">{formatPercentage(projections.cagrHigh.bull)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projections Table */}
        {dcfData && projections && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="text-left py-4 px-6 font-bold text-lg text-white">Metric</th>
                    <th className="py-4 px-6 font-bold text-lg text-red-600 bg-red-50 dark:bg-red-900/20">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-2">
                          <span>Bear Case</span>
                          <button
                          type="button"
                          disabled={bearCopyLoading}
                          onClick={async () => {
                            try {
                              setBearCopyLoading(true);
                              if (!dcfData || !projections) return;
                              const bearData = {
                                case: 'bear',
                                symbol: dcfData.symbol,
                                currentPrice: dcfData.stockPrice,
                                assumptions: {
                                  revenueGrowthPercent: formData.revenueGrowth.bear,
                                  netIncomeGrowthPercent: formData.netIncomeGrowth.bear,
                                  peLow: formData.peLow.bear,
                                  peHigh: formData.peHigh.bear,
                                },
                                projections: {
                                  revenue: projections.revenue.bear,
                                  netIncome: projections.netIncome.bear,
                                  eps: projections.eps.bear,
                                  sharePriceLow: projections.sharePriceLow.bear,
                                  sharePriceHigh: projections.sharePriceHigh.bear,
                                },
                              };
                              const json = JSON.stringify(bearData, null, 2);
                              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                await navigator.clipboard.writeText(json);
                                setBearCopyCopied(true);
                                setTimeout(() => setBearCopyCopied(false), 2000);
                              } else {
                                setDbMessage({
                                  type: 'error',
                                  text: 'Could not access clipboard. Please copy the JSON manually.',
                                });
                              }
                            } catch (error: any) {
                              console.error('Error copying bear case projections JSON:', error);
                              setDbMessage({
                                type: 'error',
                                text: error?.message || 'Failed to copy bear case projections JSON.',
                              });
                            } finally {
                              setBearCopyLoading(false);
                            }
                          }}
                          className="min-w-[64px] h-8 px-2 rounded-full bg-white/80 dark:bg-gray-900/60 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 flex items-center justify-center text-xs shadow-sm hover:bg-white dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          title="Copy bear column data as JSON"
                        >
                          {bearCopyLoading ? 'Copying...' : 'Copy'}
                          </button>
                        </div>
                        {bearCopyCopied && (
                          <span className="text-[11px] text-red-600 dark:text-red-300">Copied</span>
                        )}
                      </div>
                    </th>
                    <th className="py-4 px-6 font-bold text-lg text-blue-600 bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-2">
                          <span>Base Case</span>
                          <button
                          type="button"
                          disabled={baseCopyLoading}
                          onClick={async () => {
                            try {
                              setBaseCopyLoading(true);
                              if (!dcfData || !projections) return;
                              const baseData = {
                                case: 'base',
                                symbol: dcfData.symbol,
                                currentPrice: dcfData.stockPrice,
                                assumptions: {
                                  revenueGrowthPercent: formData.revenueGrowth.base,
                                  netIncomeGrowthPercent: formData.netIncomeGrowth.base,
                                  peLow: formData.peLow.base,
                                  peHigh: formData.peHigh.base,
                                },
                                projections: {
                                  revenue: projections.revenue.base,
                                  netIncome: projections.netIncome.base,
                                  eps: projections.eps.base,
                                  sharePriceLow: projections.sharePriceLow.base,
                                  sharePriceHigh: projections.sharePriceHigh.base,
                                },
                              };
                              const json = JSON.stringify(baseData, null, 2);
                              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                await navigator.clipboard.writeText(json);
                                setBaseCopyCopied(true);
                                setTimeout(() => setBaseCopyCopied(false), 2000);
                              } else {
                                setDbMessage({
                                  type: 'error',
                                  text: 'Could not access clipboard. Please copy the JSON manually.',
                                });
                              }
                            } catch (error: any) {
                              console.error('Error copying base case projections JSON:', error);
                              setDbMessage({
                                type: 'error',
                                text: error?.message || 'Failed to copy base case projections JSON.',
                              });
                            } finally {
                              setBaseCopyLoading(false);
                            }
                          }}
                          className="min-w-[64px] h-8 px-2 rounded-full bg-white/80 dark:bg-gray-900/60 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs shadow-sm hover:bg-white dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          title="Copy base column data as JSON"
                        >
                          {baseCopyLoading ? 'Copying...' : 'Copy'}
                          </button>
                        </div>
                        {baseCopyCopied && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-300">Copied</span>
                        )}
                      </div>
                    </th>
                    <th className="py-4 px-6 font-bold text-lg text-green-600 bg-green-50 dark:bg-green-900/20">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-2">
                          <span>Bull Case</span>
                          <button
                          type="button"
                          disabled={bullCopyLoading}
                          onClick={async () => {
                            try {
                              setBullCopyLoading(true);
                              if (!dcfData || !projections) return;
                              const bullData = {
                                case: 'bull',
                                symbol: dcfData.symbol,
                                currentPrice: dcfData.stockPrice,
                                assumptions: {
                                  revenueGrowthPercent: formData.revenueGrowth.bull,
                                  netIncomeGrowthPercent: formData.netIncomeGrowth.bull,
                                  peLow: formData.peLow.bull,
                                  peHigh: formData.peHigh.bull,
                                },
                                projections: {
                                  revenue: projections.revenue.bull,
                                  netIncome: projections.netIncome.bull,
                                  eps: projections.eps.bull,
                                  sharePriceLow: projections.sharePriceLow.bull,
                                  sharePriceHigh: projections.sharePriceHigh.bull,
                                },
                              };
                              const json = JSON.stringify(bullData, null, 2);
                              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                await navigator.clipboard.writeText(json);
                                setBullCopyCopied(true);
                                setTimeout(() => setBullCopyCopied(false), 2000);
                              } else {
                                setDbMessage({
                                  type: 'error',
                                  text: 'Could not access clipboard. Please copy the JSON manually.',
                                });
                              }
                            } catch (error: any) {
                              console.error('Error copying bull case projections JSON:', error);
                              setDbMessage({
                                type: 'error',
                                text: error?.message || 'Failed to copy bull case projections JSON.',
                              });
                            } finally {
                              setBullCopyLoading(false);
                            }
                          }}
                          className="min-w-[64px] h-8 px-2 rounded-full bg-white/80 dark:bg-gray-900/60 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-300 flex items-center justify-center text-xs shadow-sm hover:bg-white dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          title="Copy bull column data as JSON"
                        >
                          {bullCopyLoading ? 'Copying...' : 'Copy'}
                          </button>
                        </div>
                        {bullCopyCopied && (
                          <span className="text-[11px] text-green-700 dark:text-green-300">Copied</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg text-white">Revenue</td>
                    <td className="py-4 px-6 text-center">
                      {projections.revenue.bear.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.revenue.base.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.revenue.bull.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* Net Income Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg text-white">Net Income</td>
                    <td className="py-4 px-6 text-center">
                      {projections.netIncome.bear.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.netIncome.base.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.netIncome.bull.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* EPS Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg text-white">EPS</td>
                    <td className="py-4 px-6 text-center">
                      {projections.eps.bear.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.eps.base.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.eps.bull.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* Share Price Low Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg text-white">Share Price Low</td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceLow.bear.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceLow.base.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceLow.bull.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* Share Price High Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg text-white">Share Price High</td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceHigh.bear.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceHigh.base.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceHigh.bull.map((value, index) => (
                        <div key={index} className="text-white font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
