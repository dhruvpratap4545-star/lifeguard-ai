import { useState, useCallback, useRef } from 'react';

export function useEmergencyCountdown(initialSeconds: number = 15, onCountdownEnd?: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);
  const onEndRef = useRef(onCountdownEnd);
  onEndRef.current = onCountdownEnd;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setIsActive(true);
    setSecondsLeft(initialSeconds);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          isActiveRef.current = false;
          setIsActive(false);
          if (onEndRef.current) onEndRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initialSeconds]); // stable — isActive tracked via ref

  const cancel = useCallback(() => {
    clearTimer();
    isActiveRef.current = false;
    setIsActive(false);
    setSecondsLeft(initialSeconds);
  }, [initialSeconds, clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    isActiveRef.current = false;
    setIsActive(false);
    setSecondsLeft(initialSeconds);
  }, [initialSeconds, clearTimer]);

  return { secondsLeft, isActive, start, cancel, reset };
}
