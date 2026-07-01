'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { WorldMarketPeriod, WorldMarketRegionResult, WorldMarketViewMode } from '../../config/worldMarkets';
import {
  peValuationLabel,
  regionMapColor,
  statusLabel,
} from '../../config/worldMarkets';

const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

interface CountryFeature {
  type: 'Feature';
  properties: {
    ISO_A3?: string;
    ADMIN?: string;
    name?: string;
  };
  geometry: GeoJSON.Geometry;
}

interface WorldMarketsGeoLayerProps {
  regions: WorldMarketRegionResult[];
  geoJson: GeoJSON.FeatureCollection | null;
  period: WorldMarketPeriod;
  viewMode: WorldMarketViewMode;
}

function resolveCountryCode(feature: CountryFeature): string | null {
  const props = feature.properties;
  if (!props) return null;

  const code =
    props.ISO_A3 ??
    (props as { 'ISO3166-1-Alpha-3'?: string })['ISO3166-1-Alpha-3'] ??
    (props as { iso_a3?: string }).iso_a3;

  if (code && code !== '-99' && code.length === 3) return code;
  return null;
}

export function useWorldGeoJson() {
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((data: GeoJSON.FeatureCollection) => {
        if (!cancelled) setGeoJson(data);
      })
      .catch((err) => console.error('Failed to load country GeoJSON:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return geoJson;
}

export default function WorldMarketsGeoLayer({ regions, geoJson, period, viewMode }: WorldMarketsGeoLayerProps) {
  const countryToRegion = useMemo(() => {
    const map = new Map<string, WorldMarketRegionResult>();
    for (const region of regions) {
      for (const code of region.countryCodes) {
        map.set(code, region);
      }
    }
    return map;
  }, [regions]);

  const styleFeature = (feature?: CountryFeature): PathOptions => {
    const code = feature ? resolveCountryCode(feature) : null;
    const region = code ? countryToRegion.get(code) : undefined;
    const fill = region ? regionMapColor(region, viewMode, period) : '#d1d5db';

    return {
      fillColor: fill,
      fillOpacity: region ? 0.72 : 0.35,
      color: region ? '#1f2937' : '#6b7280',
      weight: region ? 1.5 : 0.6,
      opacity: 1,
    };
  };

  const onEachFeature = (feature: CountryFeature, layer: L.Layer) => {
    const code = resolveCountryCode(feature);
    const region = code ? countryToRegion.get(code) : undefined;
    const name = feature.properties?.ADMIN ?? feature.properties?.name ?? code ?? 'Unknown';

    if (region) {
      const detail =
        viewMode === 'pe'
          ? region.peRatio !== null && Number.isFinite(region.peRatio)
            ? `P/E ${region.peRatio.toFixed(1)} — ${peValuationLabel(region.peValuation)}`
            : 'P/E — No data'
          : region.changePercent !== null && Number.isFinite(region.changePercent)
            ? `${region.changePercent >= 0 ? '+' : ''}${region.changePercent.toFixed(2)}% — ${statusLabel(region.status)}`
            : 'Return — No data';

      layer.bindTooltip(
        `<strong>${region.icon} ${region.name}</strong><br/>${region.indexName}<br/>${detail}`,
        { sticky: true }
      );
    } else {
      layer.bindTooltip(name, { sticky: true });
    }
  };

  return (
    <>
      {geoJson && (
        <GeoJSON
          key={`${regions.map((r) => `${r.id}-${r.changePercent}-${r.peRatio}`).join('|')}-${viewMode}`}
          data={geoJson as GeoJSON.GeoJsonObject}
          style={styleFeature as (feature?: GeoJSON.Feature) => PathOptions}
          onEachFeature={onEachFeature as (feature: GeoJSON.Feature, layer: L.Layer) => void}
        />
      )}

      {regions.map((region) => {
        const color = regionMapColor(region, viewMode, period);
        const markerLabel =
          viewMode === 'pe'
            ? region.peRatio !== null && Number.isFinite(region.peRatio)
              ? `P/E ${region.peRatio.toFixed(1)}`
              : '—'
            : region.changePercent !== null && Number.isFinite(region.changePercent)
              ? `${region.changePercent >= 0 ? '+' : ''}${region.changePercent.toFixed(1)}%`
              : '—';

        return (
          <CircleMarker
            key={region.id}
            center={[region.lat, region.lng]}
            radius={region.status === 'unavailable' ? 7 : 11}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: color,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <span className="text-xs font-semibold">
                {region.icon} {markerLabel}
              </span>
            </Tooltip>
            <Popup>
              <div className="text-sm space-y-1 min-w-[160px]">
                <div className="font-bold">
                  {region.icon} {region.name}
                </div>
                <div className="text-gray-600">{region.indexName}</div>
                {viewMode === 'pe' ? (
                  <>
                    <div className="font-semibold" style={{ color }}>
                      {region.peRatio !== null && Number.isFinite(region.peRatio)
                        ? `P/E ${region.peRatio.toFixed(1)}`
                        : 'P/E —'}{' '}
                      {peValuationLabel(region.peValuation)}
                    </div>
                    {region.peSymbol && (
                      <div className="text-xs text-gray-500">Proxy ETF: {region.peSymbol}</div>
                    )}
                  </>
                ) : (
                  <div className="font-semibold" style={{ color }}>
                    {markerLabel}{' '}
                    {region.status === 'growing'
                      ? '↑ Growing'
                      : region.status === 'falling'
                        ? '↓ Falling'
                        : '→ Flat'}
                  </div>
                )}
                {region.price !== null && (
                  <div className="text-gray-600">
                    Level: {region.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                )}
                {region.asOfDate && (
                  <div className="text-xs text-gray-500">As of {region.asOfDate}</div>
                )}
                {region.note && <div className="text-xs text-gray-500">{region.note}</div>}
                <div className="text-xs text-gray-400">Source: {region.dataSource}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
