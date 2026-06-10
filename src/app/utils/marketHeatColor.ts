/** Map daily % change to heatmap background color. ≥+5% green, ≤−5% red, ~0% yellow. */
export function marketChangePctToColor(pct: number): string {
  const v = Number(pct);
  if (!Number.isFinite(v)) return '#9ca3af';

  const clamped = Math.max(-10, Math.min(10, v));

  if (clamped >= 5) return '#15803d';
  if (clamped <= -5) return '#b91c1c';
  if (clamped >= 0) return lerpColor('#eab308', '#22c55e', clamped / 5);
  return lerpColor('#ef4444', '#eab308', (clamped + 5) / 5);
}

/** Text color for contrast on heatmap tiles */
export function marketChangePctToTextColor(pct: number): string {
  const v = Number(pct);
  if (!Number.isFinite(v)) return '#111827';
  const abs = Math.abs(v);
  return abs >= 2.5 ? '#ffffff' : '#111827';
}

function lerpColor(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function formatChangePct(pct: number): string {
  const v = Number(pct);
  if (!Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
