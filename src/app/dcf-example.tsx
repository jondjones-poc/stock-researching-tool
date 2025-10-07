// Example of how to use the stored DCF data in a new page
'use client';

import { useEffect, useState } from 'react';
import { getDCFData, DCFData, hasDCFData } from './utils/dcfData';

export default function DCFExample() {
  const [dcfData, setDcfData] = useState<DCFData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if DCF data exists
    if (!hasDCFData()) {
      console.log('No DCF data available. Please run company research first.');
      setLoading(false);
      return;
    }

    // Retrieve the stored data
    const data = getDCFData();
    setDcfData(data);
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading DCF data...</div>;
  }

  if (!dcfData) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">DCF Calculation</h1>
        <p className="text-red-600">
          No DCF data available. Please run company research first to populate the data.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">DCF Calculation for {dcfData.symbol}</h1>
      
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Revenue Growth</h3>
          <div className="space-y-2">
            <p>Bear: {(dcfData.revenueGrowth.bear * 100).toFixed(2)}%</p>
            <p>Base: {(dcfData.revenueGrowth.base * 100).toFixed(2)}%</p>
            <p>Bull: {(dcfData.revenueGrowth.bull * 100).toFixed(2)}%</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Net Income Growth</h3>
          <div className="space-y-2">
            <p>Bear: {(dcfData.netIncomeGrowth.bear * 100).toFixed(2)}%</p>
            <p>Base: {(dcfData.netIncomeGrowth.base * 100).toFixed(2)}%</p>
            <p>Bull: {(dcfData.netIncomeGrowth.bull * 100).toFixed(2)}%</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">PE Low Estimates</h3>
          <div className="space-y-2">
            <p>Bear: {dcfData.peLow.bear.toFixed(2)}x</p>
            <p>Base: {dcfData.peLow.base.toFixed(2)}x</p>
            <p>Bull: {dcfData.peLow.bull.toFixed(2)}x</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">PE High Estimates</h3>
          <div className="space-y-2">
            <p>Bear: {dcfData.peHigh.bear.toFixed(2)}x</p>
            <p>Base: {dcfData.peHigh.base.toFixed(2)}x</p>
            <p>Bull: {dcfData.peHigh.bull.toFixed(2)}x</p>
          </div>
        </div>
      </div>

      {/* Financial Data */}
      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Financial Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Revenue</p>
            <p className="text-xl font-bold">${dcfData.revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Net Income</p>
            <p className="text-xl font-bold">${dcfData.netIncome.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Shares Outstanding</p>
            <p className="text-xl font-bold">{dcfData.sharesOutstanding.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Data Info */}
      <div className="mt-4 text-sm text-gray-500">
        <p>Data timestamp: {new Date(dcfData.timestamp).toLocaleString()}</p>
      </div>
    </div>
  );
}

