'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function MapResizeHandler({ trigger }: { trigger: unknown }) {
  const map = useMap();

  useEffect(() => {
    const resize = () => {
      try {
        map.invalidateSize();
      } catch {
        // map may be unmounting
      }
    };

    resize();
    const t1 = window.setTimeout(resize, 100);
    const t2 = window.setTimeout(resize, 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, trigger]);

  return null;
}
