export function getDcfLastUpdated(entry: {
  updated_at?: string | null;
  created_at?: string | null;
  timestamp?: string | null;
}): string | null {
  return entry.updated_at || entry.created_at || entry.timestamp || null;
}

export function isDcfUpdatedWithinMonths(isoDate: string | null | undefined, months = 6): boolean {
  if (!isoDate) return false;
  const updated = new Date(isoDate);
  if (Number.isNaN(updated.getTime())) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return updated >= cutoff;
}

export function formatDcfButtonDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function formatDcfDisplayDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDcfListLabel(entry: {
  symbol: string;
  updated_at?: string | null;
  created_at?: string | null;
  timestamp?: string | null;
}): string {
  const lastUpdated = getDcfLastUpdated(entry);
  if (!lastUpdated) return entry.symbol;
  return `${entry.symbol} · ${formatDcfDisplayDate(lastUpdated)}`;
}
