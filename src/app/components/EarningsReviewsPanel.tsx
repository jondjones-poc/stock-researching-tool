'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  categoryGradesFromPayload,
  gradeScore,
  validateEarningsReviewJson,
  type EarningsReviewPayload,
} from '../utils/earningsReview';
import { buildEarningsReviewAskAiPrompt } from '../utils/buildEarningsReviewAskAiPrompt';

type GradeEntry = { grade: string | null; score: number | null };

type TrendObject = {
  revenue_trend?: string | null;
  margin_trend?: string | null;
  cost_trend?: string | null;
  cash_flow_trend?: string | null;
  guidance_trend?: string | null;
};

type CompetitorObject = {
  name?: string | null;
  ticker?: string | null;
  revenue_growth_pct?: number | null;
  gross_margin_pct?: number | null;
  operating_margin_pct?: number | null;
  comparison_summary?: string | null;
};

type AnalystObject = {
  consensus?: string | null;
  buy_count?: number | null;
  hold_count?: number | null;
  sell_count?: number | null;
  average_price_target?: number | null;
  recent_rating_change?: string | null;
  source_name?: string | null;
  source_date?: string | null;
};

export type EarningsReviewRow = {
  id: number;
  company_id: number;
  ticker: string;
  company_name: string | null;
  industry: string | null;
  fiscal_year: number;
  fiscal_quarter: number;
  period_label: string;
  overall_grade: string | null;
  previous_grade: string | null;
  grade_direction: string | null;
  business_direction: string | null;
  investment_view: string | null;
  management_outlook: string | null;
  guidance_change: string | null;
  one_off_income_description: string | null;
  dilution_risk: string | null;
  earnings_thesis: string | null;
  key_positive: string | null;
  key_negative: string | null;
  key_risk: string | null;
  valuation_grade: string | null;
  currency: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
  previous_comparison: TrendObject | null;
  competitor: CompetitorObject | null;
  analyst_sentiment: AnalystObject | null;
  grades: Record<string, GradeEntry>;
  financials: Record<string, number | boolean | Array<Record<string, unknown>> | null>;
  raw_json?: unknown;
};

type ValidationError = { path: string; message: string };

function gradeClass(grade: string | null | undefined): string {
  if (!grade) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  if (grade.startsWith('A')) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (grade.startsWith('C')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
}

function money(row: EarningsReviewRow, key: string): string {
  const value = row.financials[key];
  return formatMoney(typeof value === 'number' ? value : null, row.currency || 'USD');
}

function pct(row: EarningsReviewRow, key: string): string {
  const value = row.financials[key];
  return formatPct(typeof value === 'number' ? value : null);
}

function qty(row: EarningsReviewRow, key: string, digits = 2): string {
  const value = row.financials[key];
  return formatNum(typeof value === 'number' ? value : null, digits);
}

function directionLabel(direction: string | null | undefined): string {
  if (!direction) return '—';
  if (direction === 'improving') return 'Improving';
  if (direction === 'declining') return 'Declining';
  if (direction === 'flat' || direction === 'stable') return 'Stable';
  return direction;
}

function formatMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${symbol}${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">{value}</div>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string | null | undefined }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-sm font-semibold ${gradeClass(grade)}`}>
      {grade || '—'}
    </span>
  );
}

