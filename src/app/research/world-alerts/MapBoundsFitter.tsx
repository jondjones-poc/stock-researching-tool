'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface AlertLocation {
  lat: number;
  lng: number;
  title: string;
  date: string;
  url?: string;
  value?: number;
  country?: string;
}

export default function MapBoundsFitter({ locations }: { locations: AlertLocation[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (locations.length > 0 && map && map.getContainer) {
      try {
        // Ensure map container exists
        const container = map.getContainer();
        if (!container) {
          return;
        }
        
        const bounds = locations.map(loc => [loc.lat, loc.lng] as [number, number]);
        if (bounds.length > 0) {
          // @ts-ignore - Leaflet types
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        }
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [locations, map]);
  
  return null;
}
