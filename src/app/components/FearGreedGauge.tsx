'use client';

import React from 'react';

function getFearGreedLabel(value: number): string {
  if (value < 25) return 'Extreme Fear';
  if (value < 45) return 'Fear';
  if (value < 55) return 'Neutral';
  if (value < 75) return 'Greed';
  return 'Extreme Greed';
}

function polar(cx: number, cy: number, rad: number, theta: number) {
  return {
    x: cx + rad * Math.cos(theta),
    y: cy - rad * Math.sin(theta),
  };
}

/** Five equal wedges: fear (red) left → greed (green) right. Needle 0–100. */
const SEGMENTS = [
  { label: 'Extreme Fear', color: '#dc2626' },
  { label: 'Fear', color: '#f97316' },
  { label: 'Neutral', color: '#eab308' },
  { label: 'Greed', color: '#86efac' },
  { label: 'Extreme Greed', color: '#16a34a' },
] as const;

const LEGEND = [
  { range: '0–24', label: 'Extreme fear', color: '#dc2626' },
  { range: '25–44', label: 'Fear', color: '#f97316' },
  { range: '45–55', label: 'Neutral', color: '#eab308' },
  { range: '56–75', label: 'Greed', color: '#86efac' },
  { range: '76–100', label: 'Extreme greed', color: '#16a34a' },
] as const;

export function FearGreedGauge({
  value,
  asOfDate,
}: {
  value: number;
  asOfDate?: string;
}) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const cx = 160;
  const cy = 168;
  const R = 118;
  const Ri = 72;
  const n = 5;

  const paths: { d: string; color: string; key: string }[] = [];
  for (let k = 0; k < n; k++) {
    const a0 = Math.PI * (1 - k / n);
    const a1 = Math.PI * (1 - (k + 1) / n);
    const o0 = polar(cx, cy, R, a0);
    const o1 = polar(cx, cy, R, a1);
    const i0 = polar(cx, cy, Ri, a0);
    const i1 = polar(cx, cy, Ri, a1);
    const d = [
      `M ${o0.x} ${o0.y}`,
      `A ${R} ${R} 0 0 1 ${o1.x} ${o1.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${Ri} ${Ri} 0 0 0 ${i0.x} ${i0.y}`,
      'Z',
    ].join(' ');
    paths.push({ d, color: SEGMENTS[k].color, key: `seg-${k}` });
  }

  const needleAngle = Math.PI * (1 - v / 100);
  const needleLen = R - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);
  const label = getFearGreedLabel(v);

  const dateStr = asOfDate
    ? new Date(asOfDate).toLocaleDateString('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <h3 className="text-lg sm:text-xl font-bold tracking-wide text-gray-900 dark:text-white uppercase mb-2 text-center">
        Fear &amp; Greed Index
      </h3>
      {dateStr && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Latest in range: {dateStr}</p>
      )}
      <svg viewBox="0 0 320 200" className="w-full max-w-md h-auto" aria-hidden>
        <defs>
          <filter id="fng-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
        ))}
        {SEGMENTS.map((seg, k) => {
          const mid = Math.PI * (1 - (k + 0.5) / n);
          const tr = (R + Ri) / 2;
          const tx = cx + tr * Math.cos(mid);
          const ty = cy - tr * Math.sin(mid);
          const words = seg.label.split(' ');
          return (
            <text
              key={`lbl-${k}`}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-900 dark:fill-gray-900"
              style={{
                fontSize: words.length > 1 ? 9 : 10,
                fontWeight: 700,
                textShadow: '0 0 2px #fff, 0 0 4px #fff',
              }}
            >
              {words.map((w, i) => (
                <tspan key={i} x={tx} dy={i === 0 ? 0 : 11}>
                  {w}
                </tspan>
              ))}
            </text>
          );
        })}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#374151"
          strokeWidth={3}
          strokeLinecap="round"
          filter="url(#fng-shadow)"
        />
        <circle cx={cx} cy={cy} r={8} fill="#1f2937" stroke="#fff" strokeWidth={2} />
      </svg>
      <div className="text-center -mt-2 mb-4">
        <div className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{v.toFixed(1)}</div>
        <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">{label}</div>
      </div>
      <div className="w-full flex flex-wrap justify-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
        {LEGEND.map((row) => (
          <div
            key={row.range}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200"
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0 border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: row.color }}
            />
            <span className="font-medium tabular-nums">{row.range}</span>
            <span className="text-gray-600 dark:text-gray-400 capitalize">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
