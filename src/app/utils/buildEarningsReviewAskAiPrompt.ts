/**
 * Clipboard prompt for ChatGPT / Claude: stress-test an earnings review JSON.
 */

export function buildEarningsReviewAskAiPrompt(json: unknown, context?: {
  ticker?: string;
  periodLabel?: string;
  filename?: string | null;
}): string {
  const ticker = context?.ticker || 'this company';
  const period = context?.periodLabel || 'this quarter';
  const filename = context?.filename ? ` (file: ${context.filename})` : '';
  const payload = JSON.stringify(json, null, 2);

  return [
    `You are a sceptical equity research analyst reviewing my structured earnings review for ${ticker} ${period}${filename}.`,
    'This is my own write-up after reading the earnings, not investment advice. Treat the JSON as my thesis and grading, not as ground truth.',
    '',
    'Your job is to **validate the thinking**, then **find holes and weaknesses**. Do not cheerlead. Challenge grades, narrative, and missing evidence.',
    '',
    '--- MY EARNINGS REVIEW JSON ---',
    payload,
    '',
    '--- PLEASE DO THE FOLLOWING ---',
    '1. **Validate the thinking** — Is the overall grade, business direction, investment view, and earnings thesis internally consistent with the numbers and notes in the JSON? Where does the logic hold?',
    '2. **Holes in the thesis** — What is missing, assumed, or unproven? Call out gaps in evidence (guidance quality, one-offs, SBC/dilution, cash conversion, competitive comparison, analyst sentiment, accounting).',
    '3. **Weaknesses / failure modes** — How this review could be wrong (3–8 concrete points). Separate “the business is weak” from “my grading is too generous/harsh”.',
    '4. **Grade challenge** — For each category grade that looks off (revenue, profitability, costs, balance sheet, outlook, earnings quality, valuation, overall), say whether it should be higher, lower, or unchanged, and why. Keep earnings grade separate from valuation grade.',
    '5. **What to check next** — A short list of filings, metrics, or questions I should verify before trusting this review.',
    '6. **Verdict** — One short paragraph: is this review robust, incomplete, or biased? End with: “Not investment advice.”',
    '',
    'Use current public information if it helps you stress-test the JSON. Flag anything that looks stale, internally inconsistent, or too confident given the data.',
  ].join('\n');
}
