export type WorldMarketPeriod = 'today' | '3m' | '6m' | '1y' | '2y' | '5y' | '10y';

export const WORLD_MARKET_PERIOD_OPTIONS: { id: WorldMarketPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
  { id: '5y', label: '5 Years' },
  { id: '10y', label: '10 Years' },
];

export type WorldMarketViewMode = 'returns' | 'pe';

export type WorldMarketPeValuation = 'cheap' | 'fair' | 'expensive' | 'unavailable';

export type WorldMarketDataSource = 'FMP' | 'FRED';

/** ETF proxies used to estimate index P/E via FMP (trailing P/E on the quote). */
export const WORLD_MARKET_PE_SYMBOL_BY_ID: Record<string, string> = {
  us: 'SPY',
  uk: 'EWU',
  japan: 'EWJ',
  'hong-kong': 'EWH',
  europe: 'FEZ',
  china: 'MCHI',
  germany: 'EWG',
  france: 'EWQ',
  india: 'INDA',
  brazil: 'EWZ',
  australia: 'EWA',
  canada: 'EWC',
  'south-korea': 'EWY',
  taiwan: 'EWT',
  singapore: 'EWS',
  mexico: 'EWW',
  switzerland: 'EWL',
  'south-africa': 'EZA',
};

export interface WorldMarketRegionConfig {
  id: string;
  name: string;
  indexName: string;
  symbol: string;
  dataSource: WorldMarketDataSource;
  fredSeriesId?: string;
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-3 codes coloured on the choropleth map */
  countryCodes: string[];
  icon: string;
  note?: string;
}

export const WORLD_MARKET_REGIONS: WorldMarketRegionConfig[] = [
  {
    id: 'us',
    name: 'United States',
    indexName: 'S&P 500',
    symbol: '^GSPC',
    dataSource: 'FMP',
    lat: 39.8283,
    lng: -98.5795,
    countryCodes: ['USA'],
    icon: '🇺🇸',
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    indexName: 'FTSE 100',
    symbol: '^FTSE',
    dataSource: 'FMP',
    lat: 54.0,
    lng: -2.5,
    countryCodes: ['GBR'],
    icon: '🇬🇧',
  },
  {
    id: 'japan',
    name: 'Japan',
    indexName: 'Nikkei 225',
    symbol: '^N225',
    dataSource: 'FMP',
    lat: 36.2048,
    lng: 138.2529,
    countryCodes: ['JPN'],
    icon: '🇯🇵',
  },
  {
    id: 'hong-kong',
    name: 'Hong Kong',
    indexName: 'Hang Seng',
    symbol: '^HSI',
    dataSource: 'FMP',
    lat: 22.3193,
    lng: 114.1694,
    countryCodes: ['HKG'],
    icon: '🇭🇰',
    note: 'Hang Seng Index (Hong Kong)',
  },
  {
    id: 'europe',
    name: 'Eurozone',
    indexName: 'Euro Stoxx 50',
    symbol: '^STOXX50E',
    dataSource: 'FMP',
    lat: 50.1109,
    lng: 8.6821,
    countryCodes: ['DEU', 'FRA', 'ITA', 'ESP', 'NLD', 'BEL', 'AUT', 'IRL', 'FIN', 'PRT', 'GRC'],
    icon: '🇪🇺',
    note: 'Euro Stoxx 50 — broad euro-area benchmark',
  },
  {
    id: 'china',
    name: 'China',
    indexName: 'Share Price Index',
    symbol: 'CHINA',
    dataSource: 'FRED',
    fredSeriesId: 'SPASTT01CNQ661N',
    lat: 35.8617,
    lng: 104.1954,
    countryCodes: ['CHN'],
    icon: '🇨🇳',
    note: 'OECD mainland China share price index (monthly)',
  },
  {
    id: 'germany',
    name: 'Germany',
    indexName: 'Share Price Index',
    symbol: 'GERMANY',
    dataSource: 'FRED',
    fredSeriesId: 'SPASTT01DEM661N',
    lat: 51.1657,
    lng: 10.4515,
    countryCodes: ['DEU'],
    icon: '🇩🇪',
    note: 'OECD Germany share price index (monthly)',
  },
  {
    id: 'france',
    name: 'France',
    indexName: 'Share Price Index',
    symbol: 'FRANCE',
    dataSource: 'FRED',
    fredSeriesId: 'SPASTT01FRM661N',
    lat: 46.2276,
    lng: 2.2137,
    countryCodes: ['FRA'],
    icon: '🇫🇷',
    note: 'OECD France share price index (monthly)',
  },
  {
    id: 'india',
    name: 'India',
    indexName: 'Share Price Index',
    symbol: 'INDIA',
    dataSource: 'FRED',
    fredSeriesId: 'SPASTT01INM661N',
    lat: 20.5937,
    lng: 78.9629,
    countryCodes: ['IND'],
    icon: '🇮🇳',
    note: 'OECD India share price index (monthly)',
  },
  {
    id: 'brazil',
    name: 'Brazil',
    indexName: 'Share Price Index',
    symbol: 'BRAZIL',
    dataSource: 'FRED',
    fredSeriesId: 'SPASTT01BRM661N',
    lat: -14.235,
    lng: -51.9253,
    countryCodes: ['BRA'],
    icon: '🇧🇷',
    note: 'OECD Brazil share price index (monthly)',
  },
  {
    id: 'australia',
    name: 'Australia',
    indexName: 'Share Price Index',
    symbol: 'AUSTRALIA',
    dataSource: 'FRED',
    fredSeriesId: 'SPASTT01AUM661N',
    lat: -25.2744,
    lng: 133.7751,
    countryCodes: ['AUS'],
    icon: '🇦🇺',
    note: 'OECD Australia share price index (monthly)',
  },
];

