import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const AAII_URL = 'https://www.aaii.com/sentimentsurvey/sent_results';

export interface AAIISentimentRow {
  date: string;
  bullish: number;
  neutral: number;
  bearish: number;
}

function parsePct(str: string): number {
  const m = String(str || '').replace(/,/g, '').match(/[\d.]+/);
  return m ? Math.max(0, Math.min(100, parseFloat(m[0] ?? '0'))) : 0;
}

function parseMonthDay(text: string): { month: number; day: number } | null {
  const s = String(text || '').trim();
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const match = s.match(/^([A-Za-z]+)\s*(\d{1,2})$/);
  if (!match) return null;
  const monthName = match[1].toLowerCase().slice(0, 3);
  const month = months[monthName];
  const day = parseInt(match[2], 10);
  if (month === undefined || !Number.isFinite(day) || day < 1 || day > 31) return null;
  return { month, day };
}

function assignDates(
  rows: (Omit<AAIISentimentRow, 'date'> & { dateText: string })[],
  currentYear: number
): AAIISentimentRow[] {
  if (rows.length === 0) return [];
  const result: AAIISentimentRow[] = [];
  const first = rows[0];
  const md = parseMonthDay(first.dateText);
  if (!md) return rows.map((r) => ({ date: '', bullish: r.bullish, neutral: r.neutral, bearish: r.bearish }));
  let d = new Date(currentYear, md.month, md.day);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    result.push({
      date: d.toISOString().split('T')[0],
      bullish: r.bullish,
      neutral: r.neutral,
      bearish: r.bearish,
    });
    d = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return result;
}

function extractRowsFromHtml(html: string): (Omit<AAIISentimentRow, 'date'> & { dateText: string })[] {
  const rows: (Omit<AAIISentimentRow, 'date'> & { dateText: string })[] = [];
  const $ = cheerio.load(html);

  function parseTable($table: ReturnType<typeof $>) {
    const thText = $table.find('th').map((_: number, el: cheerio.Element) => $(el).text().trim().toLowerCase()).get().join(' ');
    if (!thText.includes('reported') && !thText.includes('bullish')) return;
    $table.find('tbody tr, tr').each((_: number, tr: cheerio.Element) => {
      const tds = $(tr).find('td').map((_: number, el: cheerio.Element) => $(el).text().trim()).get();
      if (tds.length < 4) return;
      const dateText = tds[0];
      const bullish = parsePct(tds[1]);
      const neutral = parsePct(tds[2]);
      const bearish = parsePct(tds[3]);
      if (!dateText || !dateText.match(/[A-Za-z]+\s*\d/)) return;
      rows.push({ dateText, bullish, neutral, bearish });
    });
  }

  $('.sentimentsurvey table, table.sentimentsurvey').each((_, table) => parseTable($(table)));
  if (rows.length === 0) $('table').each((_, table) => parseTable($(table)));
  if (rows.length === 0) {
    $('tr').each((__, tr) => {
      const tds = $(tr).find('td').map((__, el) => $(el).text().trim()).get();
      if (tds.length < 4) return;
      const dateText = tds[0];
      if (!dateText || !dateText.match(/[A-Za-z]+\s*\d/)) return;
      rows.push({
        dateText,
        bullish: parsePct(tds[1]),
        neutral: parsePct(tds[2]),
        bearish: parsePct(tds[3]),
      });
    });
  }
  return rows;
}

/** Fetch and parse AAII sentiment. Works on Netlify/serverless; AAII often blocks fetch (Incapsula). */
export async function GET() {
  const currentYear = new Date().getFullYear();

  const buildResponse = (html: string) => {
    if (html.includes('Incapsula') || html.includes('main-iframe')) return null;
    const rows = extractRowsFromHtml(html);
    if (rows.length === 0) return null;
    const withDates = assignDates(rows, currentYear).filter((r) => r.date);
    const data = [...withDates].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const latest = withDates.length > 0 ? withDates[0] : null;
    return NextResponse.json({ data, latest });
  };

  try {
    const res = await fetch(AAII_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 3600 },
    });
    const html = await res.text();
    const response = buildResponse(html);
    if (response) return response;
  } catch (e: unknown) {
    console.error('aaii-sentiment fetch:', e);
  }

  return NextResponse.json(
    {
      data: [],
      latest: null,
      error: 'AAII blocks automated access. Open the survey page below for the latest data.',
    },
    { status: 200 }
  );
}
