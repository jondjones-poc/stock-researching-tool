/** FMP often expects base ticker (e.g. CAKE not CAKE.US). Strip exchange suffix. */
export function fmpSymbol(symbol: string): string {
  const s = String(symbol).trim().toUpperCase();
  const dot = s.indexOf('.');
  return dot > 0 ? s.slice(0, dot) : s;
}

/** Parse FMP dividend response (stable/dividends, historical-price-full, etc.) and return annual DPS. */
export function computeAnnualDpsFromFmpResponse(data: any): number {
  let list: any[] = [];
  if (Array.isArray(data)) list = data;
  else if (data?.historical && Array.isArray(data.historical)) list = data.historical;
  else if (data?.dividends && Array.isArray(data.dividends)) list = data.dividends;
  else if (data?.data && Array.isArray(data.data)) list = data.data;
  else if (data && typeof data === 'object' && !data['Error Message']) {
    const keys = Object.keys(data);
    const numericKeys = keys.every((k) => /^\d+$/.test(k));
    if (numericKeys && keys.length > 0) {
      list = Object.values(data);
    } else {
      for (const key of keys) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          list = data[key];
          break;
        }
      }
    }
  }

  const parseAmount = (d: any): number => {
    const v = d.dividend ?? d.adjustedDividend ?? d.adjDividend ?? d.amount ?? d.dividendAmount ?? d.dps ?? 0;
    let n = parseFloat(String(v));
    if (Number.isFinite(n) && n > 0) return n;
    if (d && typeof d === 'object') {
      for (const k of Object.keys(d)) {
        const lower = k.toLowerCase();
        if (/dividend|amount|adj|dps/.test(lower) && lower !== 'dividendyield') {
          const val = parseFloat(String(d[k]));
          if (Number.isFinite(val) && val > 0 && val < 1000) return val;
        }
      }
    }
    return 0;
  };
  const parseDate = (d: any): Date => {
    let raw = d.date ?? d.recordDate ?? d.paymentDate ?? d.declarationDate ?? d.exDividendDate ?? d.exDate ?? d.payment_date ?? d.record_date;
    if (!raw && d && typeof d === 'object') {
      for (const k of Object.keys(d)) {
        if (/date|record|payment|declaration|ex/.test(k.toLowerCase())) {
          const val = d[k];
          if (val && (typeof val === 'string' || typeof val === 'number')) raw = val;
          if (raw) break;
        }
      }
    }
    return new Date(raw || 0);
  };

  const withDate = list
    .filter((d: any) => d && typeof d === 'object' && (d.date || d.recordDate || d.paymentDate || d.declarationDate || d.exDividendDate || d.exDate || d.payment_date || d.record_date))
    .map((d: any) => ({
      date: parseDate(d),
      amount: parseAmount(d)
    }))
    .filter((d: any) => !isNaN(d.date.getTime()) && d.amount > 0)
    .sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  let annualDps = 0;
  for (const d of withDate) {
    if (d.date >= oneYearAgo) annualDps += d.amount;
  }

  if (annualDps === 0 && withDate.length > 0) {
    const twoYearsAgo = new Date(oneYearAgo);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 1);
    let twoYearSum = 0;
    for (const d of withDate) {
      if (d.date >= twoYearsAgo) twoYearSum += d.amount;
    }
    if (twoYearSum > 0) {
      annualDps = twoYearSum / 2;
    } else {
      const recent = withDate.slice(0, 4);
      const sum = recent.reduce((s, d) => s + d.amount, 0);
      if (recent.length >= 4) annualDps = sum;
      else if (recent.length >= 2) annualDps = sum * (4 / recent.length);
      else if (recent.length === 1) annualDps = recent[0].amount * 4;
    }
  }

  return Math.round(annualDps * 100) / 100;
}