function Card({
  title,
  grade,
  children,
}: {
  title: string;
  grade: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <GradeBadge grade={grade} />
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function previewRowFromPayload(payload: EarningsReviewPayload): EarningsReviewRow {
  const grades = Object.fromEntries(
    categoryGradesFromPayload(payload).map((row) => [
      row.category,
      { grade: row.grade, score: gradeScore(row.grade) },
    ])
  );

  return {
    id: 0,
    company_id: 0,
    ticker: payload.company.ticker,
    company_name: payload.company.name,
    industry: payload.company.industry,
    fiscal_year: payload.earnings_period.fiscal_year,
    fiscal_quarter: payload.earnings_period.fiscal_quarter,
    period_label: payload.earnings_period.period_label,
    overall_grade: payload.assessment.overall_grade,
    previous_grade: null,
    grade_direction: null,
    business_direction: payload.assessment.business_direction,
    investment_view: payload.assessment.investment_view,
    management_outlook: payload.outlook.management_outlook,
    guidance_change: payload.outlook.guidance_change,
    one_off_income_description: payload.earnings_quality.one_off_income_description,
    dilution_risk: payload.earnings_quality.dilution_risk,
    earnings_thesis: payload.assessment.earnings_thesis,
    key_positive: payload.assessment.key_positive,
    key_negative: payload.assessment.key_negative,
    key_risk: payload.assessment.key_risk,
    valuation_grade: payload.valuation.valuation_grade,
    currency: payload.company.currency,
    source_type: payload.source.source_type,
    source_name: payload.source.source_name,
    source_url: payload.source.source_url,
    previous_comparison: payload.previous_comparison,
    competitor: payload.competitor,
    analyst_sentiment: payload.analyst_sentiment,
    grades,
    financials: {
      revenue: payload.revenue.value,
      revenue_yoy_growth_pct: payload.revenue.yoy_growth_pct,
      revenue_qoq_growth_pct: payload.revenue.qoq_growth_pct,
      revenue_estimate: payload.revenue.analyst_estimate,
      revenue_surprise_pct: payload.revenue.surprise_pct,
      eps: payload.profitability.eps,
      eps_estimate: payload.profitability.eps_estimate,
      eps_surprise_pct: payload.profitability.eps_surprise_pct,
      gross_profit: payload.profitability.gross_profit,
      gross_margin_pct: payload.profitability.gross_margin_pct,
      gross_margin_prior_pct: payload.profitability.gross_margin_prior_pct,
      operating_income: payload.profitability.operating_income,
      operating_margin_pct: payload.profitability.operating_margin_pct,
      net_income: payload.profitability.net_income,
      profitability_free_cash_flow: payload.profitability.free_cash_flow,
      operating_expenses: payload.costs.operating_expenses,
      operating_expenses_yoy_pct: payload.costs.operating_expenses_yoy_pct,
      cost_of_revenue: payload.costs.cost_of_revenue,
      cost_of_revenue_yoy_pct: payload.costs.cost_of_revenue_yoy_pct,
      sales_marketing: payload.costs.sales_marketing,
      sales_marketing_yoy_pct: payload.costs.sales_marketing_yoy_pct,
      research_development: payload.costs.research_development,
      research_development_yoy_pct: payload.costs.research_development_yoy_pct,
      general_admin: payload.costs.general_admin,
      general_admin_yoy_pct: payload.costs.general_admin_yoy_pct,
      one_off_expenses: payload.costs.one_off_expenses,
      cash: payload.balance_sheet.cash,
      short_term_investments: payload.balance_sheet.short_term_investments,
      debt: payload.balance_sheet.debt,
      net_cash: payload.balance_sheet.net_cash,
      free_cash_flow: payload.balance_sheet.free_cash_flow,
      operating_cash_flow: payload.balance_sheet.operating_cash_flow,
      inventory: payload.balance_sheet.inventory,
      accounts_receivable: payload.balance_sheet.accounts_receivable,
      shares_outstanding: payload.balance_sheet.shares_outstanding,
      share_count_yoy_growth_pct: payload.balance_sheet.share_count_yoy_growth_pct,
      revenue_guidance_low: payload.outlook.revenue_guidance_low,
      revenue_guidance_high: payload.outlook.revenue_guidance_high,
      eps_guidance_low: payload.outlook.eps_guidance_low,
      eps_guidance_high: payload.outlook.eps_guidance_high,
      recurring_profit: payload.earnings_quality.recurring_profit,
      one_off_income: payload.earnings_quality.one_off_income,
      stock_based_compensation: payload.earnings_quality.stock_based_compensation,
      current_price: payload.valuation.current_price,
      market_cap: payload.valuation.market_cap,
      pe_ratio: payload.valuation.pe_ratio,
      price_to_sales: payload.valuation.price_to_sales,
      ev_to_sales: payload.valuation.ev_to_sales,
      dcf_fair_value: payload.valuation.dcf_fair_value,
    },
  };
}

export default function EarningsReviewsPanel({
  symbol,
  companyId,
}: {
  symbol: string;
  companyId?: number | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [reviews, setReviews] = useState<EarningsReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [askAiCopied, setAskAiCopied] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [draft, setDraft] = useState<{
    review: unknown;
    filename: string;
    row: EarningsReviewRow;
  } | null>(null);
  const [pending, setPending] = useState<{
    review: unknown;
    filename: string;
    ticker: string;
    periodLabel?: string;
    existingGrade?: string | null;
    needsCompany?: boolean;
  } | null>(null);
  const [companyChoices, setCompanyChoices] = useState<Array<{ id: number; stock: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch(`/api/earnings-reviews?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load earnings reviews');
        setHint(json.hint || null);
        setReviews([]);
        return;
      }
      const rows: EarningsReviewRow[] = json.data || [];
      setReviews(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load earnings reviews');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  const savedSelected =
    reviews.find((row) => Number(row.id) === Number(selectedId)) ??
    (selectedId == null ? reviews[0] ?? null : null);
  const selected = draft?.row ?? savedSelected;
  const existingForDraft = draft
    ? reviews.find(
        (row) =>
          row.fiscal_year === draft.row.fiscal_year &&
          row.fiscal_quarter === draft.row.fiscal_quarter
      ) ?? null
    : null;
  const tickerMismatch =
    Boolean(draft && symbol && draft.row.ticker && draft.row.ticker !== symbol.toUpperCase());

  const chartData = useMemo(
    () =>
      [...reviews]
        .sort((a, b) => a.fiscal_year - b.fiscal_year || a.fiscal_quarter - b.fiscal_quarter)
        .map((row) => ({
          period: row.period_label,
          overallScore: row.grades.overall?.score ?? null,
          overallGrade: row.overall_grade,
          revenueGrowth: typeof row.financials.revenue_yoy_growth_pct === 'number' ? row.financials.revenue_yoy_growth_pct : null,
          eps: typeof row.financials.eps === 'number' ? row.financials.eps : null,
          grossMargin: typeof row.financials.gross_margin_pct === 'number' ? row.financials.gross_margin_pct : null,
          operatingMargin: typeof row.financials.operating_margin_pct === 'number' ? row.financials.operating_margin_pct : null,
          fcf: typeof row.financials.free_cash_flow === 'number' ? row.financials.free_cash_flow : null,
          shares: typeof row.financials.shares_outstanding === 'number' ? row.financials.shares_outstanding : null,
          dilution: typeof row.financials.share_count_yoy_growth_pct === 'number' ? row.financials.share_count_yoy_growth_pct : null,
        })),
    [reviews]
  );

  async function saveReview(
    review: unknown,
    filename: string,
    extras: { replace?: boolean; createCompany?: boolean; companyId?: number } = {}
  ) {
    setSaving(true);
    setValidationErrors([]);
    setError(null);
    try {
      const res = await fetch('/api/earnings-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review,
          filename,
          companyId: extras.companyId ?? companyId ?? undefined,
          ...extras,
        }),
      });
      const json = await res.json();
      if (res.status === 400) {
        setValidationErrors(json.errors || [{ path: '', message: json.error }]);
        setPending(null);
        return;
      }
      if (res.status === 409 && json.code === 'COMPANY_NOT_FOUND') {
        const listRes = await fetch('/api/stock-valuations/list?limit=500');
        const listJson = await listRes.json();
        setCompanyChoices(listJson.data || []);
        setPending({
          review,
          filename,
          ticker: json.ticker,
          needsCompany: true,
        });
        return;
      }
      if (res.status === 409 && json.code === 'DUPLICATE_QUARTER') {
        setPending({
          review,
          filename,
          ticker: json.ticker,
          periodLabel: json.existing?.period_label,
          existingGrade: json.existing?.overall_grade,
        });
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Failed to save earnings review');
        setHint(json.hint || null);
        return;
      }
      setPending(null);
      setDraft(null);
      setConfirmDelete(false);
      await load();
      if (json.id) setSelectedId(json.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview() {
    if (!savedSelected) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/earnings-reviews?id=${savedSelected.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to delete earnings review');
        return;
      }
      setConfirmDelete(false);
      setSelectedId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  function selectSavedReview(row: EarningsReviewRow) {
    setDraft(null);
    setPending(null);
    setConfirmDelete(false);
    setValidationErrors([]);
    setError(null);
    setSelectedId(Number(row.id));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function copyAskAiPrompt() {
    const json = draft?.review ?? savedSelected?.raw_json ?? null;
    if (json == null) {
      setError('No earnings review JSON available to send to AI.');
      return;
    }
    const prompt = buildEarningsReviewAskAiPrompt(json, {
      ticker: selected?.ticker || symbol,
      periodLabel: selected?.period_label,
      filename: draft?.filename ?? null,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setAskAiCopied(true);
      setError(null);
      window.setTimeout(() => setAskAiCopied(false), 2500);
    } catch {
      setError('Could not copy the Ask AI prompt. Check clipboard permissions.');
    }
  }

  function onFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please upload a .json file.');
      return;
    }
    setError(null);
    setHint(null);
    setValidationErrors([]);
    setPending(null);
    setConfirmDelete(false);
    void file.text().then((text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError('File is not valid JSON.');
        return;
      }
      const validated = validateEarningsReviewJson(parsed);
      if (!validated.ok) {
        setDraft(null);
        setValidationErrors(validated.errors);
        return;
      }
      setDraft({
        review: parsed,
        filename: file.name,
        row: previewRowFromPayload(validated.value),
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Earnings Reviews</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onFile(file);
              }}
            />
            {draft ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void saveReview(draft.review, draft.filename, {
                      replace: Boolean(existingForDraft),
                    })
                  }
                  disabled={saving || !symbol}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
                >
                  {saving
                    ? 'Saving…'
                    : existingForDraft
                      ? 'Replace existing review'
                      : 'Save earnings review'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setPending(null);
                    setValidationErrors([]);
                  }}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Discard
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={saving || !symbol}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
              >
                Upload New Earnings Report
              </button>
            )}
          </div>
        </div>

        {draft ? (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p>
              Review the data below, then save. This has not been written to the database yet.
              {draft.filename ? ` File: ${draft.filename}` : ''}
            </p>
            {existingForDraft ? (
              <p className="mt-2">
                A saved review already exists for {draft.row.period_label}
                {existingForDraft.overall_grade ? ` (grade ${existingForDraft.overall_grade})` : ''}.
                Saving will replace it.
              </p>
            ) : null}
            {tickerMismatch ? (
              <p className="mt-2">
                JSON ticker is {draft.row.ticker}, but this page is {symbol.toUpperCase()}. Saving
                will still attach it to this company.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
            {hint ? <div className="mt-1 text-xs">{hint}</div> : null}
          </div>
        ) : null}

        {validationErrors.length > 0 ? (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            <div className="font-semibold mb-1">JSON validation failed</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {validationErrors.map((item, index) => (
                <li key={`${item.path}-${index}`}>
                  {item.path ? <span className="font-mono">{item.path}: </span> : null}
                  {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pending?.needsCompany ? (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
            <p className="text-amber-900 dark:text-amber-200 mb-3">
              No company matched ticker <span className="font-semibold">{pending.ticker}</span>.
              Create it from this ticker, or link the review to an existing company.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm"
                onClick={() =>
                  void saveReview(pending.review, pending.filename, { createCompany: true })
                }
              >
                Create {pending.ticker}
              </button>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">Select existing company…</option>
                {companyChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.stock}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedCompanyId}
                className="px-3 py-1.5 bg-gray-800 text-white rounded-md text-sm disabled:opacity-50"
                onClick={() =>
                  void saveReview(pending.review, pending.filename, {
                    companyId: Number(selectedCompanyId),
                  })
                }
              >
                Use selected
              </button>
              <button type="button" className="text-sm underline" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {pending && !pending.needsCompany ? (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
            <p className="text-amber-900 dark:text-amber-200 mb-3">
              A review already exists for {pending.ticker} {pending.periodLabel}
              {pending.existingGrade ? ` (grade ${pending.existingGrade})` : ''}. Replace it?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm"
                onClick={() => void saveReview(pending.review, pending.filename, { replace: true })}
              >
                Replace existing review
              </button>
              <button type="button" className="text-sm underline" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="text-gray-500 dark:text-gray-400 py-8 text-center">Loading…</div>
        ) : !selected ? (
          <div className="text-gray-500 dark:text-gray-400 py-8 text-center">
            No earnings reviews yet.
          </div>
        ) : (
          <div ref={formRef}>
            {reviews.length > 0 ? (
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-2">
                  {reviews.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => selectSavedReview(row)}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        Number(row.id) === Number(savedSelected?.id) && !draft
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{row.period_label}</span>
                      <span className="ml-2">
                        <GradeBadge grade={row.overall_grade} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Company</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selected.company_name || selected.ticker}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{selected.ticker}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Quarter</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selected.period_label}
                  {draft ? (
                    <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Unsaved
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Overall Grade</div>
                <div className="mt-1 flex items-center gap-2">
                  <GradeBadge grade={selected.overall_grade} />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {directionLabel(selected.grade_direction)}
                    {selected.previous_grade ? ` vs ${selected.previous_grade}` : ''}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selected.business_direction || '—'}
                  {selected.investment_view ? ` · ${selected.investment_view}` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Valuation grade</div>
                <div className="mt-1">
                  <GradeBadge grade={selected.valuation_grade} />
                </div>
                <div className="text-[11px] text-gray-400 mt-1">Not mixed into earnings grade</div>
              </div>
            </div>
            <div className="text-sm text-gray-900 dark:text-gray-200">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Earnings thesis: </span>
              {selected.earnings_thesis || '—'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm text-gray-900 dark:text-gray-200">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Key positive: </span>
                {selected.key_positive || '—'}
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Key negative: </span>
                {selected.key_negative || '—'}
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Key risk: </span>
                {selected.key_risk || '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card title="Revenue" grade={selected.grades.revenue?.grade}>
            <Metric label="Revenue" value={money(selected, 'revenue')} />
            <Metric label="YoY growth" value={pct(selected, 'revenue_yoy_growth_pct')} />
            <Metric label="QoQ growth" value={pct(selected, 'revenue_qoq_growth_pct')} />
            <Metric label="Estimate" value={money(selected, 'revenue_estimate')} />
            <Metric label="Surprise" value={pct(selected, 'revenue_surprise_pct')} />
          </Card>
          <Card title="Profitability" grade={selected.grades.profitability?.grade}>
            <Metric label="EPS" value={qty(selected, 'eps')} />
            <Metric label="EPS estimate" value={qty(selected, 'eps_estimate')} />
            <Metric label="Gross margin" value={pct(selected, 'gross_margin_pct')} />
            <Metric label="Operating margin" value={pct(selected, 'operating_margin_pct')} />
            <Metric label="EPS surprise" value={pct(selected, 'eps_surprise_pct')} />
            <Metric label="Free cash flow" value={money(selected, 'profitability_free_cash_flow')} />
          </Card>
          <Card title="Costs" grade={selected.grades.costs?.grade}>
            <Metric label="OpEx" value={money(selected, 'operating_expenses')} />
            <Metric label="OpEx YoY" value={pct(selected, 'operating_expenses_yoy_pct')} />
            <Metric label="S&M" value={money(selected, 'sales_marketing')} />
            <Metric label="R&D" value={money(selected, 'research_development')} />
            <Metric label="G&A" value={money(selected, 'general_admin')} />
            <Metric label="COGS YoY" value={pct(selected, 'cost_of_revenue_yoy_pct')} />
          </Card>
          <Card title="Balance Sheet" grade={selected.grades.balance_sheet?.grade}>
            <Metric label="Cash" value={money(selected, 'cash')} />
            <Metric label="Debt" value={money(selected, 'debt')} />
            <Metric label="Inventory" value={money(selected, 'inventory')} />
            <Metric label="Receivables" value={money(selected, 'accounts_receivable')} />
            <Metric label="FCF" value={money(selected, 'free_cash_flow')} />
            <Metric label="Share count YoY" value={pct(selected, 'share_count_yoy_growth_pct')} />
          </Card>
          <Card title="Outlook" grade={selected.grades.outlook?.grade}>
            <Metric label="Revenue guidance" value={`${money(selected, 'revenue_guidance_low')} – ${money(selected, 'revenue_guidance_high')}`} />
            <Metric label="EPS guidance" value={`${qty(selected, 'eps_guidance_low')} – ${qty(selected, 'eps_guidance_high')}`} />
            <Metric label="Guidance change" value={selected.guidance_change || '—'} />
            <Metric label="Management outlook" value={selected.management_outlook || '—'} />
          </Card>
          <Card title="Earnings Quality" grade={selected.grades.earnings_quality?.grade}>
            <Metric
              label="Recurring profit"
              value={
                selected.financials.recurring_profit === true
                  ? 'Yes'
                  : selected.financials.recurring_profit === false
                    ? 'No'
                    : '—'
              }
            />
            <Metric label="Stock-based comp" value={money(selected, 'stock_based_compensation')} />
            <Metric label="Dilution risk" value={selected.dilution_risk || '—'} />
            <Metric label="One-off income" value={money(selected, 'one_off_income')} />
          </Card>
          <Card title="Valuation" grade={selected.grades.valuation?.grade}>
            <Metric label="Price" value={qty(selected, 'current_price')} />
            <Metric label="Market cap" value={money(selected, 'market_cap')} />
            <Metric label="P/E" value={qty(selected, 'pe_ratio')} />
            <Metric label="P/S" value={qty(selected, 'price_to_sales')} />
            <Metric label="EV/Sales" value={qty(selected, 'ev_to_sales')} />
            <Metric label="DCF fair value" value={qty(selected, 'dcf_fair_value')} />
          </Card>
          <Card title="Previous comparison" grade={null}>
            <Metric label="Revenue" value={selected.previous_comparison?.revenue_trend || '—'} />
            <Metric label="Margin" value={selected.previous_comparison?.margin_trend || '—'} />
            <Metric label="Cost" value={selected.previous_comparison?.cost_trend || '—'} />
            <Metric label="Cash flow" value={selected.previous_comparison?.cash_flow_trend || '—'} />
            <Metric label="Guidance" value={selected.previous_comparison?.guidance_trend || '—'} />
          </Card>
          <Card title="Competitor" grade={null}>
            <Metric
              label="Name"
              value={
                selected.competitor?.name
                  ? `${selected.competitor.name}${selected.competitor.ticker ? ` (${selected.competitor.ticker})` : ''}`
                  : '—'
              }
            />
            <Metric label="Revenue growth" value={formatPct(selected.competitor?.revenue_growth_pct ?? null)} />
            <Metric label="Gross margin" value={formatPct(selected.competitor?.gross_margin_pct ?? null)} />
            <Metric label="Op. margin" value={formatPct(selected.competitor?.operating_margin_pct ?? null)} />
            <div className="col-span-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Comparison</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {selected.competitor?.comparison_summary || '—'}
              </div>
            </div>
          </Card>
          <Card title="Analyst sentiment" grade={null}>
            <Metric label="Consensus" value={selected.analyst_sentiment?.consensus || '—'} />
            <Metric
              label="Buy / Hold / Sell"
              value={`${selected.analyst_sentiment?.buy_count ?? '—'} / ${selected.analyst_sentiment?.hold_count ?? '—'} / ${selected.analyst_sentiment?.sell_count ?? '—'}`}
            />
            <Metric label="Price target" value={formatNum(selected.analyst_sentiment?.average_price_target ?? null)} />
            <Metric label="Recent change" value={selected.analyst_sentiment?.recent_rating_change || '—'} />
          </Card>
        </div>
      ) : null}

      {chartData.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Earnings history
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChartBlock title="Overall earnings grade" data={chartData} dataKey="overallScore" yFormat={(v) => String(v)} />
            <ChartBlock title="Revenue growth %" data={chartData} dataKey="revenueGrowth" />
            <ChartBlock title="EPS" data={chartData} dataKey="eps" />
            <ChartBlock title="Gross margin %" data={chartData} dataKey="grossMargin" />
            <ChartBlock title="Operating margin %" data={chartData} dataKey="operatingMargin" />
            <ChartBlock title="Free cash flow" data={chartData} dataKey="fcf" />
            <ChartBlock title="Share count / dilution %" data={chartData} dataKey="dilution" />
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h3>
          {confirmDelete && savedSelected && !draft ? (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm">
              <p className="text-red-800 dark:text-red-200 mb-3">
                Delete the {savedSelected.period_label} earnings review? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm"
                  disabled={deleting}
                  onClick={() => void deleteReview()}
                >
                  {deleting ? 'Deleting…' : 'Delete review'}
                </button>
                <button
                  type="button"
                  className="text-sm underline text-gray-700 dark:text-gray-300"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void copyAskAiPrompt()}
              disabled={askAiCopied || (draft?.review == null && savedSelected?.raw_json == null)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                askAiCopied
                  ? 'bg-green-600 text-white cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
              }`}
            >
              {askAiCopied ? '✓ Copied!' : '🤖 Ask AI'}
            </button>
            {savedSelected && !draft ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
              >
                Delete
              </button>
            ) : null}
          </div>
          {askAiCopied ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Copied! Paste into ChatGPT.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChartBlock({
  title,
  data,
  dataKey,
  yFormat,
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  dataKey: string;
  yFormat?: (v: number) => string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={yFormat}
            />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} name={title} stroke="#2563eb" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
