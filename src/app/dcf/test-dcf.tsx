// Test component to verify DCF calculations work correctly
'use client';

import { useState } from 'react';
import { DCFData } from '../utils/dcfData';

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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">DCF Test Data</h1>
      
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            onClick={createMockData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Mock Data
          </button>
          <button
            onClick={clearMockData}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Mock Data
          </button>
        </div>

        {testData && (
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Mock Data Created:</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(testData, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p>This creates mock data similar to the CRM example from the screenshot.</p>
          <p>After creating mock data, you can navigate to the DCF Calculator page to see the projections.</p>
        </div>
      </div>
    </div>
  );
}

