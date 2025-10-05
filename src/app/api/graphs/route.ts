import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    // Fetch cash flow statement and income statement data
    const [cashFlowResponse, incomeStatementResponse] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/api/v3/cash-flow-statement/${symbol}?limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/api/v3/income-statement/${symbol}?limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 })
    ]);

    const result: any = {
      freeCashFlow: [],
      shareBuybacks: [],
      revenue: []
    };

    // Process cash flow statement data
    if (cashFlowResponse.status === 'fulfilled' && cashFlowResponse.value.data) {
      const cashFlowData = cashFlowResponse.value.data;
      console.log('Cash flow data:', JSON.stringify(cashFlowData, null, 2));

      // Extract free cash flow and share buybacks
      const freeCashFlowData: Array<{year: string, value: number, change?: number}> = [];
      const buybacksData: Array<{year: string, value: number, change?: number}> = [];

      cashFlowData.forEach((item: any, index: number) => {
        const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
        
        // Free Cash Flow = Operating Cash Flow - Capital Expenditures
        const operatingCashFlow = item.netCashProvidedByOperatingActivities || 0;
        const capitalExpenditures = Math.abs(item.capitalExpenditure || 0); // Make positive
        const freeCashFlow = operatingCashFlow - capitalExpenditures;

        if (freeCashFlow !== 0) {
          freeCashFlowData.push({
            year,
            value: freeCashFlow,
            change: index > 0 ? 
              (freeCashFlow - freeCashFlowData[index - 1]?.value) / Math.abs(freeCashFlowData[index - 1]?.value || 1) : undefined
          });
        }

        // Share Buybacks = Common Stock Repurchased - Common Stock Issued
        const repurchaseOfStock = Math.abs(item.commonStockRepurchased || 0); // Make positive
        const issuanceOfStock = Math.abs(item.commonStockIssued || 0); // Make positive
        const netBuybacks = repurchaseOfStock - issuanceOfStock;

        if (netBuybacks !== 0) {
          buybacksData.push({
            year,
            value: netBuybacks,
            change: index > 0 ? 
              (netBuybacks - buybacksData[index - 1]?.value) / Math.abs(buybacksData[index - 1]?.value || 1) : undefined
          });
        }
      });

      result.freeCashFlow = freeCashFlowData.reverse(); // Most recent first
      result.shareBuybacks = buybacksData.reverse(); // Most recent first

      console.log('Free Cash Flow data:', result.freeCashFlow);
      console.log('Share Buybacks data:', result.shareBuybacks);
    } else {
      console.log('Cash flow data not available or failed');
      if (cashFlowResponse.status === 'rejected') {
        console.log('Cash flow error:', cashFlowResponse.reason);
      }
    }

    // Process income statement data for revenue
    if (incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      console.log('Income statement data:', JSON.stringify(incomeData, null, 2));

      const revenueData: Array<{year: string, value: number, change?: number}> = [];

      incomeData.forEach((item: any, index: number) => {
        const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
        const revenue = item.revenue || 0;

        if (revenue > 0) {
          revenueData.push({
            year,
            value: revenue,
            change: index > 0 ? 
              (revenue - revenueData[index - 1]?.value) / revenueData[index - 1]?.value : undefined
          });
        }
      });

      result.revenue = revenueData.reverse(); // Most recent first
      console.log('Revenue data:', result.revenue);
    } else {
      console.log('Income statement data not available or failed');
      if (incomeStatementResponse.status === 'rejected') {
        console.log('Income statement error:', incomeStatementResponse.reason);
      }
    }

    console.log('Final graphs result:', result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching graphs data:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch graphs data', details: error.message },
      { status: 500 }
    );
  }
}
