import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const searchParams = request.url.split('?')[1] ? new URLSearchParams(request.url.split('?')[1]) : null;
  const testKey = searchParams?.get('apikey') || process.env.FMP_API_KEY;

  if (!testKey) {
    return NextResponse.json({ 
      error: 'No API key provided',
      envKeySet: !!process.env.FMP_API_KEY,
      envKeyLength: process.env.FMP_API_KEY?.length || 0
    }, { status: 400 });
  }

  const results: any = {
    providedKey: testKey.substring(0, 4) + '...' + testKey.substring(testKey.length - 4),
    keyLength: testKey.length,
    envKeySet: !!process.env.FMP_API_KEY,
    tests: []
  };

  // Test 1: Simple quote endpoint (free tier)
  try {
    const response = await axios.get(
      `https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=${testKey}`,
      { timeout: 10000 }
    );
    results.tests.push({
      endpoint: 'quote',
      status: response.status,
      success: response.status === 200,
      dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
      error: null
    });
  } catch (error: any) {
    results.tests.push({
      endpoint: 'quote',
      status: error.response?.status || 'error',
      success: false,
      dataLength: null,
      error: error.response?.data || error.message
    });
  }

  // Test 2: Income statement endpoint
  try {
    const response = await axios.get(
      `https://financialmodelingprep.com/stable/income-statement?symbol=AAPL&limit=1&apikey=${testKey}`,
      { timeout: 10000 }
    );
    results.tests.push({
      endpoint: 'income-statement',
      status: response.status,
      success: response.status === 200,
      dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
      error: null
    });
  } catch (error: any) {
    results.tests.push({
      endpoint: 'income-statement',
      status: error.response?.status || 'error',
      success: false,
      dataLength: null,
      error: error.response?.data || error.message
    });
  }

  // Test 3: Key metrics endpoint (often requires premium)
  try {
    const response = await axios.get(
      `https://financialmodelingprep.com/stable/key-metrics?symbol=AAPL&limit=1&apikey=${testKey}`,
      { timeout: 10000 }
    );
    results.tests.push({
      endpoint: 'key-metrics',
      status: response.status,
      success: response.status === 200,
      dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
      error: null
    });
  } catch (error: any) {
    results.tests.push({
      endpoint: 'key-metrics',
      status: error.response?.status || 'error',
      success: false,
      dataLength: null,
      error: error.response?.data || error.message
    });
  }

  // Test 4: Cash flow endpoint
  try {
    const response = await axios.get(
      `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL&limit=1&apikey=${testKey}`,
      { timeout: 10000 }
    );
    results.tests.push({
      endpoint: 'cash-flow-statement',
      status: response.status,
      success: response.status === 200,
      dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
      error: null
    });
  } catch (error: any) {
    results.tests.push({
      endpoint: 'cash-flow-statement',
      status: error.response?.status || 'error',
      success: false,
      dataLength: null,
      error: error.response?.data || error.message
    });
  }

  return NextResponse.json(results);
}

