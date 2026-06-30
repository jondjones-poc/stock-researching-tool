'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import {
  WORLD_MARKET_PERIOD_OPTIONS,
  type WorldMarketPeriod,
  type WorldMarketRegionResult,
} from '../../config/worldMarkets';
import WorldMarketsTable from './WorldMarketsTable';
import WorldMarketsColorLegend from './WorldMarketsColorLegend';
import WorldMarketsAddIndexForm from './WorldMarketsAddIndexForm';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
);
const MapBoundsFitter = dynamic(() => import('./MapBoundsFitter'), { ssr: false });
const WorldMarketsMapView = dynamic(() => import('./WorldMarketsMapView'), { ssr: false });

interface AlertLocation {
  lat: number;
  lng: number;
  title: string;
  date: string;
  url?: string;
  value?: number;
  country?: string;
}

type PageTab = 'markets' | 'news';

function NewsAlertsPanel() {
  const [locations, setLocations] = useState<AlertLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('oil');
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && mapContainerRef.current) {
      const timer = setTimeout(() => setMapReady(true), 200);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchAlerts = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/gdelt?query=${encodeURIComponent(query)}&mode=GeoJSON&format=json`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        const text = await response.text();
        const errorData = text
          ? (() => {
              try {
                return JSON.parse(text);
              } catch {
                return null;
              }
            })()
          : null;
        throw new Error(
          (errorData as { message?: string })?.message ||
            `Failed to fetch alerts (${response.status})`
        );
      }
      const data = await response.json();
      if (data.locations?.length > 0) {
        setLocations(data.locations);
        setError(null);
      } else {
        setLocations([]);
        setError(data.message || 'No geographic data for this query.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load news alerts');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        {['Oil', 'Gold', 'Silver'].map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => {
              setSearchQuery(filter.toLowerCase());
              fetchAlerts(filter.toLowerCase());
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              searchQuery.toLowerCase() === filter.toLowerCase()
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            } disabled:opacity-50`}
          >
            {filter}
          </button>
        ))}
        <form
          className="flex gap-2 flex-1 min-w-[200px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) fetchAlerts(searchQuery.trim());
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GDELT news..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 text-sm">
          {error}
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
        style={{ height: 500 }}
      >
        {mapReady ? (
          <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsFitter locations={locations} />
            {locations.map((location, index) => (
              <Marker key={index} position={[location.lat, location.lng]}>
                <Tooltip>{location.title.slice(0, 60)}</Tooltip>
                <Popup>
                  <div className="text-sm max-w-xs">
                    <p className="font-semibold mb-1">{location.title}</p>
                    {location.url && (
                      <a
                        href={location.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        Read article
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">Loading map…</div>
        )}
      </div>
    </div>
  );
}

function WorldMarketsPanel() {
  const [period, setPeriod] = useState<WorldMarketPeriod>('1y');
  const [regions, setRegions] = useState<WorldMarketRegionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const loadMarkets = useCallback(async (p: WorldMarketPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/world-markets?period=${p}`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to load world markets');
      }
      setRegions(data.regions || []);
      setFetchedAt(data.fetchedAt || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load world markets');
      setRegions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets(period);
  }, [period, loadMarkets]);

  const growing = regions.filter((r) => r.status === 'growing').length;
  const falling = regions.filter((r) => r.status === 'falling').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          {WORLD_MARKET_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
          {loading && <span className="text-sm text-gray-500">Updating…</span>}
        </div>

        <div className="flex flex-wrap gap-4 text-sm items-center">
          <span className="text-green-600 dark:text-green-400 font-medium">{growing} growing</span>
          <span className="text-red-600 dark:text-red-400 font-medium">{falling} falling</span>
          {fetchedAt && (
            <span className="text-gray-500">Updated {new Date(fetchedAt).toLocaleString()}</span>
          )}
        </div>
      </div>

      <WorldMarketsColorLegend period={period} />

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-6 h-[520px]">
        <WorldMarketsMapView regions={regions} period={period} />
      </div>

      <WorldMarketsTable regions={regions} period={period} loading={loading} />

      <WorldMarketsAddIndexForm onAdded={() => loadMarkets(period)} />
    </div>
  );
}

export default function WorldAlertsPage() {
  const [tab, setTab] = useState<PageTab>('markets');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">🌍 Regional Stock Index Performance</h1>

        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {(
            [
              { id: 'markets' as const, label: 'Index Map' },
              { id: 'news' as const, label: 'News Alerts' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'markets' ? <WorldMarketsPanel /> : <NewsAlertsPanel />}
      </div>
    </div>
  );
}