/** Preset countries for the add-index form (ISO A3 + map marker centre). */
export const WORLD_MARKET_COUNTRY_PRESETS: {
  code: string;
  name: string;
  lat: number;
  lng: number;
  icon?: string;
}[] = [
  { code: 'USA', name: 'United States', lat: 39.8283, lng: -98.5795, icon: '🇺🇸' },
  { code: 'GBR', name: 'United Kingdom', lat: 54.0, lng: -2.5, icon: '🇬🇧' },
  { code: 'JPN', name: 'Japan', lat: 36.2048, lng: 138.2529, icon: '🇯🇵' },
  { code: 'HKG', name: 'Hong Kong', lat: 22.3193, lng: 114.1694, icon: '🇭🇰' },
  { code: 'CHN', name: 'China', lat: 35.8617, lng: 104.1954, icon: '🇨🇳' },
  { code: 'DEU', name: 'Germany', lat: 51.1657, lng: 10.4515, icon: '🇩🇪' },
  { code: 'FRA', name: 'France', lat: 46.2276, lng: 2.2137, icon: '🇫🇷' },
  { code: 'ITA', name: 'Italy', lat: 41.8719, lng: 12.5674, icon: '🇮🇹' },
  { code: 'ESP', name: 'Spain', lat: 40.4637, lng: -3.7492, icon: '🇪🇸' },
  { code: 'NLD', name: 'Netherlands', lat: 52.1326, lng: 5.2913, icon: '🇳🇱' },
  { code: 'BEL', name: 'Belgium', lat: 50.5039, lng: 4.4699, icon: '🇧🇪' },
  { code: 'AUT', name: 'Austria', lat: 47.5162, lng: 14.5501, icon: '🇦🇹' },
  { code: 'IRL', name: 'Ireland', lat: 53.4129, lng: -8.2439, icon: '🇮🇪' },
  { code: 'FIN', name: 'Finland', lat: 61.9241, lng: 25.7482, icon: '🇫🇮' },
  { code: 'PRT', name: 'Portugal', lat: 39.3999, lng: -8.2245, icon: '🇵🇹' },
  { code: 'GRC', name: 'Greece', lat: 39.0742, lng: 21.8243, icon: '🇬🇷' },
  { code: 'IND', name: 'India', lat: 20.5937, lng: 78.9629, icon: '🇮🇳' },
  { code: 'BRA', name: 'Brazil', lat: -14.235, lng: -51.9253, icon: '🇧🇷' },
  { code: 'AUS', name: 'Australia', lat: -25.2744, lng: 133.7751, icon: '🇦🇺' },
  { code: 'CAN', name: 'Canada', lat: 56.1304, lng: -106.3468, icon: '🇨🇦' },
  { code: 'KOR', name: 'South Korea', lat: 35.9078, lng: 127.7669, icon: '🇰🇷' },
  { code: 'MEX', name: 'Mexico', lat: 23.6345, lng: -102.5528, icon: '🇲🇽' },
  { code: 'CHE', name: 'Switzerland', lat: 46.8182, lng: 8.2275, icon: '🇨🇭' },
  { code: 'SWE', name: 'Sweden', lat: 60.1282, lng: 18.6435, icon: '🇸🇪' },
  { code: 'ZAF', name: 'South Africa', lat: -30.5595, lng: 22.9375, icon: '🇿🇦' },
];

