'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Account {
  id: number;
  name: string;
  url: string | null;
  investment_type_id: number | null;
  investment_type_name: string | null;
  investment_type_colour: string | null;
  investment_type_order: number | null;
}

interface MonthlyAccountBalance {
  id: number;
  account_id: number;
  account_name: string;
  account_category: string | null;
  balance_date: string;
  balance: number;
  year: number;
  month: number;
}

export default function FinancesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyAccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ month: string; accountName: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingRow, setEditingRow] = useState<string | null>(null); // Track which row is being edited
  const [rowEditValues, setRowEditValues] = useState<Map<string, string>>(new Map()); // Store all values for row editing
  const [expandedEditRow, setExpandedEditRow] = useState<string | null>(null); // Track which row has expanded edit section
  const [expandedEditValues, setExpandedEditValues] = useState<Map<string, string>>(new Map()); // Store values for expanded edit
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [newMonth, setNewMonth] = useState<string>(new Date().toLocaleString('default', { month: 'long' }));
  const [newMonthYear, setNewMonthYear] = useState<number>(new Date().getFullYear());
  const [selectedInvestmentTypes, setSelectedInvestmentTypes] = useState<Set<string>>(new Set()); // Track selected investment types
  const [moveMonth, setMoveMonth] = useState<string | null>(null); // Track which month is being moved
  const [moveTargetMonth, setMoveTargetMonth] = useState<string>('');
  const [moveTargetYear, setMoveTargetYear] = useState<number>(new Date().getFullYear());

  // Handle query parameters for navigation from networth report
  useEffect(() => {
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const editParam = searchParams.get('edit');
    
    if (yearParam) {
      const year = parseInt(yearParam);
      if (!isNaN(year)) {
        setSelectedYear(year);
      }
    }
    
    if (monthParam && editParam === 'true') {
      // Set the expanded edit row to the month name
      setExpandedEditRow(monthParam);
    }
  }, [searchParams]);

  // Fetch available years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/monthly-account-balances/years');
        if (!response.ok) throw new Error('Failed to fetch years');
        const data = await response.json();
        setAvailableYears(data.years || []);
        // Set default year to the most recent available year (only if not set by query param)
        if (data.years && data.years.length > 0 && !searchParams.get('year')) {
          setSelectedYear(Math.max(...data.years));
        }
      } catch (err: any) {
        console.error('Error fetching years:', err);
        // Default to current year if API fails
        setAvailableYears([new Date().getFullYear(), new Date().getFullYear() - 1]);
      }
    };
    fetchYears();
  }, [searchParams]);

  // Fetch accounts for column headings
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) throw new Error('Failed to fetch accounts');
        const data = await response.json();
        // Sort accounts by investment_type_order, then by name
        const sortedAccounts = (data.data || []).sort((a: Account, b: Account) => {
          const orderA = a.investment_type_order ?? 999;
          const orderB = b.investment_type_order ?? 999;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return a.name.localeCompare(b.name);
        });
        setAccounts(sortedAccounts);
      } catch (err: any) {
        console.error('Error fetching accounts:', err);
        setError('Failed to load accounts');
      }
    };
    fetchAccounts();
  }, []);

  // Fetch monthly account balances data for selected year
  useEffect(() => {
    const fetchMonthlyData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/monthly-account-balances?year=${selectedYear}`);
        if (!response.ok) throw new Error('Failed to fetch monthly account balances');
        const data = await response.json();
        setMonthlyData(data.data || []);
      } catch (err: any) {
        console.error('Error fetching monthly account balances:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (selectedYear) {
      fetchMonthlyData();
    }
  }, [selectedYear]);

  // Group data by month and pivot by account
  const pivotData = (accountsToUse: Account[]) => {
    const monthMap = new Map<string, Map<string, { balance: number; id: number; account_id: number; balance_date: string }>>();
    
    // Initialize all 12 months for the selected year with default 0 values
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // If there's any data for this year, show all 12 months with default 0.00 values
    if (monthlyData.length > 0 && accountsToUse.length > 0) {
      monthOrder.forEach(monthName => {
        if (!monthMap.has(monthName)) {
          monthMap.set(monthName, new Map());
        }
        
        // Initialize all accounts with 0 for this month
        accountsToUse.forEach(account => {
          const accountMap = monthMap.get(monthName)!;
          // Only set default if no data exists for this account/month
          if (!accountMap.has(account.name)) {
            accountMap.set(account.name, {
              balance: 0,
              id: 0, // No database entry yet
              account_id: account.id,
              balance_date: (() => {
                const monthNum = monthOrder.indexOf(monthName) + 1;
                return `${selectedYear}-${String(monthNum).padStart(2, '0')}-01`;
              })(),
            });
          }
        });
      });
    }
    
    // Override with actual database values (this will replace the defaults)
    monthlyData.forEach(item => {
      const date = new Date(item.balance_date);
      const monthKey = date.toLocaleString('default', { month: 'long' });
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, new Map());
      }
      
      const accountMap = monthMap.get(monthKey)!;
      accountMap.set(item.account_name, {
        balance: item.balance,
        id: item.id,
        account_id: item.account_id,
        balance_date: item.balance_date,
      });
    });

    // Return all 12 months if we have data for the year, otherwise return only months with data
    const months = monthlyData.length > 0 && accountsToUse.length > 0
      ? monthOrder 
      : Array.from(monthMap.keys()).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

    return { monthMap, months };
  };

  // Get current month name
  const getCurrentMonthName = () => {
    return new Date().toLocaleString('default', { month: 'long' });
  };

  const isCurrentMonth = (month: string) => {
    const currentMonth = getCurrentMonthName();
    const currentYear = new Date().getFullYear();
    return month === currentMonth && selectedYear === currentYear;
  };

  // Check if a month row has any database entries
  const hasDatabaseEntries = (month: string) => {
    const accountMap = monthMap.get(month);
    if (!accountMap) return false;
    
    // Check if any filtered account in this month has a non-zero id (meaning it's from database)
    for (const account of filteredAccounts) {
      const balanceData = accountMap.get(account.name);
      if (balanceData && balanceData.id !== 0) {
        return true;
      }
    }
    return false;
  };

  // Get unique investment types from accounts, sorted by order
  const investmentTypes = Array.from(
    new Map(
      accounts
        .filter(acc => acc.investment_type_name)
        .map(acc => [
          acc.investment_type_name!,
          {
            name: acc.investment_type_name!,
            colour: acc.investment_type_colour || '#6B7280',
            order: acc.investment_type_order ?? 999,
          }
        ])
    ).values()
  ).sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name);
  });

  // Filter accounts based on selected investment types
  const filteredAccounts = selectedInvestmentTypes.size === 0
    ? accounts
    : accounts.filter(acc => 
        acc.investment_type_name && selectedInvestmentTypes.has(acc.investment_type_name)
      );

  // Toggle investment type filter
  const toggleInvestmentTypeFilter = (typeName: string) => {
    const newSelected = new Set(selectedInvestmentTypes);
    if (newSelected.has(typeName)) {
      newSelected.delete(typeName);
    } else {
      newSelected.add(typeName);
    }
    setSelectedInvestmentTypes(newSelected);
  };

  const { monthMap, months } = pivotData(filteredAccounts);

  // Handle cell edit (single cell)
  const handleCellClick = (month: string, accountName: string, currentValue: number | undefined) => {
    // Don't start single cell edit if row is being edited
    if (editingRow === month) return;
    
    if (isCurrentMonth(month)) {
      setEditingCell({ month, accountName });
      setEditingValue(currentValue !== undefined ? currentValue.toString() : '0');
    }
  };

  // Handle row double-click to edit entire row
  const handleRowDoubleClick = (month: string) => {
    if (!isCurrentMonth(month)) return;
    
    setEditingRow(month);
    setEditingCell(null); // Clear single cell edit
    
    // Initialize all values for this row
    const accountMap = monthMap.get(month);
    const values = new Map<string, string>();
    
    filteredAccounts.forEach(account => {
      const balanceData = accountMap?.get(account.name);
      const balance = balanceData?.balance;
      values.set(account.name, balance !== undefined ? balance.toString() : '0');
    });
    
    setRowEditValues(values);
  };

  // Handle row edit value change
  const handleRowValueChange = (accountName: string, value: string) => {
    const newValues = new Map(rowEditValues);
    newValues.set(accountName, value);
    setRowEditValues(newValues);
  };

  // Handle row save (save all values in the row)
  const handleRowSave = async (month: string) => {
    if (!editingRow || editingRow !== month) return;

    setSaving(true);
    setMessage(null);

    try {
      // Get the month date (first day of the month)
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthOrder.indexOf(month);
      if (monthIndex === -1) {
        throw new Error('Invalid month');
      }

      // Format date as YYYY-MM-DD without timezone conversion issues
      const monthNum = monthIndex + 1; // Convert to 1-indexed month (1-12)
      const balanceDate = `${selectedYear}-${String(monthNum).padStart(2, '0')}-01`;

      // Prepare all balances for this row
      const balances: Array<{ account_id: number; balance_date: string; balance: number }> = [];
      const updates: Array<{ id: number; balance: number }> = [];

      const accountMap = monthMap.get(month);

      filteredAccounts.forEach(account => {
        const valueStr = rowEditValues.get(account.name) || '0';
        const balanceValue = parseFloat(valueStr.replace(/[£,]/g, '')) || 0;
        
        const existingEntry = accountMap?.get(account.name);
        
        if (existingEntry && existingEntry.id) {
          // Update existing
          updates.push({ id: existingEntry.id, balance: balanceValue });
        } else {
          // Create new
          balances.push({
            account_id: account.id,
            balance_date: balanceDate,
            balance: balanceValue,
          });
        }
      });

      // Perform updates
      const updatePromises = updates.map(update =>
        fetch(`/api/monthly-account-balances?id=${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balance: update.balance }),
        })
      );

      // Perform inserts (if any)
      if (balances.length > 0) {
        updatePromises.push(
          fetch('/api/monthly-account-balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balances }),
          })
        );
      }

      const responses = await Promise.all(updatePromises);
      
      // Check if all succeeded
      const allOk = responses.every(r => r.ok);
      if (!allOk) {
        const errorData = await responses.find(r => !r.ok)?.json();
        throw new Error(errorData?.error || 'Failed to save some balances');
      }

      setMessage({ type: 'success', text: 'All balances saved successfully!' });
      setEditingRow(null);
      setRowEditValues(new Map());

      // Refresh data
      const dataResponse = await fetch(`/api/monthly-account-balances?year=${selectedYear}`);
      if (dataResponse.ok) {
        const data = await dataResponse.json();
        setMonthlyData(data.data || []);
      }
    } catch (err: any) {
      console.error('Error saving row balances:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save balances' });
    } finally {
      setSaving(false);
    }
  };

  // Handle row edit cancel
  const handleRowCancel = () => {
    setEditingRow(null);
    setRowEditValues(new Map());
  };

  // Handle expanded edit
  const handleExpandEdit = (month: string) => {
    if (expandedEditRow === month) {
      setExpandedEditRow(null);
      setExpandedEditValues(new Map());
    } else {
      setExpandedEditRow(month);
      const accountMap = monthMap.get(month);
      const values = new Map<string, string>();
      
      // Use all accounts, not just filtered ones, to ensure all accounts are included
      accounts.forEach(account => {
        const balanceData = accountMap?.get(account.name);
        const balance = balanceData?.balance;
        values.set(account.name, balance !== undefined ? balance.toString() : '0');
      });
      
      setExpandedEditValues(values);
    }
  };

  // Handle expanded edit value change
  const handleExpandedEditValueChange = (accountName: string, value: string) => {
    const newValues = new Map(expandedEditValues);
    newValues.set(accountName, value);
    setExpandedEditValues(newValues);
  };

  // Handle expanded edit save
  const handleExpandedEditSave = async (month: string) => {
    if (expandedEditRow !== month) return;

    setSaving(true);
    setMessage(null);

    try {
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthOrder.indexOf(month);
      if (monthIndex === -1) {
        throw new Error('Invalid month');
      }

      // Format date as YYYY-MM-DD without timezone conversion issues
      const monthNum = monthIndex + 1; // Convert to 1-indexed month (1-12)
      const balanceDate = `${selectedYear}-${String(monthNum).padStart(2, '0')}-01`;
      const accountMap = monthMap.get(month);

      const balances: Array<{ account_id: number; balance_date: string; balance: number }> = [];
      const updates: Array<{ id: number; balance: number }> = [];

      // Use all accounts, not just filtered ones, to ensure all accounts are saved
      accounts.forEach(account => {
        const valueStr = expandedEditValues.get(account.name);
        // Only process if value exists in the edit values (user may have edited it)
        if (valueStr !== undefined) {
          const balanceValue = parseFloat(valueStr.replace(/[£,]/g, '')) || 0;
          
          const existingEntry = accountMap?.get(account.name);
          
          if (existingEntry && existingEntry.id) {
            updates.push({ id: existingEntry.id, balance: balanceValue });
          } else {
            balances.push({
              account_id: account.id,
              balance_date: balanceDate,
              balance: balanceValue,
            });
          }
        }
      });

      const updatePromises = updates.map(update =>
        fetch(`/api/monthly-account-balances?id=${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balance: update.balance }),
        })
      );

      if (balances.length > 0) {
        updatePromises.push(
          fetch('/api/monthly-account-balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balances }),
          })
        );
      }

      const responses = await Promise.all(updatePromises);
      const allOk = responses.every(r => r.ok);
      if (!allOk) {
        const errorData = await responses.find(r => !r.ok)?.json();
        throw new Error(errorData?.error || 'Failed to save some balances');
      }

      setMessage({ type: 'success', text: 'All balances saved successfully!' });
      setExpandedEditRow(null);
      setExpandedEditValues(new Map());

      const dataResponse = await fetch(`/api/monthly-account-balances?year=${selectedYear}`);
      if (dataResponse.ok) {
        const data = await dataResponse.json();
        setMonthlyData(data.data || []);
      }
    } catch (err: any) {
      console.error('Error saving expanded edit:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save balances' });
    } finally {
      setSaving(false);
    }
  };

  // Handle expanded edit cancel
  const handleExpandedEditCancel = () => {
    setExpandedEditRow(null);
    setExpandedEditValues(new Map());
  };

  // Handle cell save
  const handleCellSave = async (month: string, accountName: string) => {
    if (!editingCell || editingCell.month !== month || editingCell.accountName !== accountName) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Find account ID
      const account = accounts.find(a => a.name === accountName);
      if (!account) {
        throw new Error('Account not found');
      }

      // Parse the balance value (remove £ and commas)
      const balanceValue = parseFloat(editingValue.replace(/[£,]/g, '')) || 0;

      // Get the month date (first day of the month)
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthOrder.indexOf(month);
      if (monthIndex === -1) {
        throw new Error('Invalid month');
      }

      // Format date as YYYY-MM-DD without timezone conversion issues
      const monthNum = monthIndex + 1; // Convert to 1-indexed month (1-12)
      const balanceDate = `${selectedYear}-${String(monthNum).padStart(2, '0')}-01`;

      // Check if entry exists using the monthMap
      const accountMap = monthMap.get(month);
      const existingEntry = accountMap?.get(accountName);

      let response;
      if (existingEntry && existingEntry.id) {
        // Update existing entry
        response = await fetch(`/api/monthly-account-balances?id=${existingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balance: balanceValue }),
        });
      } else {
        // Create new entry
        response = await fetch('/api/monthly-account-balances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            balances: [{
              account_id: account.id,
              balance_date: balanceDate,
              balance: balanceValue,
            }],
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save balance');
      }

      setMessage({ type: 'success', text: 'Balance saved successfully!' });
      setEditingCell(null);
      setEditingValue('');

      // Refresh data
      const dataResponse = await fetch(`/api/monthly-account-balances?year=${selectedYear}`);
      if (dataResponse.ok) {
        const data = await dataResponse.json();
        setMonthlyData(data.data || []);
      }
    } catch (err: any) {
      console.error('Error saving balance:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save balance' });
    } finally {
      setSaving(false);
    }
  };

  // Handle add new month
  // Generate last 10 years for dropdown
  const getLast10Years = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 10; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  const handleAddMonth = async () => {
    if (!newMonth || !newMonthYear) {
      setMessage({ type: 'error', text: 'Please select a month and year' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthOrder.indexOf(newMonth);
      if (monthIndex === -1) {
        throw new Error('Invalid month');
      }

      // Format date as YYYY-MM-DD without timezone conversion issues
      const monthNum = monthIndex + 1; // Convert to 1-indexed month (1-12)
      const balanceDate = `${newMonthYear}-${String(monthNum).padStart(2, '0')}-01`;

      // Create empty balances for all filtered accounts (default to 0)
      const balances = filteredAccounts.map(account => ({
        account_id: account.id,
        balance_date: balanceDate,
        balance: 0,
      }));

      const response = await fetch('/api/monthly-account-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balances }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add month');
      }

      setMessage({ type: 'success', text: 'Statement added successfully! You can now edit the values.' });
      setShowAddMonth(false);
      setNewMonth(new Date().toLocaleString('default', { month: 'long' }));
      setNewMonthYear(new Date().getFullYear());

      // Refresh years and data
      const yearsResponse = await fetch('/api/monthly-account-balances/years');
      if (yearsResponse.ok) {
        const yearsData = await yearsResponse.json();
        setAvailableYears(yearsData.years || []);
        if (yearsData.years && yearsData.years.length > 0) {
          setSelectedYear(newMonthYear);
        }
      }

      const dataResponse = await fetch(`/api/monthly-account-balances?year=${newMonthYear}`);
      if (dataResponse.ok) {
        const data = await dataResponse.json();
        setMonthlyData(data.data || []);
      }
    } catch (err: any) {
      console.error('Error adding month:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to add month' });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete month
  const handleDeleteMonth = async (month: string) => {
    if (!confirm(`Are you sure you want to delete all entries for ${month} ${selectedYear}? This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/monthly-account-balances?month=${encodeURIComponent(month)}&year=${selectedYear}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete entries');
      }

      setMessage({ type: 'success', text: data.message || 'Entries deleted successfully' });
      setExpandedEditRow(null);
      setExpandedEditValues(new Map());

      // Refresh data
      const dataResponse = await fetch(`/api/monthly-account-balances?year=${selectedYear}`);
      if (dataResponse.ok) {
        const responseData = await dataResponse.json();
        setMonthlyData(responseData.data || []);
      }

      // Refresh years
      const yearsResponse = await fetch('/api/monthly-account-balances/years');
      if (yearsResponse.ok) {
        const yearsData = await yearsResponse.json();
        if (yearsData.years && yearsData.years.length > 0) {
          setAvailableYears(yearsData.years);
        }
      }
    } catch (err: any) {
      console.error('Error deleting entries:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to delete entries' });
    } finally {
      setSaving(false);
    }
  };

  // Handle move date
  const handleMoveDate = async (sourceMonth: string) => {
    if (!moveTargetMonth || !moveTargetYear) {
      setMessage({ type: 'error', text: 'Please select a target month and year' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/monthly-account-balances/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMonth: sourceMonth,
          sourceYear: selectedYear,
          targetMonth: moveTargetMonth,
          targetYear: moveTargetYear,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to move entries');
      }

      setMessage({ type: 'success', text: data.message || 'Entries moved successfully' });
      setMoveMonth(null);
      setMoveTargetMonth('');
      setMoveTargetYear(new Date().getFullYear());

      // Refresh data
      const dataResponse = await fetch(`/api/monthly-account-balances?year=${selectedYear}`);
      if (dataResponse.ok) {
        const responseData = await dataResponse.json();
        setMonthlyData(responseData.data || []);
      }

      // Also refresh if we moved to a different year
      if (moveTargetYear !== selectedYear) {
        const yearsResponse = await fetch('/api/monthly-account-balances/years');
        if (yearsResponse.ok) {
          const yearsData = await yearsResponse.json();
          if (yearsData.years && yearsData.years.length > 0) {
            setAvailableYears(yearsData.years);
          }
        }
      }
    } catch (err: any) {
      console.error('Error moving entries:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to move entries' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full px-2 sm:px-4 lg:px-6">

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Add New Statement Form */}
        {showAddMonth && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Add New Statement
            </h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Month
                </label>
                <select
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Month</option>
                  {['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year
                </label>
                <select
                  value={newMonthYear}
                  onChange={(e) => setNewMonthYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {getLast10Years().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddMonth}
                disabled={saving || !newMonth || !newMonthYear}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {saving ? 'Adding...' : 'Add Statement'}
              </button>
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
              onClick={() => {
                if (showAddMonth) {
                  // Reset to current month and year when canceling
                  setNewMonth(new Date().toLocaleString('default', { month: 'long' }));
                  setNewMonthYear(new Date().getFullYear());
                }
                setShowAddMonth(!showAddMonth);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              {showAddMonth ? 'Cancel' : '+ Add New Statement'}
            </button>
          </div>
        </div>

        {/* Investment Type Filter Buttons */}
        {investmentTypes.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-nowrap gap-2 justify-center overflow-x-auto pb-2">
              {investmentTypes.map((type) => {
                const isSelected = selectedInvestmentTypes.has(type.name);
                return (
                  <button
                    key={type.name}
                    onClick={() => toggleInvestmentTypeFilter(type.name)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg flex-shrink-0 ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: isSelected ? type.colour : `${type.colour}80`,
                      color: '#FFFFFF',
                      border: isSelected ? `2px solid ${type.colour}` : 'none',
                    }}
                  >
                    {type.name}
                  </button>
                );
              })}
              {selectedInvestmentTypes.size > 0 && (
                <button
                  onClick={() => setSelectedInvestmentTypes(new Set())}
                  className="px-2.5 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap bg-gray-600 text-white hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg flex-shrink-0"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Data Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400">Error: {error}</div>
          </div>
        ) : months.length === 0 || filteredAccounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">
              {selectedInvestmentTypes.size > 0 
                ? 'No accounts match the selected filters' 
                : `No data available for ${selectedYear}`}
            </div>
          </div>
        ) : (
          <>
            {/* Expanded Edit Form - Outside Grid */}
            {expandedEditRow && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-opacity duration-300 animate-in fade-in">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                    Edit {expandedEditRow} {selectedYear}
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      // Group accounts by investment type - use all accounts, not just filtered ones
                      const groupedAccounts = new Map<string, { accounts: Account[]; order: number; colour: string }>();
                      
                      accounts.forEach(account => {
                        const typeName = account.investment_type_name || 'Other';
                        const typeOrder = account.investment_type_order ?? 999;
                        const typeColour = account.investment_type_colour || '#6B7280';
                        
                        if (!groupedAccounts.has(typeName)) {
                          groupedAccounts.set(typeName, {
                            accounts: [],
                            order: typeOrder,
                            colour: typeColour,
                          });
                        }
                        groupedAccounts.get(typeName)!.accounts.push(account);
                      });
                      
                      // Sort groups by order, then by name
                      const sortedGroups = Array.from(groupedAccounts.entries()).sort((a, b) => {
                        if (a[1].order !== b[1].order) {
                          return a[1].order - b[1].order;
                        }
                        return a[0].localeCompare(b[0]);
                      });
                      
                      return sortedGroups.map(([typeName, group]) => (
                        <div key={typeName} className="rounded-lg p-4" style={{ backgroundColor: `${group.colour}20` }}>
                          <h4 className="text-sm font-semibold mb-3 text-center text-white">
                            {typeName}
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            {group.accounts.map((account) => {
                              const value = expandedEditValues.get(account.name) || '0';
                              const numericValue = parseFloat(value.replace(/[£,]/g, '')) || 0;
                              const formattedValue = numericValue === 0 ? '' : `£${numericValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              
                              return (
                                <div key={account.id} className="space-y-1">
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                                    {account.name}
                                  </label>
                                  <input
                                    type="text"
                                    value={formattedValue}
                                    onChange={(e) => {
                                      // Remove currency symbols and format
                                      const rawValue = e.target.value.replace(/[£,]/g, '');
                                      handleExpandedEditValueChange(account.name, rawValue);
                                    }}
                                    onBlur={(e) => {
                                      // Format on blur
                                      const rawValue = e.target.value.replace(/[£,]/g, '');
                                      const numValue = parseFloat(rawValue) || 0;
                                      handleExpandedEditValueChange(account.name, numValue.toString());
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                                    placeholder="£0.00"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex justify-center gap-3 pt-4 border-t border-gray-300 dark:border-gray-600">
                    <button
                      onClick={() => expandedEditRow && handleExpandedEditSave(expandedEditRow)}
                      disabled={saving}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        if (expandedEditRow) {
                          setMoveMonth(expandedEditRow);
                          setMoveTargetMonth('');
                          setMoveTargetYear(new Date().getFullYear());
                        }
                      }}
                      disabled={saving || !expandedEditRow}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => expandedEditRow && handleDeleteMonth(expandedEditRow)}
                      disabled={saving || !expandedEditRow}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                    >
                      Delete
                    </button>
                    <button
                      onClick={handleExpandedEditCancel}
                      disabled={saving}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                  {moveMonth === expandedEditRow && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Move {expandedEditRow} to:
                      </div>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Month
                          </label>
                          <select
                            value={moveTargetMonth}
                            onChange={(e) => setMoveTargetMonth(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Select Month</option>
                            {['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Year
                          </label>
                          <input
                            type="number"
                            value={moveTargetYear}
                            onChange={(e) => setMoveTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            min="2020"
                            max="2100"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => expandedEditRow && handleMoveDate(expandedEditRow)}
                            disabled={saving || !moveTargetMonth || !moveTargetYear}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => {
                              setMoveMonth(null);
                              setMoveTargetMonth('');
                              setMoveTargetYear(new Date().getFullYear());
                            }}
                            disabled={saving}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Data Grid */}
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 overflow-x-auto w-full transition-opacity duration-300 ${
              expandedEditRow ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                    Month
                  </th>
                  {filteredAccounts.map((account) => {
                    const headerColor = account.investment_type_colour || '#6B7280'; // Default gray if no color
                    return (
                      <th
                        key={account.id}
                        className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                        style={{ 
                          backgroundColor: headerColor,
                          color: '#FFFFFF'
                        }}
                      >
                        {account.name}
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {months.map((month) => {
                  const accountMap = monthMap.get(month)!;
                  const isRowEditing = editingRow === month;
                  const canEdit = isCurrentMonth(month);
                  const hasDbEntries = hasDatabaseEntries(month);
                  const isDisabled = !hasDbEntries;
                  const isExpandedEdit = expandedEditRow === month;
                  
                  return (
                    <tr 
                      key={month} 
                      onDoubleClick={() => canEdit && hasDbEntries && handleRowDoubleClick(month)}
                      className={`transition-opacity duration-300 ${
                        isDisabled 
                          ? 'opacity-50 bg-gray-50 dark:bg-gray-900/50' 
                          : 'opacity-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                      } ${
                        isRowEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      } ${canEdit && hasDbEntries ? 'cursor-pointer' : ''}`}
                      title={canEdit && hasDbEntries ? 'Double-click to edit entire row' : isDisabled ? 'Add new statement to enable editing' : ''}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-center sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center gap-2">
                          {month}
                          {isRowEditing && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowSave(month);
                                }}
                                disabled={saving}
                                className="text-green-600 dark:text-green-400 hover:text-green-700 disabled:opacity-50 text-xs"
                                title="Save all"
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowCancel();
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 text-xs"
                                title="Cancel"
                              >
                                ✕ Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      {filteredAccounts.map((account) => {
                        const balanceData = accountMap.get(account.name);
                        const balance = balanceData?.balance;
                        const hasDbEntry = balanceData && balanceData.id !== 0;
                        const isNegative = balance !== undefined && balance < 0;
                        const isPositive = balance !== undefined && balance > 0;
                        const isCellEditing = editingCell?.month === month && editingCell?.accountName === account.name;
                        const isRowEditing = editingRow === month;
                        const canEdit = isCurrentMonth(month);
                        const isDisabled = !hasDbEntry;

                        return (
                          <td
                            key={account.id}
                            onClick={() => canEdit && hasDbEntry && !isRowEditing && handleCellClick(month, account.name, balance)}
                            className={`px-4 py-3 whitespace-nowrap text-sm text-center ${
                              isDisabled
                                ? 'text-gray-400 dark:text-gray-600'
                                : isNegative && !isCellEditing && !isRowEditing
                                ? 'text-red-600 dark:text-red-400'
                                : isPositive && !isCellEditing && !isRowEditing
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-900 dark:text-gray-100'
                            } ${
                              canEdit && hasDbEntry && !isRowEditing
                                ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
                                : ''
                            }`}
                          >
                            {isRowEditing ? (
                              <input
                                type="text"
                                value={rowEditValues.get(account.name) || '0'}
                                onChange={(e) => handleRowValueChange(account.name, e.target.value)}
                                className="w-32 px-2 py-1 border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                                onClick={(e) => e.stopPropagation()}
                                placeholder="0.00"
                              />
                            ) : isCellEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={() => handleCellSave(month, account.name)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCellSave(month, account.name);
                                    } else if (e.key === 'Escape') {
                                      setEditingCell(null);
                                      setEditingValue('');
                                    }
                                  }}
                                  autoFocus
                                  className="w-32 px-2 py-1 border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="0.00"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCellSave(month, account.name);
                                  }}
                                  disabled={saving}
                                  className="text-green-600 dark:text-green-400 hover:text-green-700 disabled:opacity-50"
                                  title="Save"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell(null);
                                    setEditingValue('');
                                  }}
                                  className="text-red-600 dark:text-red-400 hover:text-red-700"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <span className={canEdit ? 'underline decoration-dotted' : ''}>
                                {balance !== undefined
                                  ? (() => {
                                      const absBalance = Math.abs(balance);
                                      const formatted = `£${absBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                      return isNegative ? `-${formatted}` : formatted;
                                    })()
                                  : canEdit ? 'Click to add' : '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handleExpandEdit(month)}
                          disabled={isDisabled}
                          className={`px-3 py-1 rounded-lg font-medium text-sm transition-colors ${
                            isDisabled
                              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                              : isExpandedEdit
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={isDisabled ? 'Add new statement to enable editing' : isExpandedEdit ? 'Close edit' : 'Edit row'}
                        >
                          {isExpandedEdit ? 'Close' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
