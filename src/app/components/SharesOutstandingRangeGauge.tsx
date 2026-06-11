'use client';

import React from 'react';
import { formatGaugeShares } from '../utils/rangeGauge';
import { RangeGauge } from './RangeGauge';

export function SharesOutstandingRangeGauge({
  rangeLow,
  rangeHigh,
  currentShares,
}: {
  rangeLow: number | null | undefined;
  rangeHigh: number | null | undefined;
  currentShares: number | null | undefined;
}) {
  return (
    <RangeGauge
      title="Shares Outstanding"
      floorLabel="5Y Low"
      ceilingLabel="5Y High"
      centerMetricLabel="Below range high"
      currentLabel="Latest shares"
      missingError=""
      spanError="Shares range high must be greater than low."
      formatValue={formatGaugeShares}
      dipLabelAtHigh="At 5-year share count high"
      dipLabelDeep="Well below peak share count"
      dipLabelModerate="Moderately below peak"
      dipLabelNearHigh="Near peak share count"
      ariaLabel="shares outstanding range"
      floor={rangeLow}
      ceiling={rangeHigh}
      current={currentShares}
    />
  );
}