export function centroidFromCountryCodes(codes: string[]): { lat: number; lng: number; icon: string } {
  const presets = codes
    .map((code) => WORLD_MARKET_COUNTRY_PRESETS.find((p) => p.code === code))
    .filter(Boolean) as typeof WORLD_MARKET_COUNTRY_PRESETS;

  if (presets.length === 0) {
    return { lat: 20, lng: 0, icon: '📊' };
  }

  const lat = presets.reduce((s, p) => s + p.lat, 0) / presets.length;
  const lng = presets.reduce((s, p) => s + p.lng, 0) / presets.length;
  const icon = presets[0].icon ?? '📊';
  return { lat, lng, icon };
}

export function parseCountryCodesInput(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{3}$/.test(c));
}

export type WorldMarketStatus = 'growing' | 'falling' | 'flat' | 'unavailable';

export interface WorldMarketRegionResult {
  id: string;
  name: string;
  indexName: string;
  symbol: string;
  lat: number;
  lng: number;
  countryCodes: string[];
  icon: string;
  note?: string;
  price: number | null;
  changePercent: number | null;
  status: WorldMarketStatus;
  dataSource: string | null;
  asOfDate: string | null;
  peRatio: number | null;
  peValuation: WorldMarketPeValuation;
  peSymbol: string | null;
}

export function classifyMarketStatus(changePercent: number | null): WorldMarketStatus {
  if (changePercent === null || !Number.isFinite(changePercent)) return 'unavailable';
  if (changePercent > 0.05) return 'growing';
  if (changePercent < -0.05) return 'falling';
  return 'flat';
}

/** Full-scale return % for colour grading (values beyond this saturate at the extremes). */
export function gradeSpanForPeriod(period: WorldMarketPeriod): number {
  switch (period) {
    case 'today':
      return 4;
    case '3m':
      return 8;
    case '6m':
      return 12;
    case '1y':
      return 40;
    case '2y':
      return 55;
    case '5y':
      return 90;
    case '10y':
      return 130;
    default:
      return 35;
  }
}

type Rgb = { r: number; g: number; b: number };

