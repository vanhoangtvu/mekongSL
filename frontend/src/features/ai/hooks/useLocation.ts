'use client';

import { useCallback, useState } from 'react';

export interface GPSLocation {
  lat: number;
  lon: number;
  accuracy?: number;
}

export function useLocation() {
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ GPS');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Không lấy được vị trí');
        setLoading(false);
      },
      { timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  const clearLocation = useCallback(() => { setLocation(null); setError(null); }, []);

  return { location, loading, error, requestLocation, clearLocation };
}
