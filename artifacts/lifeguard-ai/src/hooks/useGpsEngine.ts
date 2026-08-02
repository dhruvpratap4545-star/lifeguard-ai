import { useState, useCallback, useRef } from 'react';

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
}

export function useGpsEngine(onLocationUpdate?: (loc: GpsLocation) => void) {
  const [coords, setCoords] = useState<GpsLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Use refs to avoid stale closure / dependency churn
  const watchIdRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    if (isTrackingRef.current) return;

    isTrackingRef.current = true;
    setIsTracking(true);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const newLoc: GpsLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          altitude: position.coords.altitude,
        };
        setCoords(newLoc);
        setError(null);
        if (onLocationUpdateRef.current) onLocationUpdateRef.current(newLoc);
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    watchIdRef.current = id;
  }, []); // stable — no deps

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    isTrackingRef.current = false;
    setIsTracking(false);
  }, []); // stable — no deps

  return { coords, error, isTracking, startTracking, stopTracking };
}
