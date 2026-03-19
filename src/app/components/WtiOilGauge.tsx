'use client';

import React from 'react';

function getWtiLabel(price: number): string {
  if (price < 50) return 'Recession warning';
  if (price < 80) return 'Normal range';
  return 'Inflation signal';
}

function polar(cx: number, cy: number, rad: number, theta: number) {
  return {
    x: cx + rad * Math.cos(theta),
    y: cy - rad * Math.sin(theta),
  };
}

/** Left: &lt;$50 recession → center: $50–80 normal → right: $80+ inflation. */
const PRICE_MIN = 20;
const PRICE_MAX = 100;

const SEGMENTS = [
  { label: 'Recession\nwarning', color: '#dc2626', startFrac: 0, endFrac: 30 / 80 },
  { label: 'Normal\nrange', color: '#16a34a', startFrac: 30 / 80, endFrac: 60 / 80 },
  { label: 'Inflation\nsignal', color: '#ea580c', startFrac: 60 / 80, endFrac: 1 },
] as const;

const LEGEND = [
  { range: '< 50', label: 'Recession warning', color: '#dc2626' },
  { range: '50 – 80', label: 'Normal range', color: '#16a34a' },
  { range: '≥ 80', label: 'Inflation signal', color: '#ea580c' },
] as const;

export function WtiOilGauge({
  value,
  asOfDate,
}: {
  value: number;
  asOfDate?: string;
}) {
  const price = Number.isFinite(Number(value)) ? Number(value) : 0;
  const normalized = Math.max(0, Math.min(1, (price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)));

  const cx = 160;
  const cy = 168;
  const R = 118;
  const Ri = 72;

  const paths: { d: string; color: string; key: string }[] = [];
  SEGMENTS.forEach((seg, k) => {
    const a0 = Math.PI * (1 - seg.startFrac);
    const a1 = Math.PI * (1 - seg.endFrac);
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
    paths.push({ d, color: seg.color, key: `wti-${k}` });
  });

  const needleAngle = Math.PI * (1 - normalized);
  const needleLen = R - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);
  const label = getWtiLabel(price);

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
        West Texas Intermediate Crude Oil
      </h3>
      {dateStr && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Latest in range: {dateStr}</p>
      )}
      <svg viewBox="0 0 320 200" className="w-full max-w-md h-auto" aria-hidden>
        <defs>
          <filter id="wti-gauge-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
        ))}
        {SEGMENTS.map((seg, k) => {
          const midFrac = (seg.startFrac + seg.endFrac) / 2;
          const mid = Math.PI * (1 - midFrac);
          const tr = (R + Ri) / 2;
          const tx = cx + tr * Math.cos(mid);
          const ty = cy - tr * Math.sin(mid);
          const words = seg.label.split('\n');
          return (
            <text
              key={`wl-${k}`}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: words.length > 1 ? 9 : 10,
                fontWeight: 700,
                textShadow: '0 0 2px #fff, 0 0 4px #fff',
              }}
              className="fill-gray-900"
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
          filter="url(#wti-gauge-shadow)"
        />
        <circle cx={cx} cy={cy} r={8} fill="#1f2937" stroke="#fff" strokeWidth={2} />
      </svg>
      <div className="text-center -mt-2 mb-4">
        <div className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">
          ${price.toFixed(2)}
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
