'use client';

import React from 'react';

/** Shared semi-circle gauge needle — matches Fear & Greed styling. No SVG filters (they hide thin strokes in Chrome/Safari). */
export function GaugeNeedle({
  cx,
  cy,
  angle,
  length = 110,
}: {
  cx: number;
  cy: number;
  angle: number;
  length?: number;
}) {
  const nx = cx + length * Math.cos(angle);
  const ny = cy - length * Math.sin(angle);
  const d = `M ${cx} ${cy} L ${nx} ${ny}`;

  return (
    <g pointerEvents="none">
      <path
        d={d}
        fill="none"
        stroke="#374151"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ stroke: '#374151', strokeWidth: 3, fill: 'none' }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="#1f2937"
        stroke="#ffffff"
        strokeWidth={2}
        style={{ fill: '#1f2937', stroke: '#ffffff', strokeWidth: 2 }}
      />
    </g>
  );
}
