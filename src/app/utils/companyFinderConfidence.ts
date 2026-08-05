/**
 * Modular Confidence Score for Deep Value Stocks.
 * Estimates how reliable screening data is (not investment quality).
 * Uses free SEC EDGAR metadata + filing text only.
 */

export interface ConfidenceFinding {
  code: string;
  message: string;
  points: number;
}

export interface ConfidenceContext {
  /** Filing date of the latest periodic report (from SEC metadata). */
  latestFilingDate: string | null;
  latestForm: string | null;
  latestAccession: string | null;
  /** True if the issuer files 20-F or 40-F. */
  isForeignIssuer: boolean;
  /** Lowercased plain text of the latest periodic filing (may be empty if unavailable). */
  latestFilingText: string;
  /** Lowercased concatenated text of filings from the last ~2 years (for reverse-split scan). */
  recentTwoYearText: string;
  /** Optional as-of date for staleness (defaults to now). */
  asOf?: Date;
}

export interface ConfidenceRule {
  id: string;
  evaluate: (ctx: ConfidenceContext) => ConfidenceFinding | ConfidenceFinding[] | null;
}

export interface ConfidenceResult {
  score: number;
  findings: ConfidenceFinding[];
}

export interface ConfidenceFlags {
  isForeignIssuer: boolean;
  goingConcern: boolean;
  reverseSplit: boolean;
  discontinued: boolean;
}

const MAX_SCORE = 100;

function daysBetween(fromIsoDate: string, to: Date): number {
  const from = new Date(`${fromIsoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000));
}

function asFindings(
  result: ConfidenceFinding | ConfidenceFinding[] | null
): ConfidenceFinding[] {
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

/** Staleness: >540 days → −50; else >365 days → −30. */
export const ruleStaleFiling: ConfidenceRule = {
  id: 'stale_filing',
  evaluate(ctx) {
    if (!ctx.latestFilingDate) return null;
    const days = daysBetween(ctx.latestFilingDate, ctx.asOf ?? new Date());
    if (days > 540) {
      return {
        code: 'stale_540',
        message: 'Financial data may be stale.',
        points: 50,
      };
    }
    if (days > 365) {
      return {
        code: 'stale_365',
        message: 'Financial data may be stale.',
        points: 30,
      };
    }
    return null;
  },
};

export const ruleForeignIssuer: ConfidenceRule = {
  id: 'foreign_issuer',
  evaluate(ctx) {
    if (!ctx.isForeignIssuer) return null;
    return {
      code: 'foreign_filer',
      message: 'Annual filer - financials update less frequently.',
      points: 10,
    };
  },
};

export const ruleGoingConcern: ConfidenceRule = {
  id: 'going_concern',
  evaluate(ctx) {
    const text = ctx.latestFilingText;
    if (!text) return null;
    if (
      /going\s+concern/i.test(text) ||
      /substantial\s+doubt/i.test(text) ||
      /material\s+uncertainty/i.test(text)
    ) {
      return {
        code: 'going_concern',
        message: 'Going concern / substantial doubt language found in latest filing.',
        points: 40,
      };
    }
    return null;
  },
};

export const ruleReverseSplit: ConfidenceRule = {
  id: 'reverse_split',
  evaluate(ctx) {
    const text = ctx.recentTwoYearText;
    if (!text) return null;
    if (
      /reverse\s+split/i.test(text) ||
      /share\s+consolidation/i.test(text) ||
      /1-for-/i.test(text)
    ) {
      return {
        code: 'reverse_split',
        message: 'Reverse split / share consolidation mentioned in filings (last 2 years).',
        points: 20,
      };
    }
    return null;
  },
};

export const ruleDiscontinuedOps: ConfidenceRule = {
  id: 'discontinued_ops',
  evaluate(ctx) {
    const text = ctx.latestFilingText;
    if (!text) return null;
    if (
      /discontinued\s+operations/i.test(text) ||
      /held\s+for\s+sale/i.test(text) ||
      /\bdisposed\b/i.test(text) ||
      /sale\s+of\s+subsidiary/i.test(text)
    ) {
      return {
        code: 'discontinued_ops',
        message: 'Discontinued operations / asset sale language found in latest filing.',
        points: 15,
      };
    }
    return null;
  },
};

/** Default rule set — append new rules here. */
export const CONFIDENCE_RULES: ConfidenceRule[] = [
  ruleStaleFiling,
  ruleForeignIssuer,
  ruleGoingConcern,
  ruleReverseSplit,
  ruleDiscontinuedOps,
];

export function computeConfidenceScore(
  ctx: ConfidenceContext,
  rules: ConfidenceRule[] = CONFIDENCE_RULES
): ConfidenceResult {
  const findings: ConfidenceFinding[] = [];
  for (const rule of rules) {
    findings.push(...asFindings(rule.evaluate(ctx)));
  }
  const deducted = findings.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(MAX_SCORE, MAX_SCORE - deducted));
  return { score, findings };
}

/** Recompute score from cached flags + filing date (no SEC text re-download). */
export function computeConfidenceFromFlags(input: {
  latestFilingDate: string | null;
  latestForm?: string | null;
  latestAccession?: string | null;
  flags: ConfidenceFlags;
  asOf?: Date;
}): ConfidenceResult {
  return computeConfidenceScore({
    latestFilingDate: input.latestFilingDate,
    latestForm: input.latestForm ?? null,
    latestAccession: input.latestAccession ?? null,
    isForeignIssuer: input.flags.isForeignIssuer,
    latestFilingText: [
      input.flags.goingConcern ? 'going concern substantial doubt material uncertainty' : '',
      input.flags.discontinued
        ? 'discontinued operations held for sale disposed sale of subsidiary'
        : '',
    ].join(' '),
    recentTwoYearText: input.flags.reverseSplit
      ? 'reverse split share consolidation 1-for-'
      : '',
    asOf: input.asOf,
  });
}

/** Map 0–100 confidence to 0–5 stars for the grid. */
export function confidenceToStars(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  if (score >= 10) return 1;
  return 0;
}
