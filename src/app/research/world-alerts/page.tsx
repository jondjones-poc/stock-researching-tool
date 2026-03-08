'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// Dynamically import MapContainer to avoid SSR issues with Leaflet
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
const MapBoundsFitter = dynamic(
  () => import('./MapBoundsFitter'),
  { ssr: false }
);

interface AlertLocation {
  lat: number;
  lng: number;
  title: string;
  date: string;
  url?: string;
  value?: number;
  country?: string;
}

export default function WorldAlertsPage() {
  const [locations, setLocations] = useState<AlertLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('oil');
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set map ready after component mounts and DOM is ready
    if (typeof window !== 'undefined' && mapContainerRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setMapReady(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchAlerts = async (query: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching alerts for query: ${query}`);
      const response = await fetch(`/api/gdelt?query=${encodeURIComponent(query)}&mode=GeoJSON&format=json`);
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to fetch alerts';
        let userMessage = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          userMessage = errorData.message || errorMessage;
          
          // Special handling for rate limiting
          if (response.status === 429) {
            userMessage = 'Rate limit exceeded. The GDELT API is limiting requests. Please wait a few moments before trying again.';
          }
          
          console.error('API Error:', errorData);
        } catch (parseError) {
          console.error('API Error Status:', response.status, response.statusText);
          if (response.status === 429) {
            userMessage = 'Rate limit exceeded. Please wait a few moments before trying again.';
          }
        }
        throw new Error(userMessage || `${errorMessage} (Status: ${response.status})`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.locations && data.locations.length > 0) {
        setLocations(data.locations);
        setError(null);
      } else if (data.message) {
        // API returned a message (e.g., no geographic data)
        setLocations([]);
        setError(data.message);
      } else {
        // If no locations, show a message
        setLocations([]);
        setError('No geographic data available for this query. Try a different search term or check GDELT API availability.');
      }
    } catch (err: any) {
      console.error('Error fetching alerts:', err);
      setError(err.message || 'Failed to load world alerts. Please check the console for details.');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      fetchAlerts(searchQuery);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchAlerts(searchQuery.trim());
    }
  };

  // Calculate map bounds from locations
  const calculateBounds = () => {
    if (locations.length === 0) {
      return { center: [20, 0] as [number, number], zoom: 2 };
    }

    const lats = locations.map(loc => loc.lat);
    const lngs = locations.map(loc => loc.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate zoom level based on bounds
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    let zoom = 2;
    if (maxDiff < 0.1) zoom = 10;
    else if (maxDiff < 0.5) zoom = 8;
    else if (maxDiff < 1) zoom = 6;
    else if (maxDiff < 5) zoom = 4;
    else if (maxDiff < 10) zoom = 3;
    
    return { center: [centerLat, centerLng] as [number, number], zoom };
  };

  const mapBounds = calculateBounds();
  const center = mapBounds.center;
  const zoom = mapBounds.zoom;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          🌍 World Alerts
        </h1>

        {/* Search Bar and Filters */}
        <div className="mb-6">
          <div className="flex gap-4 items-center flex-wrap">
            {/* Filter Buttons */}
            <div className="flex gap-2">
              {['Oil', 'Gold', 'Silver'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setSearchQuery(filter.toLowerCase());
                    fetchAlerts(filter.toLowerCase());
                  }}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    searchQuery.toLowerCase() === filter.toLowerCase()
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {filter}
                </button>
              ))}
            </div>
            
            {/* Search Box */}
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for events..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Loading...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Info */}
        {locations.length > 0 && (
          <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200">
              Found {locations.length} alert{locations.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          </div>
        )}

        {/* Map Container */}
        <div 
          ref={mapContainerRef}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" 
          style={{ height: '600px' }}
        >
          {mapReady && typeof window !== 'undefined' && mapContainerRef.current ? (
            <MapContainer
              center={center}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              key={`map-${locations.length}-${mapReady}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBoundsFitter locations={locations} />
              {locations.map((location, index) => (
                <Marker
                  key={index}
                  position={[location.lat, location.lng]}
                >
                  <Tooltip>
                    <div className="text-sm font-medium">
                      {location.title.length > 50 
                        ? `${location.title.substring(0, 50)}...` 
                        : location.title}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="p-3 max-w-sm">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-base">
                        {location.title}
                      </h3>
                      
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-start">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 mr-2">📅 Date:</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {new Date(location.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        {location.country && (
                          <div className="flex items-start">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 mr-2">🌍 Country:</span>
                            <span className="text-gray-600 dark:text-gray-400">{location.country}</span>
                          </div>
                        )}
                        
                        <div className="flex items-start">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 mr-2">📍 Location:</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                          </span>
                        </div>
                        
                        {location.value !== undefined && location.value !== null && (
                          <div className="flex items-start">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 mr-2">📊 Intensity:</span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {typeof location.value === 'number' ? location.value.toFixed(2) : location.value}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {location.url && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <a
                            href={location.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-sm font-medium"
                          >
                            📰 Read Full Article →
                          </a>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              {loading ? 'Loading map...' : 'Map loading...'}
            </div>
          )}
        </div>

        {/* Locations List (Alternative View) */}
        {locations.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Alert Locations ({locations.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((location, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {location.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    📅 {new Date(location.date).toLocaleDateString()}
                  </p>
                  {location.value && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      📊 Intensity: {location.value.toFixed(2)}
                    </p>
                  )}
                  {location.url && (
                    <a
                      href={location.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      View Source →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