/** Anchor stops on a -40 … +40 normalized scale (before period scaling). */
const GRADE_STOPS: { pct: number; rgb: Rgb }[] = [
  { pct: -40, rgb: { r: 127, g: 29, b: 29 } },
  { pct: -25, rgb: { r: 220, g: 38, b: 38 } },
  { pct: -12, rgb: { r: 248, g: 113, b: 113 } },
  { pct: -5, rgb: { r: 251, g: 146, b: 60 } },
  { pct: 0, rgb: { r: 245, g: 158, b: 11 } },
  { pct: 5, rgb: { r: 250, g: 204, b: 21 } },
  { pct: 12, rgb: { r: 253, g: 224, b: 71 } },
  { pct: 20, rgb: { r: 234, g: 179, b: 8 } },
  { pct: 28, rgb: { r: 163, g: 230, b: 53 } },
  { pct: 40, rgb: { r: 34, g: 197, b: 94 } },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Map raw return % to -40 … +40 using period-appropriate span. */
export function normalizeReturnForGrade(
  changePercent: number,
  period: WorldMarketPeriod = '1y'
): number {
  const span = gradeSpanForPeriod(period);
  const normalized = (changePercent / span) * 40;
  return Math.max(-40, Math.min(40, normalized));
}

function interpolateGradeColor(normalizedPct: number): Rgb {
  const pct = Math.max(-40, Math.min(40, normalizedPct));

  if (pct <= GRADE_STOPS[0].pct) return GRADE_STOPS[0].rgb;
  if (pct >= GRADE_STOPS[GRADE_STOPS.length - 1].pct) {
    return GRADE_STOPS[GRADE_STOPS.length - 1].rgb;
  }

  for (let i = 0; i < GRADE_STOPS.length - 1; i++) {
    const low = GRADE_STOPS[i];
    const high = GRADE_STOPS[i + 1];
    if (pct >= low.pct && pct <= high.pct) {
      const t = (pct - low.pct) / (high.pct - low.pct);
      return lerpRgb(low.rgb, high.rgb, t);
    }
  }

  return GRADE_STOPS[0].rgb;
}

/** Continuous green ↔ amber ↔ red fill for maps and markers. */
export function returnColor(
  changePercent: number | null,
  period: WorldMarketPeriod = '1y'
): string {
  if (changePercent === null || !Number.isFinite(changePercent)) return '#9ca3af';
  const normalized = normalizeReturnForGrade(changePercent, period);
  return rgbToHex(interpolateGradeColor(normalized));
}

export function statusColor(status: WorldMarketStatus): string {
  switch (status) {
    case 'growing':
      return '#22c55e';
    case 'falling':
      return '#dc2626';
    case 'flat':
      return '#f59e0b';
    default:
      return '#9ca3af';
  }
}

export interface ReturnGradeStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

/** Badge / table cell styling from graded return colour. */
export function returnGradeStyle(
  changePercent: number | null,
  period: WorldMarketPeriod = '1y'
): ReturnGradeStyle {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return {
      backgroundColor: 'rgb(243 244 246)',
      color: 'rgb(107 114 128)',
      borderColor: 'rgb(209 213 219)',
    };
  }

  const normalized = normalizeReturnForGrade(changePercent, period);
  const rgb = interpolateGradeColor(normalized);
  const hex = rgbToHex(rgb);
  const text = relativeLuminance(rgb) > 0.58 ? '#1f2937' : '#ffffff';

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color: hex,
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`,
  };
}

/** @deprecated Use returnGradeStyle for continuous colours. */
export function statusBadgeClass(status: WorldMarketStatus): string {
  switch (status) {
    case 'growing':
      return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800';
    case 'falling':
      return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800';
    case 'flat':
      return 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    default:
      return 'bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
  }
}

/** @deprecated Use returnGradeStyle for continuous colours. */
export function returnTextClass(status: WorldMarketStatus): string {
  switch (status) {
    case 'growing':
      return 'text-green-700 dark:text-green-400';
    case 'falling':
      return 'text-red-700 dark:text-red-400';
    case 'flat':
      return 'text-amber-700 dark:text-amber-400';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
}

export function statusLabel(status: WorldMarketStatus): string {
  switch (status) {
    case 'growing':
      return 'Growing';
    case 'falling':
      return 'Falling';
    case 'flat':
      return 'Flat';
    default:
      return 'No data';
  }
}

/** Rough index valuation bands (trailing P/E on regional ETF proxy). */
export function classifyPeValuation(pe: number | null): WorldMarketPeValuation {
  if (pe === null || !Number.isFinite(pe) || pe <= 0) return 'unavailable';
  if (pe < 14) return 'cheap';
  if (pe <= 22) return 'fair';
  return 'expensive';
}

export function peValuationLabel(valuation: WorldMarketPeValuation): string {
  switch (valuation) {
    case 'cheap':
      return 'Cheap';
    case 'fair':
      return 'Fair value';
    case 'expensive':
      return 'Expensive';
    default:
      return 'No data';
  }
}

export function peValuationColor(valuation: WorldMarketPeValuation): string {
  switch (valuation) {
    case 'cheap':
      return '#22c55e';
    case 'fair':
      return '#f59e0b';
    case 'expensive':
      return '#dc2626';
    default:
      return '#9ca3af';
  }
}

export function peValuationStyle(valuation: WorldMarketPeValuation): ReturnGradeStyle {
  const color = peValuationColor(valuation);
  if (valuation === 'unavailable') {
    return {
      backgroundColor: 'rgb(243 244 246)',
      color: 'rgb(107 114 128)',
      borderColor: 'rgb(209 213 219)',
    };
  }

  const rgb =
    valuation === 'cheap'
      ? { r: 34, g: 197, b: 94 }
      : valuation === 'fair'
        ? { r: 245, g: 158, b: 11 }
        : { r: 220, g: 38, b: 38 };

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color,
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`,
  };
}

export function regionMapColor(
  region: Pick<WorldMarketRegionResult, 'changePercent' | 'peValuation'>,
  viewMode: WorldMarketViewMode,
  period: WorldMarketPeriod = '1y'
): string {
  if (viewMode === 'pe') {
    return peValuationColor(region.peValuation);
  }
  return returnColor(region.changePercent, period);
}
