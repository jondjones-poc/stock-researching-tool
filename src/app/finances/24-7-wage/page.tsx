'use client';

import React, { useEffect, useState } from 'react';

interface IncomeType {
  id: number;
  name: string;
  hexcolour?: string | null;
  Is247wage?: boolean | null;
}

interface IncomeSource {
  id: number;
  name: string;
  income_type_id: number;
  income_type_name: string;
}

interface IncomeEntry {
  id: number;
  income_source_id: number;
  add_date: string;
  price: number | string;
  income_source_name: string;
  income_type_id: number;
  income_type_name: string;
  account_id?: number | null;
  year: number | string;
  month: number | string;
  current_month_balance?: number | string | null;
  previous_month_balance?: number | string | null;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];

export default function Wage247Page() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    year: selectedYear,
    month: ''
  });
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<{ sourceId: number; month: number; entryId?: number } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Fetch available years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/income-entries/years');
        if (!response.ok) throw new Error('Failed to fetch years');
        const data = await response.json();
        setAvailableYears(data.years || []);
        if (data.years && data.years.length > 0) {
          setSelectedYear(Math.max(...data.years));
        } else {
          // If no years in database, default to current year
          const currentYear = new Date().getFullYear();
          setAvailableYears([currentYear]);
          setSelectedYear(currentYear);
        }
      } catch (err: any) {
        console.error('Error fetching years:', err);
        const currentYear = new Date().getFullYear();
        setAvailableYears([currentYear, currentYear - 1]);
      }
    };
    fetchYears();
  }, []);

  // Fetch income types
  useEffect(() => {
    const fetchIncomeTypes = async () => {
      try {
        const response = await fetch('/api/income-types');
        if (!response.ok) throw new Error('Failed to fetch income types');
        const data = await response.json();
        setIncomeTypes(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income types:', err);
        setError('Failed to load income types');
      }
    };
    fetchIncomeTypes();
  }, []);

  // Fetch income sources
  useEffect(() => {
    const fetchIncomeSources = async () => {
      try {
        const response = await fetch('/api/income-sources');
        if (!response.ok) throw new Error('Failed to fetch income sources');
        const data = await response.json();
        setIncomeSources(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income sources:', err);
        setError('Failed to load income sources');
      }
    };
    fetchIncomeSources();
  }, []);

  // Update newEntry year when selectedYear changes
  useEffect(() => {
    setNewEntry(prev => ({ ...prev, year: selectedYear }));
  }, [selectedYear]);

  // Fetch income entries for selected year
  useEffect(() => {
    const fetchIncomeEntries = async () => {
      if (!selectedYear) return;
      
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/income-entries?year=${selectedYear}`);
        if (!response.ok) throw new Error('Failed to fetch income entries');
        const data = await response.json();
        setIncomeEntries(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income entries:', err);
        setError('Failed to load income entries');
      } finally {
        setLoading(false);
      }
    };
    fetchIncomeEntries();
  }, [selectedYear]);

  // Get entry for a specific source and month
  const getEntry = (sourceId: number, month: number) => {
    return incomeEntries.find(
      entry => entry.income_source_id === sourceId && 
               parseInt(entry.month.toString()) === month &&
               parseInt(entry.year.toString()) === selectedYear
    );
  };

  // Calculate total for an income type and month
  const getTypeTotal = (typeId: number, month: number) => {
    const sources = sourcesByType[typeId] || [];
    return sources.reduce((total, source) => {
      const entry = getEntry(source.id, month);
      if (!entry) return total;
      
      // If entry has account_id and balance data, use account balance difference
      if (entry.account_id && entry.current_month_balance !== null && entry.current_month_balance !== undefined && entry.previous_month_balance !== null && entry.previous_month_balance !== undefined) {
        const current = parseFloat(entry.current_month_balance.toString());
        const previous = parseFloat(entry.previous_month_balance.toString());
        return total + (current - previous);
      }
      
      // Otherwise, use the price value
      return total + parseFloat(entry.price.toString());
    }, 0);
  };

  // Calculate year end average for a source (average across all 12 months)
  const getSourceYearEndAvg = (sourceId: number) => {
    let sum = 0;
    monthNames.forEach((_, monthIndex) => {
      const month = monthIndex + 1;
      const entry = getEntry(sourceId, month);
      sum += entry ? parseFloat(entry.price.toString()) : 0;
    });
    return sum / 12;
  };

  // Calculate year end total for a source (sum of all 12 months)
  const getSourceYearEndTotal = (sourceId: number) => {
    let total = 0;
    monthNames.forEach((_, monthIndex) => {
      const month = monthIndex + 1;
      const entry = getEntry(sourceId, month);
      total += entry ? parseFloat(entry.price.toString()) : 0;
    });
    return total;
  };

  // Calculate year end average for an income type (average across all 12 months)
  const getTypeYearEndAvg = (typeId: number) => {
    let sum = 0;
    monthNames.forEach((_, monthIndex) => {
      const month = monthIndex + 1;
      sum += getTypeTotal(typeId, month);
    });
    return sum / 12;
  };

  // Calculate year end total for an income type (sum of all 12 months)
  const getTypeYearEndTotal = (typeId: number) => {
    let total = 0;
    monthNames.forEach((_, monthIndex) => {
      const month = monthIndex + 1;
      total += getTypeTotal(typeId, month);
    });
    return total;
  };

  // Get value for a source/month (account balance diff if account_id exists, otherwise price)
  const getSourceValue = (sourceId: number, month: number) => {
    const entry = getEntry(sourceId, month);
    if (!entry) return 0;
    
    // If entry has account_id and balance data, use account balance difference
    if (entry.account_id && entry.current_month_balance !== null && entry.current_month_balance !== undefined && entry.previous_month_balance !== null && entry.previous_month_balance !== undefined) {
      const current = parseFloat(entry.current_month_balance.toString());
      const previous = parseFloat(entry.previous_month_balance.toString());
      return current - previous;
    }
    
    // Otherwise, use the price value
    return parseFloat(entry.price.toString());
  };

  // Get breakdown of income types for 24/7 Wage for a month
  const get247WageBreakdown = (month: number) => {
    const breakdown: { name: string; value: number }[] = [];
    incomeTypes.forEach(type => {
      if (type.Is247wage === true) {
        const total = getTypeTotal(type.id, month);
        if (total > 0) {
          breakdown.push({ name: type.name, value: total });
        }
      }
    });
    return breakdown;
  };

  // Get breakdown of income types for Not Working Income for a month
  const getNotWorkingIncomeBreakdown = (month: number) => {
    const breakdown: { name: string; value: number }[] = [];
    incomeTypes.forEach(type => {
      if (type.Is247wage !== true) {
        const total = getTypeTotal(type.id, month);
        if (total > 0) {
          breakdown.push({ name: type.name, value: total });
        }
      }
    });
    return breakdown;
  };

  // Calculate 24/7 Wage hourly rate for a month (sum of all types with Is247wage = true, divided by 730)
  const get247WageHourly = (month: number) => {
    let sum = 0;
    incomeTypes.forEach(type => {
      // Only include types where Is247wage is explicitly true
      if (type.Is247wage === true) {
        sum += getTypeTotal(type.id, month);
      }
    });
    return sum / 730;
  };

  // Calculate Not Working Income total for a month (sum of all types where Is247wage is NOT true)
  const getNotWorkingIncomeTotal = (month: number) => {
    let sum = 0;
    incomeTypes.forEach(type => {
      // Include types where Is247wage is false, null, or undefined (anything that's not explicitly true)
      if (type.Is247wage !== true) {
        sum += getTypeTotal(type.id, month);
      }
    });
    return sum;
  };

  // Get breakdown of all income types for a month (for Totals row)
  const getAllTypesBreakdown = (month: number) => {
    const breakdown: { name: string; value: number }[] = [];
    incomeTypes.forEach(type => {
      const total = getTypeTotal(type.id, month);
      if (total > 0) {
        breakdown.push({ name: type.name, value: total });
      }
    });
    return breakdown;
  };

  // Calculate total for all income types for a month
  const getAllTypesTotal = (month: number) => {
    let total = 0;
    incomeTypes.forEach(type => {
      total += getTypeTotal(type.id, month);
    });
    return total;
  };

  // Handle add entries for all sources for a month
  const handleAddEntries = async () => {
    if (!newEntry.year || !newEntry.month) {
      alert('Please select both year and month');
      return;
    }

    setSaving(true);
    try {
      const monthNumber = monthNames.indexOf(newEntry.month) + 1;
      const addDate = `${newEntry.year}-${String(monthNumber).padStart(2, '0')}-01`;
      
      // Create entries for ALL sources (API will handle duplicates)
      const promises = incomeSources.map(source => {
        return fetch('/api/income-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            income_source_id: source.id,
            add_date: addDate,
            price: 0
          })
        });
      });

      const responses = await Promise.all(promises);
      const errors = responses.filter(r => !r.ok);
      
      if (errors.length > 0) {
        const errorMessages = await Promise.all(
          errors.map(async (r) => {
            try {
              const err = await r.json();
              return err.error || 'Unknown error';
            } catch {
              return 'Unknown error';
            }
          })
        );
        console.error('Errors creating entries:', errorMessages);
        // Don't throw - some entries may have succeeded
      }

      // Always refresh entries for the year that was added to
      const entriesResponse = await fetch(`/api/income-entries?year=${newEntry.year}`);
      if (entriesResponse.ok) {
        const data = await entriesResponse.json();
        setIncomeEntries(data.data || []);
        
        // If we added entries for a different year, switch to that year
        if (newEntry.year !== selectedYear) {
          setSelectedYear(newEntry.year);
          // Also update available years if needed
          if (!availableYears.includes(newEntry.year)) {
            setAvailableYears([...availableYears, newEntry.year].sort((a, b) => b - a));
          }
        }
      } else {
        throw new Error('Failed to refresh entries after adding');
      }

      // Reset form
      setNewEntry({ year: selectedYear, month: '' });
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Error adding entries:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle double-click to edit
  const handleCellDoubleClick = (sourceId: number, month: number) => {
    const entry = getEntry(sourceId, month);
    if (entry) {
      setEditingCell({ sourceId, month, entryId: entry.id });
      setEditingValue(parseFloat(entry.price.toString()).toString());
    }
  };

  // Handle save edited value
  const handleSaveEdit = async () => {
    if (!editingCell || !editingValue) return;

    const price = parseFloat(editingValue);
    if (isNaN(price)) {
      alert('Please enter a valid number');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/income-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCell.entryId,
          price: price
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update entry');
      }

      // Refresh entries
      const entriesResponse = await fetch(`/api/income-entries?year=${selectedYear}`);
      if (entriesResponse.ok) {
        const data = await entriesResponse.json();
        setIncomeEntries(data.data || []);
      }

      setEditingCell(null);
      setEditingValue('');
    } catch (err: any) {
      console.error('Error updating entry:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // Group income sources by type
  const sourcesByType = incomeTypes.reduce((acc, type) => {
    acc[type.id] = incomeSources.filter(source => source.income_type_id === type.id);
    return acc;
  }, {} as Record<number, IncomeSource[]>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-2 sm:px-4 lg:px-6">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg pointer-events-none whitespace-pre-line"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {tooltip.text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      )}
      <div className="w-full">
        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Entries for Month</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will create entries for all income sources with a default value of £0.00
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Year
                  </label>
                  <select
                    value={newEntry.year}
                    onChange={(e) => setNewEntry({ ...newEntry, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Month
                  </label>
                  <select
                    value={newEntry.month}
                    onChange={(e) => setNewEntry({ ...newEntry, month: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select month</option>
                    {monthNames.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewEntry({ year: selectedYear, month: '' });
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEntries}
                  disabled={saving || !newEntry.month}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Adding...' : 'Add Entries'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Year Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-4 py-2 font-semibold transition-colors border-b-2 ${
                    selectedYear === year
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Entry
            </button>
          </div>
        </div>

        {/* Data Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400">Error: {error}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 dark:bg-gray-700">
                  </th>
                  {monthNames.map((month) => (
                    <th
                      key={month}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                    >
                      {month}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap bg-gray-100 dark:bg-gray-600">
                    Year End Avg
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap bg-gray-100 dark:bg-gray-600">
                    Year End Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {incomeTypes.map((type) => {
                  const sources = sourcesByType[type.id] || [];
                  return (
                    <React.Fragment key={type.id}>
                      {/* Income Type Header Row */}
                      {(() => {
                        const bgColor = type.hexcolour ? (type.hexcolour.startsWith('#') ? type.hexcolour : `#${type.hexcolour}`) : undefined;
                        return (
                          <tr style={{ backgroundColor: bgColor }}>
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white sticky left-0 z-10" style={{ backgroundColor: bgColor }}>
                              {type.name}
                            </td>
                            {monthNames.map((month, monthIndex) => (
                              <td key={`${type.id}-header-${monthIndex}`} className="px-4 py-3" style={{ backgroundColor: bgColor }}></td>
                            ))}
                            <td key={`${type.id}-header-avg`} className="px-4 py-3" style={{ backgroundColor: bgColor }}></td>
                            <td key={`${type.id}-header-total`} className="px-4 py-3" style={{ backgroundColor: bgColor }}></td>
                          </tr>
                        );
                      })()}
                      {/* Income Source Rows */}
                      {sources.map((source) => {
                        const yearEndAvg = getSourceYearEndAvg(source.id);
                        const yearEndTotal = getSourceYearEndTotal(source.id);
                        
                        return (
                          <tr key={source.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 pl-8 text-gray-700 dark:text-gray-300 sticky left-0 z-10 bg-white dark:bg-gray-800">
                              {source.name}
                            </td>
                          {monthNames.map((_, monthIndex) => {
                            const month = monthIndex + 1;
                            const entry = getEntry(source.id, month);
                            const hasEntry = !!entry;
                            const isEditing = editingCell?.sourceId === source.id && editingCell?.month === month;
                            
                            // Calculate account balance difference if account is linked
                            let accountBalanceDiff: number | null = null;
                            let hasAccountBalance = false;
                            if (entry && entry.account_id) {
                              if (entry.current_month_balance !== null && entry.current_month_balance !== undefined && entry.previous_month_balance !== null && entry.previous_month_balance !== undefined) {
                                const current = parseFloat(entry.current_month_balance.toString());
                                const previous = parseFloat(entry.previous_month_balance.toString());
                                accountBalanceDiff = current - previous;
                                hasAccountBalance = true;
                              }
                              // If account is linked but no balance data, hasAccountBalance stays false (will show £0.00 in yellow)
                            }
                            
                            // Check if value is from account balance (not editable)
                            const isFromAccountBalance = entry && entry.account_id && hasAccountBalance;
                            const isEditable = hasEntry && !isFromAccountBalance;
                            
                            return (
                              <td
                                key={`${source.id}-${month}`}
                                onDoubleClick={() => isEditable && handleCellDoubleClick(source.id, month)}
                                className={`px-4 py-3 text-center text-sm whitespace-nowrap ${
                                  hasEntry
                                    ? isEditable
                                      ? 'text-gray-900 dark:text-white cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                      : 'text-gray-900 dark:text-white cursor-default'
                                    : 'text-gray-400 dark:text-gray-600 opacity-50'
                                } ${isEditing ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                              >
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={handleSaveEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveEdit();
                                        } else if (e.key === 'Escape') {
                                          handleCancelEdit();
                                        }
                                      }}
                                      className="w-24 px-2 py-1 border border-blue-500 rounded text-center text-sm"
                                      autoFocus
                                    />
                                  </div>
                                ) : entry && entry.account_id ? (
                                  <div 
                                    className={`text-sm whitespace-nowrap relative ${
                                      hasAccountBalance && accountBalanceDiff !== null
                                        ? accountBalanceDiff > 0 
                                          ? 'text-green-600 dark:text-green-400' 
                                          : accountBalanceDiff < 0
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-yellow-600 dark:text-yellow-400'
                                    }`}
                                    onMouseEnter={(e) => {
                                      if (hasAccountBalance && accountBalanceDiff !== null) {
                                        // Get current month and year
                                        const currentMonth = parseInt(entry.month.toString());
                                        const currentYear = parseInt(entry.year.toString());
                                        
                                        // Calculate previous month and year
                                        let prevMonth = currentMonth - 1;
                                        let prevYear = currentYear;
                                        if (prevMonth < 1) {
                                          prevMonth = 12;
                                          prevYear = currentYear - 1;
                                        }
                                        
                                        // Format as MM/YY
                                        const currentMonthStr = String(currentMonth).padStart(2, '0');
                                        const currentYearStr = String(currentYear).slice(-2);
                                        const prevMonthStr = String(prevMonth).padStart(2, '0');
                                        const prevYearStr = String(prevYear).slice(-2);
                                        
                                        const currentBalance = entry.current_month_balance !== null && entry.current_month_balance !== undefined ? parseFloat(entry.current_month_balance.toString()) : 0;
                                        const previousBalance = entry.previous_month_balance !== null && entry.previous_month_balance !== undefined ? parseFloat(entry.previous_month_balance.toString()) : 0;
                                        
                                        const tooltipText = `Account Balance Calculation:\n${currentMonthStr}/${currentYearStr} Balance: £${currentBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n${prevMonthStr}/${prevYearStr} Balance: £${previousBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nDifference: ${accountBalanceDiff >= 0 ? '+' : ''}£${accountBalanceDiff.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                        setTooltip({
                                          x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                                          y: e.currentTarget.getBoundingClientRect().top - 10,
                                          text: tooltipText
                                        });
                                      } else if (entry.account_id) {
                                        setTooltip({
                                          x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                                          y: e.currentTarget.getBoundingClientRect().top - 10,
                                          text: 'Account linked but no balance data available for this month'
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                  >
                                    {hasAccountBalance && accountBalanceDiff !== null
                                      ? `${accountBalanceDiff >= 0 ? '+' : ''}£${accountBalanceDiff.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : '£0.00'
                                    }
                                  </div>
                                ) : hasEntry ? (
                                  `£${parseFloat(entry.price.toString()).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                ) : (
                                  '£0.00'
                                )}
                              </td>
                            );
                          })}
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 whitespace-nowrap">
                              £{yearEndAvg.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 whitespace-nowrap">
                              £{yearEndTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals Row */}
                      {(() => {
                        const bgColor = type.hexcolour ? (type.hexcolour.startsWith('#') ? `${type.hexcolour}CC` : `#${type.hexcolour}CC`) : undefined;
                        return (
                          <tr className="font-semibold" style={{ backgroundColor: bgColor }}>
                            <td className="px-4 py-3 pl-8 text-gray-900 dark:text-white sticky left-0 z-10" style={{ backgroundColor: bgColor }}>
                              Total
                            </td>
                            {monthNames.map((_, monthIndex) => {
                              const month = monthIndex + 1;
                              const total = getTypeTotal(type.id, month);
                              
                              return (
                                <td
                                  key={`total-${type.id}-${month}`}
                                  className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white whitespace-nowrap"
                                  style={{ backgroundColor: bgColor }}
                                >
                                  £{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white whitespace-nowrap" style={{ backgroundColor: bgColor }}>
                              £{getTypeYearEndAvg(type.id).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white whitespace-nowrap" style={{ backgroundColor: bgColor }}>
                              £{getTypeYearEndTotal(type.id).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
                {/* Bottom Summary Rows */}
                {/* Empty Row */}
                <tr className="border-t-4 border-gray-400 dark:border-gray-500">
                  <td className="px-4 py-3 sticky left-0 z-10 bg-gray-50 dark:bg-gray-700"></td>
                  {monthNames.map((_, monthIndex) => (
                    <td key={`empty-${monthIndex}`} className="px-4 py-3 bg-gray-50 dark:bg-gray-700"></td>
                  ))}
                  <td className="px-4 py-3 bg-gray-50 dark:bg-gray-700"></td>
                  <td className="px-4 py-3 bg-gray-50 dark:bg-gray-700"></td>
                </tr>
                {/* 24/7 Wage Row */}
                <tr className="font-bold bg-gray-200 dark:bg-gray-600">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    24/7 Wage
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const wage247 = get247WageHourly(month);
                    const breakdown = get247WageBreakdown(month);
                    const total = breakdown.reduce((sum, item) => sum + item.value, 0);
                    return (
                      <td 
                        key={`247-${month}`} 
                        className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap cursor-help"
                        onMouseEnter={(e) => {
                          if (breakdown.length > 0) {
                            const breakdownText = breakdown.map(item => 
                              `${item.name}: £${item.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ).join('\n');
                            const tooltipText = `24/7 Wage Calculation (${monthNames[monthIndex]}):\n${breakdownText}\n\nTotal: £${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nHourly Rate (÷730): £${wage247.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            setTooltip({
                              x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                              y: e.currentTarget.getBoundingClientRect().top - 10,
                              text: tooltipText
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        £{wage247.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    {(() => {
                      let sum = 0;
                      monthNames.forEach((_, monthIndex) => {
                        const month = monthIndex + 1;
                        sum += get247WageHourly(month);
                      });
                      return `£${(sum / 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    {(() => {
                      let sum = 0;
                      monthNames.forEach((_, monthIndex) => {
                        const month = monthIndex + 1;
                        sum += get247WageHourly(month);
                      });
                      return `£${(sum * 730).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                </tr>
                {/* Not Working Income Row */}
                <tr className="font-bold bg-gray-200 dark:bg-gray-600">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    Not Working Income
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const incomeNotWorking = getNotWorkingIncomeTotal(month);
                    const breakdown = getNotWorkingIncomeBreakdown(month);
                    return (
                      <td 
                        key={`notworking-${month}`} 
                        className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap cursor-help"
                        onMouseEnter={(e) => {
                          if (breakdown.length > 0) {
                            const breakdownText = breakdown.map(item => 
                              `${item.name}: £${item.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ).join('\n');
                            const tooltipText = `Not Working Income Calculation (${monthNames[monthIndex]}):\n${breakdownText}\n\nTotal: £${incomeNotWorking.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            setTooltip({
                              x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                              y: e.currentTarget.getBoundingClientRect().top - 10,
                              text: tooltipText
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        £{incomeNotWorking.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    {(() => {
                      let sum = 0;
                      monthNames.forEach((_, monthIndex) => {
                        const month = monthIndex + 1;
                        sum += getNotWorkingIncomeTotal(month);
                      });
                      return `£${(sum / 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    {(() => {
                      let sum = 0;
                      monthNames.forEach((_, monthIndex) => {
                        const month = monthIndex + 1;
                        sum += getNotWorkingIncomeTotal(month);
                      });
                      return `£${sum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                </tr>
                {/* Totals Row */}
                <tr className="font-bold bg-gray-300 dark:bg-gray-500 border-t-2 border-gray-400 dark:border-gray-500">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-300 dark:bg-gray-500 whitespace-nowrap">
                    Totals
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const total = getAllTypesTotal(month);
                    const breakdown = getAllTypesBreakdown(month);
                    return (
                      <td 
                        key={`total-all-${month}`} 
                        className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-300 dark:bg-gray-500 whitespace-nowrap cursor-help"
                        onMouseEnter={(e) => {
                          if (breakdown.length > 0) {
                            const breakdownText = breakdown.map(item => 
                              `${item.name}: £${item.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ).join('\n');
                            const tooltipText = `Totals Calculation (${monthNames[monthIndex]}):\n${breakdownText}\n\nTotal: £${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            setTooltip({
                              x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                              y: e.currentTarget.getBoundingClientRect().top - 10,
                              text: tooltipText
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        £{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-300 dark:bg-gray-500 whitespace-nowrap">
                    {(() => {
                      let sum = 0;
                      monthNames.forEach((_, monthIndex) => {
                        const month = monthIndex + 1;
                        sum += getAllTypesTotal(month);
                      });
                      return `£${(sum / 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-300 dark:bg-gray-500 whitespace-nowrap">
                    {(() => {
                      let sum = 0;
                      monthNames.forEach((_, monthIndex) => {
                        const month = monthIndex + 1;
                        sum += getAllTypesTotal(month);
                      });
                      return `£${sum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
