/** Validator for earnings-review-v1.schema.json */

export const EARNINGS_SCHEMA_VERSION = '1.0';

export const EARNINGS_GRADES = [
  'A*',
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D',
  'E',
] as const;

export type EarningsGrade = (typeof EARNINGS_GRADES)[number];

export const BUSINESS_DIRECTIONS = [
  'Strongly Improving',
  'Improving',
  'Stable',
  'Weakening',
  'In Trouble',
] as const;

export const INVESTMENT_VIEWS = ['Buy', 'Hold', 'Sell'] as const;
export const MANAGEMENT_OUTLOOKS = [
  'Very Positive',
  'Positive',
  'Neutral',
  'Negative',
  'Very Negative',
] as const;
export const DILUTION_RISKS = ['Low', 'Medium', 'High'] as const;

export const DEFAULT_GRADE_SCORES: Record<EarningsGrade, number> = {
  'A*': 100,
  'A+': 95,
  A: 90,
  'A-': 85,
  'B+': 80,
  B: 75,
  'B-': 70,
  'C+': 65,
  C: 60,
  'C-': 55,
  D: 40,
  E: 20,
};

export const GRADE_CATEGORIES = [
  'revenue',
  'profitability',
  'costs',
  'balance_sheet',
  'outlook',
  'earnings_quality',
  'valuation',
  'overall',
] as const;

export type GradeCategory = (typeof GRADE_CATEGORIES)[number];
export type GradeDirection = 'improving' | 'flat' | 'declining';

const ALLOWED_KEYS: Record<string, readonly string[]> = {
  root: [
    'schema_version',
    'company',
    'earnings_period',
    'revenue',
    'profitability',
    'costs',
    'balance_sheet',
    'outlook',
    'earnings_quality',
    'previous_comparison',
    'competitor',
    'analyst_sentiment',
    'assessment',
    'valuation',
    'source',
  ],
  company: ['name', 'ticker', 'currency', 'industry'],
  earnings_period: ['fiscal_year', 'quarter', 'period_end', 'report_date'],
  revenue: [
    'value',
    'yoy_growth_pct',
    'qoq_growth_pct',
    'analyst_estimate',
    'surprise_pct',
    'grade',
  ],
  profitability: [
    'eps',
    'eps_estimate',
    'eps_surprise_pct',
    'gross_profit',
    'gross_margin_pct',
    'gross_margin_prior_pct',
    'operating_income',
    'operating_margin_pct',
    'net_income',
    'free_cash_flow',
    'grade',
  ],
  costs: [
    'operating_expenses',
    'operating_expenses_yoy_pct',
    'cost_of_revenue',
    'cost_of_revenue_yoy_pct',
    'sales_marketing',
    'sales_marketing_yoy_pct',
    'research_development',
    'research_development_yoy_pct',
    'general_admin',
    'general_admin_yoy_pct',
    'one_off_expenses',
    'grade',
  ],
  one_off_expense: ['name', 'value', 'impact'],
  balance_sheet: [
    'cash',
    'short_term_investments',
    'debt',
    'net_cash',
    'operating_cash_flow',
    'free_cash_flow',
    'inventory',
    'accounts_receivable',
    'shares_outstanding',
    'share_count_yoy_growth_pct',
    'grade',
  ],
  outlook: [
    'revenue_guidance_low',
    'revenue_guidance_high',
    'eps_guidance_low',
    'eps_guidance_high',
    'guidance_change',
    'management_outlook',
    'grade',
  ],
  earnings_quality: [
    'recurring_profit',
    'one_off_income',
    'one_off_income_description',
    'stock_based_compensation',
    'dilution_risk',
    'grade',
  ],
  previous_comparison: [
    'revenue_trend',
    'margin_trend',
    'cost_trend',
    'cash_flow_trend',
    'guidance_trend',
  ],
  competitor: [
    'name',
    'ticker',
    'revenue_growth_pct',
    'gross_margin_pct',
    'operating_margin_pct',
    'comparison_summary',
  ],
  analyst_sentiment: [
    'consensus',
    'buy_count',
    'hold_count',
    'sell_count',
    'average_price_target',
    'recent_rating_change',
    'source_name',
    'source_date',
  ],
  assessment: [
    'overall_grade',
    'business_direction',
    'investment_view',
    'key_positive',
    'key_negative',
    'key_risk',
    'earnings_thesis',
  ],
  valuation: [
    'current_price',
    'market_cap',
    'pe_ratio',
    'price_to_sales',
    'ev_to_sales',
    'dcf_fair_value',
    'valuation_grade',
  ],
  source: ['source_type', 'source_name', 'source_url'],
};

