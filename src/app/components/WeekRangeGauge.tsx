'use client';

import React from 'react';
import { formatGaugePrice } from '../utils/rangeGauge';
import { RangeGauge } from './RangeGauge';

export function WeekRangeGauge({
  yearlyFloor,
  yearlyCeiling,
  currentBenchmark,
}: {
  yearlyFloor: number | null | undefined;
  yearlyCeiling: number | null | undefined;
  currentBenchmark: number | null | undefined;
}) {
  return (
    <RangeGauge
      title="Stock Price"
      floorLabel="Year Low"
      ceilingLabel="Year High"
      centerMetricLabel="Dip from 52w high"
      currentLabel="Active Price"
      missingError="Year Low, Year High, and Active Price are required. Hit Refresh to load live data."
      spanError="Year High must be greater than Year Low."
      formatValue={formatGaugePrice}
      dipLabelAtHigh="At 52-week high"
      dipLabelDeep="Deep dip vs high"
      dipLabelModerate="Moderate dip vs high"
      dipLabelNearHigh="Near 52-week high"
      ariaLabel="52-week price range"
      floor={yearlyFloor}
      ceiling={yearlyCeiling}
      current={currentBenchmark}
    />
  );
}
