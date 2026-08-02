import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import {
  useCreateEmergencySession,
  useUpdateEmergencySession,
} from '@workspace/api-client-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmergencyTriggerType = 'fall' | 'sos' | 'manual';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface SensorData {
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export type SensorStatus = 'idle' | 'armed' | 'countdown' | 'active';

export interface SensorContextValue {
  // Sensor data
  sensorData: SensorData;
  location: LocationData | null;
  locationPermission: 'unknown' | 'granted' | 'denied';

  // Emergency state
  status: SensorStatus;
  countdown: number;
  activeSessionId: number | null;
  triggerType: EmergencyTriggerType | null;

  // Actions
  armSensor: () => void;
  disarmSensor: () => void;
  triggerEmergency: (type: EmergencyTriggerType) => void;
  cancelEmergency: () => void;
  resolveEmergency: () => void;
  requestLocationPermission: () => Promise<boolean>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FALL_THRESHOLD = 2.5; // g-force threshold for fall detection
const COUNTDOWN_SECONDS = 10;

const DEFAULT_SENSOR: SensorData = { x: 0, y: 0, z: 1, magnitude: 1 };

// ─── Context ──────────────────────────────────────────────────────────────────

const SensorContext = createContext<SensorContextValue | null>(null);

export function SensorProvider({ children }: { children: React.ReactNode }) {
  const [sensorData, setSensorData] = useState<SensorData>(DEFAULT_SENSOR);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    'unknown' | 'granted' | 'denied'
  >('unknown');
  const [status, setStatus] = useState<SensorStatus>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [triggerType, setTriggerType] = useState<EmergencyTriggerType | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accelSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const locationSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const createSession = useCreateEmergencySession();
  const updateSession = useUpdateEmergencySession();

  // ─── Location Tracking ──────────────────────────────────────────────────

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          setLocationPermission('denied');
          resolve(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocationPermission('granted');
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
            resolve(true);
          },
          () => {
            setLocationPermission('denied');
            resolve(false);
          },
        );
      });
    }

    try {
      const Location = await import('expo-location');
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm === 'granted') {
        setLocationPermission('granted');
        return true;
      } else {
        setLocationPermission('denied');
        return false;
      }
    } catch {
      setLocationPermission('denied');
      return false;
    }
  }, []);

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) return;
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        undefined,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
      locationSubscriptionRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
      return;
    }

    try {
      const Location = await import('expo-location');
      const { status: perm } = await Location.getForegroundPermissionsAsync();
      if (perm !== 'granted') return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
          });
        },
      );
      locationSubscriptionRef.current = sub;
    } catch {
      // Location unavailable
    }
  }, []);

  // Auto-request location on mount
  useEffect(() => {
    requestLocationPermission().then((granted) => {
      if (granted) startLocationTracking();
    });
    return () => {
      locationSubscriptionRef.current?.remove();
    };
  }, [requestLocationPermission, startLocationTracking]);

  // ─── Accelerometer ──────────────────────────────────────────────────────

  const startAccelerometer = useCallback(async () => {
    if (Platform.OS === 'web') return; // No accelerometer on web

    try {
      const { Accelerometer } = await import('expo-sensors');
      Accelerometer.setUpdateInterval(200);
      const sub = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        setSensorData({ x, y, z, magnitude });

        if (statusRef.current === 'armed' && magnitude > FALL_THRESHOLD) {
          triggerEmergencyInternal('fall');
        }
      });
      accelSubscriptionRef.current = sub;
    } catch {
      // Sensor unavailable
    }
  }, []);

  const stopAccelerometer = useCallback(() => {
    accelSubscriptionRef.current?.remove();
    accelSubscriptionRef.current = null;
  }, []);

  // ─── Countdown ──────────────────────────────────────────────────────────

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          // Auto-activate
          setStatus('active');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ─── Emergency Actions ──────────────────────────────────────────────────

  const triggerEmergencyInternal = useCallback(
    (type: EmergencyTriggerType) => {
      if (statusRef.current === 'countdown' || statusRef.current === 'active') return;
      setTriggerType(type);
      setStatus('countdown');
      startCountdown();

      const lat = location?.latitude ?? 0;
      const lng = location?.longitude ?? 0;
      createSession.mutate(
        { data: { triggerType: type, latitude: lat, longitude: lng, countdownSeconds: COUNTDOWN_SECONDS } },
        {
          onSuccess: (session) => {
            setActiveSessionId(session.id);
          },
        },
      );
    },
    [location, createSession, startCountdown],
  );

  const armSensor = useCallback(async () => {
    setStatus('armed');
    await startAccelerometer();
  }, [startAccelerometer]);

  const disarmSensor = useCallback(() => {
    setStatus('idle');
    stopAccelerometer();
  }, [stopAccelerometer]);

  const triggerEmergency = useCallback(
    (type: EmergencyTriggerType) => {
      triggerEmergencyInternal(type);
    },
    [triggerEmergencyInternal],
  );

  const cancelEmergency = useCallback(() => {
    stopCountdown();
    setStatus('armed');
    setTriggerType(null);
    if (activeSessionId !== null) {
      updateSession.mutate({ id: activeSessionId, data: { status: 'cancelled' } });
      setActiveSessionId(null);
    }
  }, [stopCountdown, activeSessionId, updateSession]);

  const resolveEmergency = useCallback(() => {
    stopCountdown();
    setStatus('armed');
    setTriggerType(null);
    if (activeSessionId !== null) {
      updateSession.mutate({ id: activeSessionId, data: { status: 'resolved' } });
      setActiveSessionId(null);
    }
  }, [stopCountdown, activeSessionId, updateSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAccelerometer();
      stopCountdown();
    };
  }, [stopAccelerometer, stopCountdown]);

  return (
    <SensorContext.Provider
      value={{
        sensorData,
        location,
        locationPermission,
        status,
        countdown,
        activeSessionId,
        triggerType,
        armSensor,
        disarmSensor,
        triggerEmergency,
        cancelEmergency,
        resolveEmergency,
        requestLocationPermission,
      }}
    >
      {children}
    </SensorContext.Provider>
  );
}

export function useSensor(): SensorContextValue {
  const ctx = useContext(SensorContext);
  if (!ctx) throw new Error('useSensor must be used within SensorProvider');
  return ctx;
}