export type OneOffExpense = {
  name: string | null;
  value: number | null;
  impact: 'positive' | 'negative' | null;
};

export type EarningsReviewPayload = {
  schema_version: string;
  company: {
    name: string | null;
    ticker: string;
    currency: string | null;
    industry: string | null;
  };
  earnings_period: {
    fiscal_year: number;
    quarter: string | null;
    fiscal_quarter: number;
    period_end: string | null;
    report_date: string | null;
    period_label: string;
  };
  revenue: {
    value: number | null;
    yoy_growth_pct: number | null;
    qoq_growth_pct: number | null;
    analyst_estimate: number | null;
    surprise_pct: number | null;
    grade: EarningsGrade | null;
  };
  profitability: {
    eps: number | null;
    eps_estimate: number | null;
    eps_surprise_pct: number | null;
    gross_profit: number | null;
    gross_margin_pct: number | null;
    gross_margin_prior_pct: number | null;
    operating_income: number | null;
    operating_margin_pct: number | null;
    net_income: number | null;
    free_cash_flow: number | null;
    grade: EarningsGrade | null;
  };
  costs: {
    operating_expenses: number | null;
    operating_expenses_yoy_pct: number | null;
    cost_of_revenue: number | null;
    cost_of_revenue_yoy_pct: number | null;
    sales_marketing: number | null;
    sales_marketing_yoy_pct: number | null;
    research_development: number | null;
    research_development_yoy_pct: number | null;
    general_admin: number | null;
    general_admin_yoy_pct: number | null;
    one_off_expenses: OneOffExpense[] | null;
    grade: EarningsGrade | null;
  };
  balance_sheet: {
    cash: number | null;
    short_term_investments: number | null;
    debt: number | null;
    net_cash: number | null;
    operating_cash_flow: number | null;
    free_cash_flow: number | null;
    inventory: number | null;
    accounts_receivable: number | null;
    shares_outstanding: number | null;
    share_count_yoy_growth_pct: number | null;
    grade: EarningsGrade | null;
  };
  outlook: {
    revenue_guidance_low: number | null;
    revenue_guidance_high: number | null;
    eps_guidance_low: number | null;
    eps_guidance_high: number | null;
    guidance_change: string | null;
    management_outlook: string | null;
    grade: EarningsGrade | null;
  };
  earnings_quality: {
    recurring_profit: boolean | null;
    one_off_income: number | null;
    one_off_income_description: string | null;
    stock_based_compensation: number | null;
    dilution_risk: string | null;
    grade: EarningsGrade | null;
  };
  previous_comparison: {
    revenue_trend: string | null;
    margin_trend: string | null;
    cost_trend: string | null;
    cash_flow_trend: string | null;
    guidance_trend: string | null;
  };
  competitor: {
    name: string | null;
    ticker: string | null;
    revenue_growth_pct: number | null;
    gross_margin_pct: number | null;
    operating_margin_pct: number | null;
    comparison_summary: string | null;
  };
  analyst_sentiment: {
    consensus: string | null;
    buy_count: number | null;
    hold_count: number | null;
    sell_count: number | null;
    average_price_target: number | null;
    recent_rating_change: string | null;
    source_name: string | null;
    source_date: string | null;
  };
  assessment: {
    overall_grade: EarningsGrade | null;
    business_direction: string | null;
    investment_view: string | null;
    key_positive: string | null;
    key_negative: string | null;
    key_risk: string | null;
    earnings_thesis: string | null;
  };
  valuation: {
    current_price: number | null;
    market_cap: number | null;
    pe_ratio: number | null;
    price_to_sales: number | null;
    ev_to_sales: number | null;
    dcf_fair_value: number | null;
    valuation_grade: EarningsGrade | null;
  };
  source: {
    source_type: string | null;
    source_name: string | null;
    source_url: string | null;
  };
};

export type ValidationIssue = { path: string; message: string };

