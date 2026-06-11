'use client';

import React from 'react';
import {
  computeRangeGauge,
  type RangeGaugeInput,
  type RangeGaugeOptions,
} from '../utils/rangeGauge';

export interface RangeGaugeProps extends RangeGaugeInput {
  title: string;
  subtitle?: string;
  floorLabel: string;
  ceilingLabel: string;
  centerMetricLabel: string;
  currentLabel: string;
  missingError: string;
  spanError: string;
  formatValue: (value: number) => string;
  dipLabelAtHigh?: string;
  dipLabelDeep?: string;
  dipLabelModerate?: string;
  dipLabelNearHigh?: string;
  ariaLabel: string;
}

export function RangeGauge({
  title,
  subtitle,
  floorLabel,
  ceilingLabel,
  centerMetricLabel,
  currentLabel,
  missingError,
  spanError,
  formatValue,
  dipLabelAtHigh = 'At range high',
  dipLabelDeep = 'Well below range high',
  dipLabelModerate = 'Moderate vs range high',
  dipLabelNearHigh = 'Near range high',
  ariaLabel,
  floor,
  ceiling,
  current,
}: RangeGaugeProps) {
  const options: RangeGaugeOptions = {
    floorLabel,
    ceilingLabel,
    currentLabel,
    missingError,
    invalidError: missingError,
    spanError,
    formatValue,
  };

  const result = computeRangeGauge({ floor, ceiling, current }, options);

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {result.error ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{result.error}</p>
        ) : null}
      </div>
    );
  }

  const { rangeProgressPct, dipFromHighPct, outOfRange, outOfRangeMessage } = result.metrics;
  const pointerLeft = `${rangeProgressPct}%`;
  const currentVal = Number(current);

  const dipLabel =
    dipFromHighPct <= 0.05
      ? dipLabelAtHigh
      : dipFromHighPct >= 35
        ? dipLabelDeep
        : dipFromHighPct >= 15
          ? dipLabelModerate
          : dipLabelNearHigh;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatValue(currentVal)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {rangeProgressPct.toFixed(1)}% along range
          </div>
        </div>
      </div>

      {outOfRange && outOfRangeMessage && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          {outOfRangeMessage}
        </div>
      )}

      <div className="relative pt-8 pb-1">
        <div
          className="absolute top-0 -translate-x-1/2 transition-[left] duration-300 ease-out"
          style={{ left: pointerLeft }}
        >
          <span className="inline-block whitespace-nowrap rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow-sm">
            {formatValue(currentVal)}
          </span>
          <div className="mx-auto h-2 w-px bg-blue-600" aria-hidden />
        </div>

        <div
          className="relative h-3 w-full overflow-hidden rounded-full border border-gray-300 dark:border-gray-600"
          role="meter"
          aria-valuemin={Number(floor)}
          aria-valuemax={Number(ceiling)}
          aria-valuenow={currentVal}
          aria-label={ariaLabel}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, #15803d, #eab308, #dc2626)' }}
          />
        </div>

        <div
          className="absolute top-[2.15rem] -translate-x-1/2 transition-[left] duration-300 ease-out"
          style={{ left: pointerLeft }}
        >
          <div
            className={`h-4 w-4 rounded-full border-2 border-white shadow-md ${
              outOfRange ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            aria-hidden
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs tabular-nums">
        <div>
          <div className="font-medium text-gray-500 dark:text-gray-400">{floorLabel}</div>
          <div className="text-sm font-semibold text-green-700 dark:text-green-400">
            {formatValue(Number(floor))}
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-500 dark:text-gray-400">{centerMetricLabel}</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {dipFromHighPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">{dipLabel}</div>
        </div>
        <div className="text-right">
          <div className="font-medium text-gray-500 dark:text-gray-400">{ceilingLabel}</div>
          <div className="text-sm font-semibold text-red-700 dark:text-red-400">
            {formatValue(Number(ceiling))}
          </div>
        </div>
      </div>
    </div>
  );
}
