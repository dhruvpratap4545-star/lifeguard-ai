import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSensorEngineProps {
  onFallDetected?: (magnitude: number) => void;
  onCrashDetected?: (magnitude: number) => void;
}

export function useSensorEngine({ onFallDetected, onCrashDetected }: UseSensorEngineProps = {}) {
  const [isActive, setIsActive] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [magnitude, setMagnitude] = useState(0);
  const [history, setHistory] = useState<number[]>(Array(50).fill(0));
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [triggerType, setTriggerType] = useState<'fall' | 'crash' | null>(null);

  const historyRef = useRef<number[]>(Array(50).fill(0));
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onFallRef = useRef(onFallDetected);
  const onCrashRef = useRef(onCrashDetected);
  
  onFallRef.current = onFallDetected;
  onCrashRef.current = onCrashDetected;

  const requestPermission = useCallback(async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const state = await (DeviceMotionEvent as any).requestPermission();
        setPermissionState(state);
        return state === 'granted';
      } catch (e) {
        console.error(e);
        setPermissionState('denied');
        return false;
      }
    }
    setPermissionState('granted');
    return true; // Not iOS or no permission needed
  }, []);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    // Calculate magnitude
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    setMagnitude(mag);

    // Update history
    historyRef.current = [...historyRef.current.slice(1), mag];
    setHistory([...historyRef.current]);

    // Detection Logic
    if (isDetecting) {
      if (mag > 40) {
        // Crash spike
        setTriggerType('crash');
        setIsDetecting(false);
        if (onCrashRef.current) onCrashRef.current(mag);
      } else if (mag > 25) {
        // Potential fall spike, start inactivity window
        if (!inactivityTimerRef.current) {
          inactivityTimerRef.current = setTimeout(() => {
            // Check if average of last few readings is low
            const recent = historyRef.current.slice(-10);
            const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
            if (avg < 15) { // Threshold for "inactive after fall"
              setTriggerType('fall');
              setIsDetecting(false);
              if (onFallRef.current) onFallRef.current(mag);
            }
            inactivityTimerRef.current = null;
          }, 3000);
        }
      }
    }
  }, [isDetecting]);

  const startDetection = useCallback(() => {
    if (permissionState !== 'granted') {
      requestPermission().then(granted => {
        if (granted) {
          setIsActive(true);
          setIsDetecting(true);
          setTriggerType(null);
        }
      });
    } else {
      setIsActive(true);
      setIsDetecting(true);
      setTriggerType(null);
    }
  }, [permissionState, requestPermission]);

  const stopDetection = useCallback(() => {
    setIsActive(false);
    setIsDetecting(false);
    setTriggerType(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      window.addEventListener('devicemotion', handleMotion);
    } else {
      window.removeEventListener('devicemotion', handleMotion);
    }
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isActive, handleMotion]);

  return {
    isActive,
    isDetecting,
    magnitude,
    history,
    permissionState,
    triggerType,
    requestPermission,
    startDetection,
    stopDetection
  };
}