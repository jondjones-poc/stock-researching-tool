export interface DCFData {
  revenueGrowth: {
    bear: number;    // as decimal (0.1 = 10%)
    base: number;
    bull: number;
  };
  netIncomeGrowth: {
    bear: number;
    base: number;
    bull: number;
  };
  peLow: {
    bear: number;
    base: number;
    bull: number;
  };
  peHigh: {
    bear: number;
    base: number;
    bull: number;
  };
  revenue: number;
  netIncome: number;
  sharesOutstanding: number;
  stockPrice: number;
  currentEps?: number; // Optional current EPS value
  symbol: string;
  timestamp: string;
}

/**
 * Retrieves stored DCF data from localStorage
 * @returns DCFData object or null if not found
 */
export function getDCFData(): DCFData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('dcfData');
    if (!stored) return null;
    
    const data = JSON.parse(stored) as DCFData;
    
    // Validate the data structure
    if (!data.symbol || !data.timestamp) {
      console.warn('Invalid DCF data structure');
      return null;
    }
    
    // Check if data is older than 1 hour
    const dataTime = new Date(data.timestamp).getTime();
    const now = new Date().getTime();
    const oneHour = 60 * 60 * 1000;
    
    if (now - dataTime > oneHour) {
      console.warn('DCF data is older than 1 hour, consider refreshing');
    }
    
    return data;
  } catch (error) {
    console.error('Error retrieving DCF data:', error);
    return null;
  }
}

/**
 * Checks if DCF data exists in localStorage
 * @returns boolean indicating if data exists
 */
export function hasDCFData(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const stored = localStorage.getItem('dcfData');
    return stored !== null;
  } catch (error) {
    console.error('Error checking for DCF data:', error);
    return false;
  }
}

/**
 * Removes DCF data from localStorage
 */
export function clearDCFData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('dcfData');
    console.log('DCF data cleared from localStorage');
  } catch (error) {
    console.error('Error clearing DCF data:', error);
  }
}

/**
 * Stores DCF data in localStorage
 * @param data DCFData object to store
 */
export function storeDCFData(data: DCFData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('dcfData', JSON.stringify(data));
    console.log('DCF data stored in localStorage:', data);
  } catch (error) {
    console.error('Error storing DCF data:', error);
  }
}
