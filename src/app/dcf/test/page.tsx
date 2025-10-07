'use client';

import { useState } from 'react';
import { DCFData } from '../../utils/dcfData';

export default function TestDCF() {
  const [testData, setTestData] = useState<DCFData | null>(null);

  const createMockData = () => {
    const mockData: DCFData = {
      revenueGrowth: {
        bear: 0.06,    // 6%
        base: 0.10,    // 10%
        bull: 0.12     // 12%
      },
      netIncomeGrowth: {
        bear: 0.10,    // 10%
        base: 0.18,    // 18%
        bull: 0.20     // 20%
      },
      peLow: {
        bear: 17.6,    // 22 * 0.8
        base: 20.0,    // 25 * 0.8
        bull: 21.6     // 27 * 0.8
      },
      peHigh: {
        bear: 21.6,    // 27 * 0.8
        base: 24.0,    // 30 * 0.8
        bull: 25.6     // 32 * 0.8
      },
      revenue: 40195000000,      // $40.195B
      netIncome: 7873970000,     // $7.874B
      sharesOutstanding: 962000000, // 962M shares
      stockPrice: 250.00,  // $250 per share
      symbol: 'CRM',
      timestamp: new Date().toISOString()
    };

    // Store mock data in localStorage
    localStorage.setItem('dcfData', JSON.stringify(mockData));
    setTestData(mockData);
  };

  const clearMockData = () => {
    localStorage.removeItem('dcfData');
    setTestData(null);
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            DCF Test Data
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Create mock data to test the DCF Calculator
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={createMockData}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Mock Data
              </button>
              <button
                onClick={clearMockData}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear Mock Data
              </button>
            </div>

            {testData && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h2 className="text-lg font-semibold mb-2 text-green-800 dark:text-green-200">
                  ✅ Mock Data Created Successfully!
                </h2>
                <p className="text-green-700 dark:text-green-300 mb-3">
                  You can now navigate to the DCF Calculator page to see the projections.
                </p>
                <div className="bg-white dark:bg-gray-700 p-3 rounded text-sm overflow-auto max-h-60">
                  <pre className="text-xs">
                    {JSON.stringify(testData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">
                Mock Data Details
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p><strong>Symbol:</strong> CRM (Salesforce)</p>
                <p><strong>Revenue:</strong> $40.195B</p>
                <p><strong>Net Income:</strong> $7.874B</p>
                <p><strong>Shares Outstanding:</strong> 962M</p>
                <p><strong>Growth Rates:</strong> Bear 10%, Base 18%, Bull 20%</p>
                <p><strong>PE Ratios:</strong> Low 17.6-21.6x, High 21.6-25.6x</p>
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>This creates mock data similar to the CRM example from the screenshot.</p>
              <p>After creating mock data, you can navigate to the DCF Calculator page to see the projections.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

