import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useSensorEngine } from '@/hooks/useSensorEngine';
import { useEmergencyCountdown } from '@/hooks/useEmergencyCountdown';
import { useGpsEngine } from '@/hooks/useGpsEngine';
import { useCreateEmergencySession, useCreateGpsBroadcast } from '@workspace/api-client-react';
import { ShieldAlert, Shield, Activity, X, PhoneCall, AlertOctagon, Navigation } from 'lucide-react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import EmergencyMap from '@/components/EmergencyMap';

export default function Emergency() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode'); // 'sos' or null

  const createEmergency = useCreateEmergencySession();
  const createGpsBroadcast = useCreateGpsBroadcast();

  // Ref so the GPS callback always sees the latest sessionId without stale closure
  const activeSessionIdRef = useRef<number | null>(null);

  const { coords, startTracking } = useGpsEngine((loc) => {
    const sid = activeSessionIdRef.current;
    if (sid !== null) {
      createGpsBroadcast.mutate({
        data: {
          sessionId: sid,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy ?? undefined,
          speed: loc.speed ?? undefined,
          altitude: loc.altitude ?? undefined,
        },
      });
    }
  });

  const [showCountdown, setShowCountdown] = useState(mode === 'sos');
  const [activeTrigger, setActiveTrigger] = useState<'fall' | 'crash' | 'sos' | null>(mode === 'sos' ? 'sos' : null);
  const [finalMagnitude, setFinalMagnitude] = useState<number>(0);

  const handleEmergencyConfirmed = () => {
    createEmergency.mutate({
      data: {
        triggerType: activeTrigger || 'manual',
        latitude: coords?.latitude || 0,
        longitude: coords?.longitude || 0,
        accelerometerPeak: finalMagnitude,
        countdownSeconds: 15,
      }
    }, {
      onSuccess: (session) => {
        // Store session ID so GPS callbacks start tagging broadcasts
        activeSessionIdRef.current = session.id;

        // Send an immediate broadcast with the confirmed coordinates
        if (coords) {
          createGpsBroadcast.mutate({
            data: {
              sessionId: session.id,
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy ?? undefined,
              speed: coords.speed ?? undefined,
              altitude: coords.altitude ?? undefined,
            },
          });
        }

        toast.success('Emergency Session Active. Broadcasting GPS.');
        setLocation('/');
      },
      onError: () => {
        toast.error('Failed to create session, falling back to local alarm.');
      }
    });
  };

  const {
    secondsLeft,
    start: startCountdown,
    cancel: cancelCountdown,
    isActive: countdownActive
  } = useEmergencyCountdown(15, handleEmergencyConfirmed);

  const {
    isActive,
    magnitude,
    history,
    startDetection,
    stopDetection,
  } = useSensorEngine({
    onFallDetected: (mag) => {
      setFinalMagnitude(mag);
      setActiveTrigger('fall');
      setShowCountdown(true);
      startCountdown();
    },
    onCrashDetected: (mag) => {
      setFinalMagnitude(mag);
      setActiveTrigger('crash');
      setShowCountdown(true);
      startCountdown();
    }
  });

  useEffect(() => {
    startTracking();
    if (mode === 'sos') {
      startCountdown();
    }
  }, [mode, startTracking, startCountdown]);

  const toggleSensor = () => {
    if (isActive) {
      stopDetection();
    } else {
      startDetection();
    }
  };

  const handleCancel = () => {
    cancelCountdown();
    setShowCountdown(false);
    setActiveTrigger(null);
    setFinalMagnitude(0);
    if (mode === 'sos') {
      setLocation('/');
    }
  };

  const chartData = history.map((val, i) => ({ index: i, value: val }));
  
  const getMagColor = (mag: number) => {
    if (mag < 10) return 'text-emerald-500';
    if (mag < 20) return 'text-yellow-500';
    return 'text-destructive';
  };

  return (
    <div className="flex flex-col h-full bg-background relative animate-in fade-in duration-500">
      
      {/* Sensor Dashboard View */}
      <div className="p-6 flex-1 flex flex-col">
        <header className="flex items-center gap-3 mb-8">
          <Activity className="text-primary w-6 h-6" />
          <h1 className="text-xl font-bold font-mono tracking-wider">SENSOR ENGINE</h1>
        </header>

        {/* Waveform Card */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex-1 max-h-64 mb-6 relative overflow-hidden">
          <div className="absolute top-4 left-4 flex flex-col">
            <span className="text-xs text-muted-foreground font-mono uppercase">Acceleration</span>
            <span className={cn("text-4xl font-black font-mono", getMagColor(magnitude))}>
              {magnitude.toFixed(1)} <span className="text-sm text-muted-foreground">m/s²</span>
            </span>
          </div>

          <div className="absolute bottom-0 left-0 w-full h-3/4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={[0, 50]} hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={magnitude > 20 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {!isActive && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <span className="text-muted-foreground font-mono font-bold tracking-widest text-sm">SENSOR OFFLINE</span>
            </div>
          )}
        </div>

        {/* Arm Button */}
        <button
          onClick={toggleSensor}
          data-testid="button-arm-sensor"
          className={cn(
            "w-full py-6 rounded-2xl font-black text-xl tracking-widest transition-all duration-300 border-2 flex items-center justify-center gap-3",
            isActive 
              ? "bg-transparent border-destructive text-destructive" 
              : "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          )}
        >
          {isActive ? (
            <>
              <div className="w-3 h-3 rounded-full bg-destructive pulsing-red"></div>
              SYSTEM ARMED
            </>
          ) : (
            <>
              <Shield className="w-6 h-6" />
              ARM SENSOR
            </>
          )}
        </button>
      </div>

      {/* Emergency Overlay */}
      {showCountdown && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
          
          <AlertOctagon className="w-20 h-20 text-destructive mb-6 pulsing-red" />
          
          <h2 className="text-3xl font-black text-white text-center uppercase tracking-widest mb-2">
            {activeTrigger === 'sos' ? 'SOS Triggered' : `${activeTrigger} Detected`}
          </h2>
          
          <p className="text-muted-foreground text-center mb-4 text-sm max-w-xs">
            Emergency broadcast initiating in:
          </p>

          {/* Live GPS Map — updates pin as coords change */}
          {coords ? (
            <div className="w-full max-w-xs mb-4 rounded-xl overflow-hidden">
              <EmergencyMap
                latitude={coords.latitude}
                longitude={coords.longitude}
                height={160}
                zoom={15}
                pulse
              />
              <p className="text-[10px] text-muted-foreground font-mono text-center mt-1 flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3 text-primary" />
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                <span className="ml-1 inline-flex items-center gap-1 text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulsing-red inline-block" />
                  LIVE
                </span>
              </p>
            </div>
          ) : (
            <div className="w-full max-w-xs mb-4 h-[160px] rounded-xl bg-secondary/30 border border-border flex items-center justify-center">
              <p className="text-muted-foreground text-xs font-mono">Acquiring GPS…</p>
            </div>
          )}

          <div className="relative flex items-center justify-center mb-6">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-secondary" />
              <circle 
                cx="80" cy="80" r="72" 
                stroke="currentColor" 
                strokeWidth="6" 
                fill="transparent" 
                strokeDasharray="452" 
                strokeDashoffset={452 - (452 * secondsLeft) / 15}
                className={cn(
                  "transition-all duration-1000 ease-linear",
                  secondsLeft < 6 ? "text-destructive" : "text-primary"
                )} 
              />
            </svg>
            <span className={cn(
              "absolute text-6xl font-black font-mono",
              secondsLeft < 6 ? "text-destructive pulsing-red" : "text-white"
            )}>
              {secondsLeft}
            </span>
          </div>

          <div className="w-full flex gap-4">
            <button 
              onClick={handleCancel}
              className="flex-1 py-5 rounded-xl bg-secondary text-secondary-foreground font-bold text-lg tracking-wider flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" /> CANCEL
            </button>
            <button 
              onClick={handleEmergencyConfirmed}
              className="flex-1 py-5 rounded-xl bg-destructive text-destructive-foreground font-bold text-lg tracking-wider flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-5 h-5" /> CALL NOW
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