export type ValidationResult =
  | { ok: true; value: EarningsReviewPayload; errors: [] }
  | { ok: false; value: null; errors: ValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unknownKeys(obj: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter((key) => !allowed.includes(key));
}

function asNullableString(value: unknown, path: string, errors: ValidationIssue[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    errors.push({ path, message: `Expected string or null, got ${typeof value}` });
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function asNullableBoolean(value: unknown, path: string, errors: ValidationIssue[]): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') {
    errors.push({ path, message: `Expected boolean or null, got ${typeof value}` });
    return null;
  }
  return value;
}

function asNullableNumber(value: unknown, path: string, errors: ValidationIssue[]): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ path, message: `Expected finite number or null, got ${typeof value}` });
    return null;
  }
  return value;
}

function asNullableInteger(value: unknown, path: string, errors: ValidationIssue[]): number | null {
  const n = asNullableNumber(value, path, errors);
  if (n == null) return null;
  if (!Number.isInteger(n)) {
    errors.push({ path, message: `Expected integer or null, got ${n}` });
    return null;
  }
  return n;
}

function asGrade(value: unknown, path: string, errors: ValidationIssue[]): EarningsGrade | null {
  const text = asNullableString(value, path, errors);
  if (text == null) return null;
  if (!(EARNINGS_GRADES as readonly string[]).includes(text)) {
    errors.push({
      path,
      message: `Invalid grade "${text}". Allowed: ${EARNINGS_GRADES.join(', ')}`,
    });
    return null;
  }
  return text as EarningsGrade;
}

function asEnum(
  value: unknown,
  path: string,
  allowed: readonly string[],
  errors: ValidationIssue[]
): string | null {
  const text = asNullableString(value, path, errors);
  if (text == null) return null;
  if (!allowed.includes(text)) {
    errors.push({
      path,
      message: `Invalid ${path}: "${text}". Allowed: ${allowed.join(', ')}`,
    });
    return null;
  }
  return text;
}

export function parseQuarterNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4) {
    return value;
  }
  if (typeof value === 'string') {
    const match = value.trim().toUpperCase().match(/Q\s*([1-4])|^([1-4])$/);
    if (match) return parseInt(match[1] || match[2], 10);
  }
  return null;
}

function parseQuarter(value: unknown, path: string, errors: ValidationIssue[]): {
  label: string | null;
  number: number | null;
} {
  if (value === null || value === undefined) {
    errors.push({ path, message: 'earnings_period.quarter is required (string such as "Q2").' });
    return { label: null, number: null };
  }
  const text = asNullableString(value, path, errors);
  if (text == null) return { label: null, number: null };
  const number = parseQuarterNumber(text);
  if (number == null) {
    errors.push({
      path,
      message: `quarter must identify Q1-Q4, got "${text}"`,
    });
  }
  return { label: text, number };
}

function sectionObject(
  raw: unknown,
  path: string,
  errors: ValidationIssue[],
  required: boolean
): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    if (required) errors.push({ path, message: `${path} is required.` });
    return {};
  }
  if (!isPlainObject(raw)) {
    errors.push({
      path,
      message: `Expected object, got ${Array.isArray(raw) ? 'array' : typeof raw}`,
    });
    return {};
  }
  for (const key of unknownKeys(raw, ALLOWED_KEYS[path] || [])) {
    errors.push({
      path: `${path}.${key}`,
      message: `Unknown field "${key}" is not in the ${path} schema and was not stored.`,
    });
  }
  return raw;
}

function parseOneOffExpenses(
  raw: unknown,
  path: string,
  errors: ValidationIssue[]
): OneOffExpense[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) {
    errors.push({ path, message: 'Expected array or null.' });
    return null;
  }
  return raw.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(item)) {
      errors.push({ path: itemPath, message: 'Expected object.' });
      return { name: null, value: null, impact: null };
    }
    for (const key of unknownKeys(item, ALLOWED_KEYS.one_off_expense)) {
      errors.push({
        path: `${itemPath}.${key}`,
        message: `Unknown field "${key}" is not in the one_off_expenses item schema.`,
      });
    }
    const impact = asEnum(item.impact, `${itemPath}.impact`, ['positive', 'negative'], errors);
    return {
      name: asNullableString(item.name, `${itemPath}.name`, errors),
      value: asNullableNumber(item.value, `${itemPath}.value`, errors),
      impact: (impact as 'positive' | 'negative' | null) ?? null,
    };
  });
}

export function gradeScore(
  grade: string | null | undefined,
  scale: Record<string, number> = DEFAULT_GRADE_SCORES
): number | null {
  if (!grade) return null;
  const score = scale[grade];
  return Number.isFinite(score) ? score : null;
}

