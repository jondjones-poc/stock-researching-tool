/** Country/region lenses for the sectors heatmap (same sectors, local ETF proxies). */

export type SectorRegionCode =
  | 'us'
  | 'uk'
  | 'jp'
  | 'eu'
  | 'world'
  | 'cn'
  | 'in'
  | 'ca'
  | 'au'
  | 'em';

export interface SectorRegion {
  code: SectorRegionCode;
  /** Short label under the icon */
  label: string;
  /** Full name shown in the hover popup */
  region: string;
  /** One-line description for the popup */
  blurb: string;
  /** Flag / emblem shown in the submenu */
  icon: string;
}

export const SECTOR_REGIONS: SectorRegion[] = [
  {
    code: 'us',
    label: 'US',
    region: 'United States',
    blurb: 'S&P sector ETFs (XLK, XLF, XLE…)',
    icon: '🇺🇸',
  },
  {
    code: 'uk',
    label: 'UK',
    region: 'United Kingdom',
    blurb: 'UK / Europe sector proxies (EWU, EUFN…)',
    icon: '🇬🇧',
  },
  {
    code: 'jp',
    label: 'Japan',
    region: 'Japan',
    blurb: 'Japan equity proxies (EWJ, DXJ…)',
    icon: '🇯🇵',
  },
  {
    code: 'eu',
    label: 'Europe',
    region: 'Europe',
    blurb: 'Europe sector & country ETFs (VGK, EUFN…)',
    icon: '🇪🇺',
  },
  {
    code: 'world',
    label: 'World',
    region: 'World / Global',
    blurb: 'Global sector ETFs (ACWI, IXG, IXC…)',
    icon: '🌐',
  },
  {
    code: 'cn',
    label: 'China',
    region: 'China',
    blurb: 'China sector ETFs (KWEB, CHIX, MCHI…)',
    icon: '🇨🇳',
  },
  {
    code: 'in',
    label: 'India',
    region: 'India',
    blurb: 'India market ETFs (INDA, INDY…)',
    icon: '🇮🇳',
  },
  {
    code: 'ca',
    label: 'Canada',
    region: 'Canada',
    blurb: 'Canada market ETFs (EWC…)',
    icon: '🇨🇦',
  },
  {
    code: 'au',
    label: 'Australia',
    region: 'Australia',
    blurb: 'Australia market ETFs (EWA…)',
    icon: '🇦🇺',
  },
  {
    code: 'em',
    label: 'EM',
    region: 'Emerging Markets',
    blurb: 'Emerging-market ETFs (EEM…)',
    icon: '🌍',
  },
];

export const DEFAULT_SECTOR_REGION: SectorRegionCode = 'us';

export function parseSectorRegion(value: string | null | undefined): SectorRegionCode {
  const code = String(value || '')
    .trim()
    .toLowerCase();
  if (SECTOR_REGIONS.some((r) => r.code === code)) {
    return code as SectorRegionCode;
  }
  return DEFAULT_SECTOR_REGION;
}

export function getSectorRegion(code: SectorRegionCode): SectorRegion {
  return SECTOR_REGIONS.find((r) => r.code === code) ?? SECTOR_REGIONS[0];
}
