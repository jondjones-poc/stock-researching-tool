'use client';

import React from 'react';
import { formatGaugeLargeCurrency } from '../utils/rangeGauge';
import { RangeGauge } from './RangeGauge';

export function FcfRangeGauge({
  rangeLow,
  rangeHigh,
  currentFcf,
}: {
  rangeLow: number | null | undefined;
  rangeHigh: number | null | undefined;
  currentFcf: number | null | undefined;
}) {
  return (
    <RangeGauge
      title="Free Cash Flow"
      floorLabel="5Y Low"
      ceilingLabel="5Y High"
      centerMetricLabel="Below range high"
      currentLabel="Current FCF"
      missingError=""
      spanError="FCF range high must be greater than low."
      formatValue={formatGaugeLargeCurrency}
      dipLabelAtHigh="At multi-year FCF high"
      dipLabelDeep="Well below FCF peak"
      dipLabelModerate="Moderately below FCF peak"
      dipLabelNearHigh="Near FCF peak"
      ariaLabel="annual free cash flow range"
      floor={rangeLow}
      ceiling={rangeHigh}
      current={currentFcf}
    />
  );
}
