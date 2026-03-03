#!/bin/bash

# Test script to validate free APIs for historical shares outstanding data for NKE

SYMBOL="NKE"

echo "=== Testing Free APIs for Historical Shares Outstanding Data ==="
echo "Symbol: $SYMBOL"
echo ""

# Test 1: FMP Key Metrics with higher limit (20 instead of 10)
echo "1. Testing FMP Key Metrics (limit=20)..."
echo "   Endpoint: https://financialmodelingprep.com/stable/key-metrics?symbol=$SYMBOL&limit=20"
echo "   Note: Requires FMP_API_KEY"
echo ""

# Test 2: FMP Income Statement (quarterly/annual might have shares outstanding)
echo "2. Testing FMP Income Statement (quarterly)..."
echo "   Endpoint: https://financialmodelingprep.com/api/v3/income-statement/$SYMBOL?period=quarter&limit=20"
echo "   Note: Requires FMP_API_KEY, might have weightedAverageSharesOutstanding"
echo ""

# Test 3: FMP Balance Sheet (might have shares outstanding)
echo "3. Testing FMP Balance Sheet (quarterly)..."
echo "   Endpoint: https://financialmodelingprep.com/api/v3/balance-sheet-statement/$SYMBOL?period=quarter&limit=20"
echo "   Note: Requires FMP_API_KEY"
echo ""

# Test 4: Alpha Vantage (free tier - check if they have shares outstanding)
echo "4. Testing Alpha Vantage..."
echo "   Endpoint: https://www.alphavantage.co/query?function=OVERVIEW&symbol=$SYMBOL&apikey=demo"
echo "   Note: Free tier available, check SharesOutstanding field"
echo ""

# Test 5: Polygon.io (free tier)
echo "5. Testing Polygon.io..."
echo "   Endpoint: https://api.polygon.io/v2/reference/financials?ticker=$SYMBOL&limit=10"
echo "   Note: Requires free API key, might have shares outstanding in financials"
echo ""

# Test 6: IEX Cloud (free tier)
echo "6. Testing IEX Cloud..."
echo "   Endpoint: https://cloud.iexapis.com/stable/stock/$SYMBOL/stats"
echo "   Note: Requires free API key, check sharesOutstanding field"
echo ""

# Test 7: Yahoo Finance (unofficial, but free)
echo "7. Testing Yahoo Finance (unofficial)..."
echo "   Endpoint: https://query1.finance.yahoo.com/v10/finance/quoteSummary/$SYMBOL?modules=defaultKeyStatistics"
echo "   Note: Free, no API key needed, check sharesOutstanding field"
echo ""

echo "=== Recommendations ==="
echo "1. Try increasing FMP key-metrics limit from 10 to 20 or 30"
echo "2. Check FMP income statement for weightedAverageSharesOutstanding (quarterly data)"
echo "3. Check FMP balance sheet for shares outstanding (quarterly data)"
echo "4. Alpha Vantage OVERVIEW endpoint has SharesOutstanding (current, not historical)"
echo "5. Yahoo Finance might have historical data in quoteSummary"
echo ""
