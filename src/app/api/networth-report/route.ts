import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Fetch networth report data aggregated by category and month
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json(
        { error: 'year parameter is required' },
        { status: 400 }
      );
    }

    // Get all unique category names from investment_categories, ordered by the order column
    // Use GROUP BY to ensure consistent order value per category name
    let categoriesResult;
    try {
      categoriesResult = await query(
        `SELECT 
          ic.name, 
          MAX(ic."order") as "order"
         FROM investment_categories ic
         WHERE ic.name IS NOT NULL
         GROUP BY ic.name
         ORDER BY COALESCE(MAX(ic."order"), 999) ASC, ic.name ASC`
      );
    } catch (orderError: any) {
      // If order column doesn't exist, fall back to name only
      console.warn('Order column not found, using name only:', orderError.message);
      categoriesResult = await query(
        `SELECT DISTINCT ic.name
         FROM investment_categories ic
         WHERE ic.name IS NOT NULL
         ORDER BY ic.name ASC`
      );
    }
    
    const categoriesWithOrder = categoriesResult.rows.map(row => ({
      name: row.name,
      order: row.order !== null && row.order !== undefined ? parseInt(String(row.order)) : 999,
    }));
    
    // Sort by order, then by name to ensure consistent ordering
    categoriesWithOrder.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
    
    const categories = categoriesWithOrder.map(cat => cat.name);

    // Debug: Check accounts and their category links
    const debugQuery = await query(
      `SELECT 
        a.id as account_id,
        a.name as account_name,
        a.investment_type_id,
        it.name as investment_type_name,
        it.category_id,
        ic.name as category_name,
        COUNT(ab.id) as balance_count
      FROM accounts a
      LEFT JOIN investment_type it ON a.investment_type_id = it.id
      LEFT JOIN investment_categories ic ON it.category_id = ic.id
      LEFT JOIN account_balances ab ON ab.account_id = a.id AND EXTRACT(YEAR FROM ab.balance_date) = $1
      WHERE a.is_active = TRUE
      GROUP BY a.id, a.name, a.investment_type_id, it.name, it.category_id, ic.name
      ORDER BY a.name`
    , [parseInt(year)]);
    
    console.log(`[Networth Report] Account-Category mapping:`, debugQuery.rows.filter(r => 
      r.category_name && r.category_name.toLowerCase().includes('pension')
    ));

    // Get aggregated balances by month and category
    // This joins: account_balances -> accounts -> investment_type -> investment_categories
    const sql = `
      SELECT 
        EXTRACT(MONTH FROM ab.balance_date)::INTEGER as month,
        ic.name as category_name,
        SUM(ab.balance) as total_balance
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
      LEFT JOIN investment_type it ON a.investment_type_id = it.id
      LEFT JOIN investment_categories ic ON it.category_id = ic.id
      WHERE a.is_active = TRUE
        AND EXTRACT(YEAR FROM ab.balance_date) = $1
        AND ic.name IS NOT NULL
      GROUP BY EXTRACT(MONTH FROM ab.balance_date), ic.name
      ORDER BY month ASC, ic.name ASC
    `;

    const result = await query(sql, [parseInt(year)]);

    // Debug: Log the raw results to see what's being returned
    console.log(`[Networth Report] Total rows returned: ${result.rows.length}`);
    console.log(`[Networth Report] Sample rows:`, result.rows.slice(0, 5).map(r => ({
      month: r.month,
      category_name: r.category_name,
      total_balance: r.total_balance
    })));

    // Structure data by month and category
    const monthData: Record<number, Record<string, number>> = {};
    
    // Initialize all months (1-12) with empty category objects
    for (let month = 1; month <= 12; month++) {
      monthData[month] = {};
      categories.forEach(cat => {
        monthData[month][cat] = 0;
      });
    }

    // Fill in actual data
    result.rows.forEach(row => {
      const month = row.month;
      const categoryName = row.category_name;
      const totalBalance = parseFloat(String(row.total_balance)) || 0;
      
      if (monthData[month] && categoryName) {
        monthData[month][categoryName] = totalBalance;
      }
    });

    // Calculate calculated categories and build rules map
    // First, find the category names for the IDs we need
    const categoryIdMap = new Map<number, string>();
    const categoryRules: Record<string, string> = {};
    
    try {
      const categoryIdQuery = await query(
        `SELECT id, name FROM investment_categories WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10) ORDER BY id`
      );
      categoryIdQuery.rows.forEach(row => {
        categoryIdMap.set(row.id, row.name);
      });
      
      // Calculate "Total Stock Value" (id 3) as sum of id 1 + id 2
      const category1Name = categoryIdMap.get(1);
      const category2Name = categoryIdMap.get(2);
      const category3Name = categoryIdMap.get(3); // Total Stock Value
      
      if (category1Name && category2Name && category3Name) {
        categoryRules[category3Name] = `${category1Name} + ${category2Name}`;
        // Calculate Total Stock Value for each month
        for (let month = 1; month <= 12; month++) {
          const value1 = monthData[month][category1Name] || 0;
          const value2 = monthData[month][category2Name] || 0;
          const totalStockValue = value1 + value2;
          monthData[month][category3Name] = totalStockValue;
        }
      }
      
      // Calculate category id 6 as sum of id 3 + id 4 + id 5
      const category4Name = categoryIdMap.get(4);
      const category5Name = categoryIdMap.get(5);
      const category6Name = categoryIdMap.get(6);
      
      if (category3Name && category4Name && category5Name && category6Name) {
        categoryRules[category6Name] = `${category3Name} + ${category4Name} + ${category5Name}`;
        // Calculate category 6 for each month
        for (let month = 1; month <= 12; month++) {
          const value3 = monthData[month][category3Name] || 0;
          const value4 = monthData[month][category4Name] || 0;
          const value5 = monthData[month][category5Name] || 0;
          const category6Value = value3 + value4 + value5;
          monthData[month][category6Name] = category6Value;
        }
      }
      
      // Calculate category id 8 as sum of id 6 + id 7
      const category7Name = categoryIdMap.get(7);
      const category8Name = categoryIdMap.get(8);
      
      if (category6Name && category7Name && category8Name) {
        categoryRules[category8Name] = `${category6Name} + ${category7Name}`;
        // Calculate category 8 for each month
        for (let month = 1; month <= 12; month++) {
          const value6 = monthData[month][category6Name] || 0;
          const value7 = monthData[month][category7Name] || 0;
          const category8Value = value6 + value7;
          monthData[month][category8Name] = category8Value;
        }
      }
      
      // Calculate category id 10 (Networth) as sum of id 8 + id 9
      const category9Name = categoryIdMap.get(9);
      const category10Name = categoryIdMap.get(10); // Networth
      
      if (category8Name && category9Name && category10Name) {
        categoryRules[category10Name] = `${category8Name} + ${category9Name}`;
        // Calculate category 10 (Networth) for each month
        for (let month = 1; month <= 12; month++) {
          const value8 = monthData[month][category8Name] || 0;
          const value9 = monthData[month][category9Name] || 0;
          const category10Value = value8 + value9;
          monthData[month][category10Name] = category10Value;
        }
      }
    } catch (calcError: any) {
      console.warn('[Networth Report] Could not calculate derived categories:', calcError.message);
    }

    // Debug: Check pension value specifically
    const pensionValues = result.rows.filter(r => r.category_name && r.category_name.toLowerCase().includes('pension'));
    if (pensionValues.length > 0) {
      console.log(`[Networth Report] Pension-related rows:`, pensionValues);
    } else {
      console.log(`[Networth Report] No pension-related rows found. Checking all category names:`, 
        [...new Set(result.rows.map(r => r.category_name))]);
    }

    // Check which months have data
    const monthsWithData = new Set<number>();
    result.rows.forEach(row => {
      monthsWithData.add(row.month);
    });

    return NextResponse.json({
      year: parseInt(year),
      categories,
      monthData,
      monthsWithData: Array.from(monthsWithData),
      categoryRules,
    });
  } catch (error: any) {
    console.error('Error fetching networth report:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to fetch networth report', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
