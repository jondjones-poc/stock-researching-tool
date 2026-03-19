'use client';

import React from 'react';

function getVixLabel(vix: number): string {
  if (vix < 15) return 'Very low volatility';
  if (vix < 20) return 'Normal range';
  if (vix < 25) return 'Caution zone';
  if (vix < 30) return 'Elevated risk';
  return 'Panic mode';
}

function polar(cx: number, cy: number, rad: number, theta: number) {
  return {
    x: cx + rad * Math.cos(theta),
    y: cy - rad * Math.sin(theta),
  };
}

/** Calm (green) left → panic (red) right. Needle maps VIX ~8–45 across the arc. */
const VIX_NEEDLE_MIN = 8;
const VIX_NEEDLE_MAX = 45;

const SEGMENTS = [
  { label: 'Very low', color: '#16a34a' },
  { label: 'Normal', color: '#3b82f6' },
  { label: 'Caution', color: '#eab308' },
  { label: 'Elevated', color: '#f97316' },
  { label: 'Panic', color: '#dc2626' },
] as const;

const LEGEND = [
  { range: '< 15', label: 'Very low vol.', color: '#16a34a' },
  { range: '15–20', label: 'Normal', color: '#3b82f6' },
  { range: '20–25', label: 'Caution', color: '#eab308' },
  { range: '25–30', label: 'Elevated', color: '#f97316' },
  { range: '> 30', label: 'Panic', color: '#dc2626' },
] as const;

export function VixVolatilityGauge({
  value,
  asOfDate,
}: {
  value: number;
  asOfDate?: string;
}) {
  const raw = Number(value);
  const vix = Number.isFinite(raw) ? raw : 0;
  const n = (vix - VIX_NEEDLE_MIN) / (VIX_NEEDLE_MAX - VIX_NEEDLE_MIN);
  const normalized = Math.max(0, Math.min(1, n));

  const cx = 160;
  const cy = 168;
  const R = 118;
  const Ri = 72;
  const nSeg = 5;

  const paths: { d: string; color: string; key: string }[] = [];
  for (let k = 0; k < nSeg; k++) {
    const a0 = Math.PI * (1 - k / nSeg);
    const a1 = Math.PI * (1 - (k + 1) / nSeg);
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
    paths.push({ d, color: SEGMENTS[k].color, key: `vix-${k}` });
  }

  const needleAngle = Math.PI * (1 - normalized);
  const needleLen = R - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);
  const label = getVixLabel(vix);

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
        Volatility Index (VIX)
      </h3>
      {dateStr && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Latest in range: {dateStr}</p>
      )}
      <svg viewBox="0 0 320 200" className="w-full max-w-md h-auto" aria-hidden>
        <defs>
          <filter id="vix-gauge-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
        ))}
        {SEGMENTS.map((seg, k) => {
          const mid = Math.PI * (1 - (k + 0.5) / nSeg);
          const tr = (R + Ri) / 2;
          const tx = cx + tr * Math.cos(mid);
          const ty = cy - tr * Math.sin(mid);
          return (
            <text
              key={`vl-${k}`}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: 10,
                fontWeight: 700,
                textShadow: '0 0 2px #fff, 0 0 4px #fff',
              }}
              className="fill-gray-900"
            >
              {seg.label}
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
          filter="url(#vix-gauge-shadow)"
        />
        <circle cx={cx} cy={cy} r={8} fill="#1f2937" stroke="#fff" strokeWidth={2} />
      </svg>
      <div className="text-center -mt-2 mb-4">
        <div className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
          {vix.toFixed(2)}
        </div>
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
            <span className="font-medium">{row.range}</span>
            <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
