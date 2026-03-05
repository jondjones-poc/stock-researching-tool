'use client';

import { useEffect, useState } from 'react';

interface InvestmentEntry {
  id: number;
  month: string;
  description: string | null;
  invested: number | string;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: number;
  name: string;
}

export default function InvestmentTrackerPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<InvestmentEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    month: '',
    description: '',
    invested: ''
  });

  // Fetch available years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/investment-tracker/years');
        if (!response.ok) throw new Error('Failed to fetch years');
        const data = await response.json();
        setAvailableYears(data.years || []);
        if (data.years && data.years.length > 0) {
          setSelectedYear(Math.max(...data.years));
        } else {
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

  // Fetch accounts with investment_type_id = 3
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/accounts?investment_type_id=3');
        if (!response.ok) throw new Error('Failed to fetch accounts');
        const data = await response.json();
        setAccounts(data.data || []);
      } catch (err: any) {
        console.error('Error fetching accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  // Fetch entries for selected year
  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/investment-tracker?year=${selectedYear}`);
        if (!response.ok) throw new Error('Failed to fetch entries');
        const data = await response.json();
        setEntries(data.data || []);
      } catch (err: any) {
        console.error('Error fetching entries:', err);
        setError('Failed to load investment entries');
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [selectedYear]);

  // Calculate total invested for the year
  const totalInvested = entries.reduce((sum, entry) => {
    const amount = typeof entry.invested === 'string' ? parseFloat(entry.invested) : entry.invested;
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  // Calculate cumulative totals for each entry (sorted by month ascending for proper cumulative)
  const calculateCumulative = (entries: InvestmentEntry[]) => {
    // Sort entries by month ascending for cumulative calculation
    const sortedEntries = [...entries].sort((a, b) => {
      const monthA = a.month || '';
      const monthB = b.month || '';
      return monthA.localeCompare(monthB);
    });
    
    let cumulative = 0;
    const cumulativeMap = new Map<number, number>();
    
    sortedEntries.forEach(entry => {
      const amount = typeof entry.invested === 'string' ? parseFloat(entry.invested) : entry.invested;
      cumulative += isNaN(amount) ? 0 : amount;
      cumulativeMap.set(entry.id, cumulative);
    });
    
    // Return cumulative values in the original entry order
    return entries.map(entry => cumulativeMap.get(entry.id) || 0);
  };

  const cumulativeTotals = calculateCumulative(entries);

  // Calculate monthly totals
  const getMonthlyTotals = () => {
    const monthlyTotals: Record<string, number> = {};
    entries.forEach(entry => {
      const month = entry.month; // Format: YYYY-MM
      const monthKey = month.substring(5, 7); // Extract MM
      const amount = typeof entry.invested === 'string' ? parseFloat(entry.invested) : entry.invested;
      if (!isNaN(amount)) {
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
      }
    });
    return monthlyTotals;
  };

  const monthlyTotals = getMonthlyTotals();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const invested = parseFloat(formData.invested);
      if (isNaN(invested) || invested <= 0) {
        throw new Error('Please enter a valid invested amount');
      }

      const url = editingEntry
        ? '/api/investment-tracker'
        : '/api/investment-tracker';
      
      const method = editingEntry ? 'PUT' : 'POST';
      
      const body = editingEntry
        ? { id: editingEntry.id, month: formData.month, description: formData.description, invested }
        : { month: formData.month, description: formData.description, invested };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save entry');
      }

      // Extract year from month (format: YYYY-MM)
      const entryYear = formData.month.substring(0, 4);
      const entryYearNum = parseInt(entryYear);

      // Refresh years to include new year if needed
      const yearsResponse = await fetch('/api/investment-tracker/years');
      let newYears: number[] = [];
      if (yearsResponse.ok) {
        const yearsData = await yearsResponse.json();
        newYears = yearsData.years || [];
        setAvailableYears(newYears);
        
        // If the new entry is for a different year, switch to it
        if (entryYearNum && newYears.includes(entryYearNum)) {
          setSelectedYear(entryYearNum);
        }
      }

      // Refresh entries for the year (use entryYear if it's different, otherwise selectedYear)
      const yearToRefresh = entryYearNum && newYears.includes(entryYearNum) ? entryYearNum : selectedYear;
      const refreshResponse = await fetch(`/api/investment-tracker?year=${yearToRefresh}`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setEntries(data.data || []);
      }

      // Reset form and close modal
      setFormData({ month: '', description: '', invested: '' });
      setEditingEntry(null);
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Error saving entry:', err);
      setError(err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      const response = await fetch(`/api/investment-tracker?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      // Refresh entries
      const refreshResponse = await fetch(`/api/investment-tracker?year=${selectedYear}`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setEntries(data.data || []);
      }
    } catch (err: any) {
      console.error('Error deleting entry:', err);
      setError(err.message || 'Failed to delete entry');
    }
  };

  // Handle edit
  const handleEdit = (entry: InvestmentEntry) => {
    setEditingEntry(entry);
    // Format month for date picker (YYYY-MM format)
    let monthValue = entry.month;
    // If month is in a different format, try to convert it
    if (monthValue && !monthValue.match(/^\d{4}-\d{2}$/)) {
      // Try to parse different formats
      const date = new Date(monthValue);
      if (!isNaN(date.getTime())) {
        monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    }
    setFormData({
      month: monthValue,
      description: entry.description || '',
      invested: entry.invested.toString()
    });
    setShowAddModal(true);
  };

  // Reset form when modal closes
  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingEntry(null);
    setFormData({ month: '', description: '', invested: '' });
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-2 sm:px-4 lg:px-6">
      <div className="w-full">
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
          <div className="flex gap-6 px-6">
            {/* Grid - 60% width */}
            <div className="w-[60%] bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Invested
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cumulative
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No investment entries found for {selectedYear}
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, index) => {
                      const invested = typeof entry.invested === 'string' ? parseFloat(entry.invested) : entry.invested;
                      const cumulative = cumulativeTotals[index];
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {entry.month}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {entry.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-semibold">
                            £{invested.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-semibold">
                            £{cumulative.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <button
                              onClick={() => handleEdit(entry)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-4"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {entries.length > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-700 font-bold">
                      <td colSpan={2} className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        Total
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                        £{totalInvested.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                        £{totalInvested.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* Month Display - 40% width */}
            <div className="w-[40%] bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="grid grid-cols-3 gap-3">
                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((monthNum) => {
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const monthName = monthNames[parseInt(monthNum) - 1];
                  const total = monthlyTotals[monthNum] || 0;
                  const isOver2k = total >= 2000;
                  
                  return (
                    <div
                      key={monthNum}
                      className={`p-4 rounded-lg border-2 ${
                        isOver2k
                          ? 'bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-400'
                          : 'bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-400'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {monthName}
                      </div>
                      <div className={`text-lg font-bold ${
                        isOver2k
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}>
                        {isOver2k ? '✓' : '✗'} £{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingEntry ? 'Edit Investment Entry' : 'Add Investment Entry'}
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Month <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <select
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select an account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.name}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Invested Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.invested}
                    onChange={(e) => setFormData({ ...formData, invested: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingEntry ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
