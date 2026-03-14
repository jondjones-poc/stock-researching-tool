import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { randomUUID } from 'crypto';

const ETORO_PUBLIC_KEY = process.env.ETORO_PUBLIC_KEY;
const ETORO_PRIVATE_KEY = process.env.ETORO_PRIVATE_KEY;
const ETORO_ACCOUNT_TYPE = process.env.ETORO_ACCOUNT_TYPE || 'real';

export async function GET(request: NextRequest) {
  try {
    if (!ETORO_PUBLIC_KEY || !ETORO_PRIVATE_KEY) {
      return NextResponse.json(
        { 
          error: 'eToro API keys are not configured',
          stocks: []
        },
        { status: 500 }
      );
    }

    const requestId = randomUUID();
    const accountType = ETORO_ACCOUNT_TYPE.toLowerCase() === 'demo' ? 'demo' : 'real';
    
    console.log('Testing eToro API with account type:', accountType);
    console.log('Request ID:', requestId);
    
    const portfolioResponse = await axios.get(
      `https://public-api.etoro.com/api/v1/trading/info/${accountType}/pnl`,
      {
        headers: {
          'x-request-id': requestId,
          'x-api-key': ETORO_PUBLIC_KEY,
          'x-user-key': ETORO_PRIVATE_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true
      }
    );

    return NextResponse.json({
      status: portfolioResponse.status,
      statusText: portfolioResponse.statusText,
      headers: portfolioResponse.headers,
      data: portfolioResponse.data,
      accountType: accountType,
      requestId: requestId
    });

  } catch (error: any) {
    console.error('Error testing eToro API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to test eToro API',
        details: error.message,
        response: error.response?.data || null,
        status: error.response?.status || null
      },
      { status: 500 }
    );
  }
}