export function computeGradeDirection(
  current: string | null,
  previous: string | null,
  scale: Record<string, number> = DEFAULT_GRADE_SCORES
): GradeDirection | null {
  const now = gradeScore(current, scale);
  const prev = gradeScore(previous, scale);
  if (now == null || prev == null) return null;
  if (now > prev) return 'improving';
  if (now < prev) return 'declining';
  return 'flat';
}

export function periodLabel(year: number, quarter: number, quarterText?: string | null): string {
  if (quarterText) {
    if (year && quarterText.includes(String(year))) return quarterText;
    return year ? `${quarterText} ${year}` : quarterText;
  }
  return `Q${quarter} ${year}`;
}

/** Store ISO dates in DATE columns; keep non-date strings only in raw_json. */
export function asDbDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function reviewsConflict(
  existing: Array<{ fiscal_year: number; fiscal_quarter: number }>,
  fiscalYear: number,
  fiscalQuarter: number
): boolean {
  return existing.some(
    (row) => Number(row.fiscal_year) === fiscalYear && Number(row.fiscal_quarter) === fiscalQuarter
  );
}

export function validateEarningsReviewJson(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];

  if (Array.isArray(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '', message: 'Upload a single earnings review object, not an array.' }],
    };
  }
  if (!isPlainObject(input)) {
    return {
      ok: false,
      value: null,
      errors: [{ path: '', message: 'JSON root must be an object.' }],
    };
  }

  for (const key of unknownKeys(input, ALLOWED_KEYS.root)) {
    errors.push({
      path: key,
      message: `Unknown top-level field "${key}" is not in schema ${EARNINGS_SCHEMA_VERSION} and was not stored.`,
    });
  }

  if (input.schema_version !== EARNINGS_SCHEMA_VERSION) {
    errors.push({
      path: 'schema_version',
      message: `schema_version must be "${EARNINGS_SCHEMA_VERSION}", got ${JSON.stringify(input.schema_version)}.`,
    });
  }

  const companyRaw = sectionObject(input.company, 'company', errors, true);
  const periodRaw = sectionObject(input.earnings_period, 'earnings_period', errors, true);
  const revenueRaw = sectionObject(input.revenue, 'revenue', errors, true);
  const profitabilityRaw = sectionObject(input.profitability, 'profitability', errors, true);
  const costsRaw = sectionObject(input.costs, 'costs', errors, true);
  const balanceRaw = sectionObject(input.balance_sheet, 'balance_sheet', errors, true);
  const outlookRaw = sectionObject(input.outlook, 'outlook', errors, true);
  const qualityRaw = sectionObject(input.earnings_quality, 'earnings_quality', errors, true);
  const previousRaw = sectionObject(input.previous_comparison, 'previous_comparison', errors, true);
  const competitorRaw = sectionObject(input.competitor, 'competitor', errors, true);
  const analystRaw = sectionObject(input.analyst_sentiment, 'analyst_sentiment', errors, true);
  const assessmentRaw = sectionObject(input.assessment, 'assessment', errors, true);
  const valuationRaw = sectionObject(input.valuation, 'valuation', errors, true);
  const sourceRaw = sectionObject(input.source, 'source', errors, true);

  const ticker = asNullableString(companyRaw.ticker, 'company.ticker', errors);
  if (!ticker) {
    errors.push({ path: 'company.ticker', message: 'company.ticker is required to match a company.' });
  }

  const fiscalYear = asNullableInteger(periodRaw.fiscal_year, 'earnings_period.fiscal_year', errors);
  if (fiscalYear == null) {
    errors.push({
      path: 'earnings_period.fiscal_year',
      message: 'earnings_period.fiscal_year is required to store a review.',
    });
  }
  const quarter = parseQuarter(periodRaw.quarter, 'earnings_period.quarter', errors);

  const value: EarningsReviewPayload = {
    schema_version: EARNINGS_SCHEMA_VERSION,
    company: {
      name: asNullableString(companyRaw.name, 'company.name', errors),
      ticker: ticker ? ticker.toUpperCase() : '',
      currency: asNullableString(companyRaw.currency, 'company.currency', errors),
      industry: asNullableString(companyRaw.industry, 'company.industry', errors),
    },
    earnings_period: {
      fiscal_year: fiscalYear ?? 0,
      quarter: quarter.label,
      fiscal_quarter: quarter.number ?? 0,
      period_end: asNullableString(periodRaw.period_end, 'earnings_period.period_end', errors),
      report_date: asNullableString(periodRaw.report_date, 'earnings_period.report_date', errors),
      period_label:
        fiscalYear && (quarter.label || quarter.number)
          ? periodLabel(fiscalYear, quarter.number || 0, quarter.label)
          : '',
    },
    revenue: {
      value: asNullableNumber(revenueRaw.value, 'revenue.value', errors),
      yoy_growth_pct: asNullableNumber(revenueRaw.yoy_growth_pct, 'revenue.yoy_growth_pct', errors),
      qoq_growth_pct: asNullableNumber(revenueRaw.qoq_growth_pct, 'revenue.qoq_growth_pct', errors),
      analyst_estimate: asNullableNumber(
        revenueRaw.analyst_estimate,
        'revenue.analyst_estimate',
        errors
      ),
      surprise_pct: asNullableNumber(revenueRaw.surprise_pct, 'revenue.surprise_pct', errors),
      grade: asGrade(revenueRaw.grade, 'revenue.grade', errors),
    },
    profitability: {
      eps: asNullableNumber(profitabilityRaw.eps, 'profitability.eps', errors),
      eps_estimate: asNullableNumber(
        profitabilityRaw.eps_estimate,
        'profitability.eps_estimate',
        errors
      ),
      eps_surprise_pct: asNullableNumber(
        profitabilityRaw.eps_surprise_pct,
        'profitability.eps_surprise_pct',
        errors
      ),
      gross_profit: asNullableNumber(
        profitabilityRaw.gross_profit,
        'profitability.gross_profit',
        errors
      ),
      gross_margin_pct: asNullableNumber(
        profitabilityRaw.gross_margin_pct,
        'profitability.gross_margin_pct',
        errors
      ),
      gross_margin_prior_pct: asNullableNumber(
        profitabilityRaw.gross_margin_prior_pct,
        'profitability.gross_margin_prior_pct',
        errors
      ),
      operating_income: asNullableNumber(
        profitabilityRaw.operating_income,
        'profitability.operating_income',
        errors
      ),
      operating_margin_pct: asNullableNumber(
        profitabilityRaw.operating_margin_pct,
        'profitability.operating_margin_pct',
        errors
      ),
      net_income: asNullableNumber(profitabilityRaw.net_income, 'profitability.net_income', errors),
      free_cash_flow: asNullableNumber(
        profitabilityRaw.free_cash_flow,
        'profitability.free_cash_flow',
        errors
      ),
      grade: asGrade(profitabilityRaw.grade, 'profitability.grade', errors),
    },
    costs: {
      operating_expenses: asNullableNumber(
        costsRaw.operating_expenses,
        'costs.operating_expenses',
        errors
      ),
      operating_expenses_yoy_pct: asNullableNumber(
        costsRaw.operating_expenses_yoy_pct,
        'costs.operating_expenses_yoy_pct',
        errors
      ),
      cost_of_revenue: asNullableNumber(costsRaw.cost_of_revenue, 'costs.cost_of_revenue', errors),
      cost_of_revenue_yoy_pct: asNullableNumber(
        costsRaw.cost_of_revenue_yoy_pct,
        'costs.cost_of_revenue_yoy_pct',
        errors
      ),
      sales_marketing: asNullableNumber(costsRaw.sales_marketing, 'costs.sales_marketing', errors),
      sales_marketing_yoy_pct: asNullableNumber(
        costsRaw.sales_marketing_yoy_pct,
        'costs.sales_marketing_yoy_pct',
        errors
      ),
      research_development: asNullableNumber(
        costsRaw.research_development,
        'costs.research_development',
        errors
      ),
      research_development_yoy_pct: asNullableNumber(
        costsRaw.research_development_yoy_pct,
        'costs.research_development_yoy_pct',
        errors
      ),
      general_admin: asNullableNumber(costsRaw.general_admin, 'costs.general_admin', errors),
      general_admin_yoy_pct: asNullableNumber(
        costsRaw.general_admin_yoy_pct,
        'costs.general_admin_yoy_pct',
        errors
      ),
      one_off_expenses: parseOneOffExpenses(costsRaw.one_off_expenses, 'costs.one_off_expenses', errors),
      grade: asGrade(costsRaw.grade, 'costs.grade', errors),
    },
    balance_sheet: {
      cash: asNullableNumber(balanceRaw.cash, 'balance_sheet.cash', errors),
      short_term_investments: asNullableNumber(
        balanceRaw.short_term_investments,
        'balance_sheet.short_term_investments',
        errors
      ),
      debt: asNullableNumber(balanceRaw.debt, 'balance_sheet.debt', errors),
      net_cash: asNullableNumber(balanceRaw.net_cash, 'balance_sheet.net_cash', errors),
      operating_cash_flow: asNullableNumber(
        balanceRaw.operating_cash_flow,
        'balance_sheet.operating_cash_flow',
        errors
      ),
      free_cash_flow: asNullableNumber(
        balanceRaw.free_cash_flow,
        'balance_sheet.free_cash_flow',
        errors
      ),
      inventory: asNullableNumber(balanceRaw.inventory, 'balance_sheet.inventory', errors),
      accounts_receivable: asNullableNumber(
        balanceRaw.accounts_receivable,
        'balance_sheet.accounts_receivable',
        errors
      ),
      shares_outstanding: asNullableNumber(
        balanceRaw.shares_outstanding,
        'balance_sheet.shares_outstanding',
        errors
      ),
      share_count_yoy_growth_pct: asNullableNumber(
        balanceRaw.share_count_yoy_growth_pct,
        'balance_sheet.share_count_yoy_growth_pct',
        errors
      ),
      grade: asGrade(balanceRaw.grade, 'balance_sheet.grade', errors),
    },
    outlook: {
      revenue_guidance_low: asNullableNumber(
        outlookRaw.revenue_guidance_low,
        'outlook.revenue_guidance_low',
        errors
      ),
      revenue_guidance_high: asNullableNumber(
        outlookRaw.revenue_guidance_high,
        'outlook.revenue_guidance_high',
        errors
      ),
      eps_guidance_low: asNullableNumber(
        outlookRaw.eps_guidance_low,
        'outlook.eps_guidance_low',
        errors
      ),
      eps_guidance_high: asNullableNumber(
        outlookRaw.eps_guidance_high,
        'outlook.eps_guidance_high',
        errors
      ),
      guidance_change: asNullableString(outlookRaw.guidance_change, 'outlook.guidance_change', errors),
      management_outlook: asEnum(
        outlookRaw.management_outlook,
        'outlook.management_outlook',
        MANAGEMENT_OUTLOOKS,
        errors
      ),
      grade: asGrade(outlookRaw.grade, 'outlook.grade', errors),
    },
    earnings_quality: {
      recurring_profit: asNullableBoolean(
        qualityRaw.recurring_profit,
        'earnings_quality.recurring_profit',
        errors
      ),
      one_off_income: asNullableNumber(
        qualityRaw.one_off_income,
        'earnings_quality.one_off_income',
        errors
      ),
      one_off_income_description: asNullableString(
        qualityRaw.one_off_income_description,
        'earnings_quality.one_off_income_description',
        errors
      ),
      stock_based_compensation: asNullableNumber(
        qualityRaw.stock_based_compensation,
        'earnings_quality.stock_based_compensation',
        errors
      ),
      dilution_risk: asEnum(
        qualityRaw.dilution_risk,
        'earnings_quality.dilution_risk',
        DILUTION_RISKS,
        errors
      ),
      grade: asGrade(qualityRaw.grade, 'earnings_quality.grade', errors),
    },
    previous_comparison: {
      revenue_trend: asNullableString(previousRaw.revenue_trend, 'previous_comparison.revenue_trend', errors),
      margin_trend: asNullableString(previousRaw.margin_trend, 'previous_comparison.margin_trend', errors),
      cost_trend: asNullableString(previousRaw.cost_trend, 'previous_comparison.cost_trend', errors),
      cash_flow_trend: asNullableString(
        previousRaw.cash_flow_trend,
        'previous_comparison.cash_flow_trend',
        errors
      ),
      guidance_trend: asNullableString(
        previousRaw.guidance_trend,
        'previous_comparison.guidance_trend',
        errors
      ),
    },
    competitor: {
      name: asNullableString(competitorRaw.name, 'competitor.name', errors),
      ticker: asNullableString(competitorRaw.ticker, 'competitor.ticker', errors),
      revenue_growth_pct: asNullableNumber(
        competitorRaw.revenue_growth_pct,
        'competitor.revenue_growth_pct',
        errors
      ),
      gross_margin_pct: asNullableNumber(
        competitorRaw.gross_margin_pct,
        'competitor.gross_margin_pct',
        errors
      ),
      operating_margin_pct: asNullableNumber(
        competitorRaw.operating_margin_pct,
        'competitor.operating_margin_pct',
        errors
      ),
      comparison_summary: asNullableString(
        competitorRaw.comparison_summary,
        'competitor.comparison_summary',
        errors
      ),
    },
    analyst_sentiment: {
      consensus: asNullableString(analystRaw.consensus, 'analyst_sentiment.consensus', errors),
      buy_count: asNullableInteger(analystRaw.buy_count, 'analyst_sentiment.buy_count', errors),
      hold_count: asNullableInteger(analystRaw.hold_count, 'analyst_sentiment.hold_count', errors),
      sell_count: asNullableInteger(analystRaw.sell_count, 'analyst_sentiment.sell_count', errors),
      average_price_target: asNullableNumber(
        analystRaw.average_price_target,
        'analyst_sentiment.average_price_target',
        errors
      ),
      recent_rating_change: asNullableString(
        analystRaw.recent_rating_change,
        'analyst_sentiment.recent_rating_change',
        errors
      ),
      source_name: asNullableString(analystRaw.source_name, 'analyst_sentiment.source_name', errors),
      source_date: asNullableString(analystRaw.source_date, 'analyst_sentiment.source_date', errors),
    },
    assessment: {
      overall_grade: asGrade(assessmentRaw.overall_grade, 'assessment.overall_grade', errors),
      business_direction: asEnum(
        assessmentRaw.business_direction,
        'assessment.business_direction',
        BUSINESS_DIRECTIONS,
        errors
      ),
      investment_view: asEnum(
        assessmentRaw.investment_view,
        'assessment.investment_view',
        INVESTMENT_VIEWS,
        errors
      ),
      key_positive: asNullableString(assessmentRaw.key_positive, 'assessment.key_positive', errors),
      key_negative: asNullableString(assessmentRaw.key_negative, 'assessment.key_negative', errors),
      key_risk: asNullableString(assessmentRaw.key_risk, 'assessment.key_risk', errors),
      earnings_thesis: asNullableString(
        assessmentRaw.earnings_thesis,
        'assessment.earnings_thesis',
        errors
      ),
    },
    valuation: {
      current_price: asNullableNumber(valuationRaw.current_price, 'valuation.current_price', errors),
      market_cap: asNullableNumber(valuationRaw.market_cap, 'valuation.market_cap', errors),
      pe_ratio: asNullableNumber(valuationRaw.pe_ratio, 'valuation.pe_ratio', errors),
      price_to_sales: asNullableNumber(
        valuationRaw.price_to_sales,
        'valuation.price_to_sales',
        errors
      ),
      ev_to_sales: asNullableNumber(valuationRaw.ev_to_sales, 'valuation.ev_to_sales', errors),
      dcf_fair_value: asNullableNumber(
        valuationRaw.dcf_fair_value,
        'valuation.dcf_fair_value',
        errors
      ),
      valuation_grade: asGrade(valuationRaw.valuation_grade, 'valuation.valuation_grade', errors),
    },
    source: {
      source_type: asNullableString(sourceRaw.source_type, 'source.source_type', errors),
      source_name: asNullableString(sourceRaw.source_name, 'source.source_name', errors),
      source_url: asNullableString(sourceRaw.source_url, 'source.source_url', errors),
    },
  };

  if (errors.length > 0) {
    return { ok: false, value: null, errors };
  }
  return { ok: true, value, errors: [] };
}

export function categoryGradesFromPayload(
  payload: EarningsReviewPayload
): Array<{ category: GradeCategory; grade: EarningsGrade | null }> {
  return [
    { category: 'revenue', grade: payload.revenue.grade },
    { category: 'profitability', grade: payload.profitability.grade },
    { category: 'costs', grade: payload.costs.grade },
    { category: 'balance_sheet', grade: payload.balance_sheet.grade },
    { category: 'outlook', grade: payload.outlook.grade },
    { category: 'earnings_quality', grade: payload.earnings_quality.grade },
    { category: 'valuation', grade: payload.valuation.valuation_grade },
    { category: 'overall', grade: payload.assessment.overall_grade },
  ];
}

export function emptySection<T extends Record<string, unknown>>(keys: (keyof T)[]): T {
  return Object.fromEntries(keys.map((key) => [key, null])) as T;
}
