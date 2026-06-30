'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { WorldMarketPeriod, WorldMarketRegionResult } from '../../config/worldMarkets';
import WorldMarketsGeoLayer from './WorldMarketsGeoLayer';
import MapResizeHandler from './MapResizeHandler';
import 'leaflet/dist/leaflet.css';

interface WorldMarketsMapViewProps {
  regions: WorldMarketRegionResult[];
  period: WorldMarketPeriod;
}

export default function WorldMarketsMapView({ regions, period }: WorldMarketsMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      if (width > 0 && height > 0) setMapReady(true);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/world-markets/geojson', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.details || body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: GeoJSON.FeatureCollection) => {
        if (!cancelled) {
          setGeoJson(data);
          setGeoError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGeoError(err instanceof Error ? err.message : 'Failed to load map');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mapKey = useMemo(
    () => `${regions.length}-${geoJson ? 'geo' : 'no-geo'}`,
    [regions.length, geoJson]
  );

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[520px]">
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10 bg-gray-100 dark:bg-gray-900">
          Loading map…
        </div>
      )}
      {geoError && (
        <div className="absolute top-2 left-2 right-2 z-[1000] text-xs bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 px-2 py-1 rounded">
          Map outline unavailable — markers still show region performance.
        </div>
      )}
      {mapReady && (
        <MapContainer
          key={mapKey}
          center={[25, 10]}
          zoom={2}
          minZoom={2}
          className="h-full w-full z-0"
          style={{ height: '100%', width: '100%', minHeight: 520 }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapResizeHandler trigger={geoJson ?? regions.length} />
          <WorldMarketsGeoLayer regions={regions} geoJson={geoJson} period={period} />
        </MapContainer>
      )}
    </div>
  );
}
