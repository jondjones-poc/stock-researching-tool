'use client';

import React from 'react';
import { formatGaugeRatio } from '../utils/rangeGauge';
import { RangeGauge } from './RangeGauge';

export function PeRangeGauge({
  rangeLow,
  rangeHigh,
  currentPe,
  pePeriod = 'annual',
}: {
  rangeLow: number | null | undefined;
  rangeHigh: number | null | undefined;
  currentPe: number | null | undefined;
  pePeriod?: 'quarter' | 'annual' | null;
}) {
  const isQuarterly = pePeriod === 'quarter';
  return (
    <RangeGauge
      title="PE"
      floorLabel={isQuarterly ? '5Q Low' : '5Y Low'}
      ceilingLabel={isQuarterly ? '5Q High' : '5Y High'}
      centerMetricLabel="Below range high"
      currentLabel="Current PE"
      missingError=""
      spanError="PE range high must be greater than low."
      formatValue={formatGaugeRatio}
      dipLabelAtHigh="At quarterly range high"
      dipLabelDeep="Cheap vs recent quarters"
      dipLabelModerate="Moderately below range high"
      dipLabelNearHigh="Near quarterly range high"
      ariaLabel="PE quarterly range"
      floor={rangeLow}
      ceiling={rangeHigh}
      current={currentPe}
    />
  );
}
