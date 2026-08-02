import {
  useListEmergencySessions,
  useListGpsBroadcasts,
  getListGpsBroadcastsQueryKey,
  getListEmergencySessionsQueryKey,
} from '@workspace/api-client-react';
import type { EmergencySession } from '@workspace/api-client-react';
import { Clock, ShieldAlert, Activity, Navigation, ChevronDown, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import EmergencyMap from '@/components/EmergencyMap';

/** Polls GPS broadcasts every 5 s for an active session and returns the latest coords. */
function useLiveGps(sessionId: number, isActive: boolean) {
  const params = { sessionId, limit: 1 };
  const { data: broadcasts } = useListGpsBroadcasts(params, {
    query: {
      queryKey: getListGpsBroadcastsQueryKey(params),
      // Only poll while the session is active
      refetchInterval: isActive ? 5000 : false,
      enabled: isActive,
    },
  });
  return broadcasts?.[0] ?? null;
}

/** Expanded detail panel for one session. Polls live GPS for active sessions. */
function SessionDetails({ session }: { session: EmergencySession }) {
  const isActive = session.status === 'active';
  const latestBroadcast = useLiveGps(session.id, isActive);

  // Prefer the latest broadcast coords for active sessions; fall back to snapshot
  const displayLat = latestBroadcast?.latitude ?? session.latitude;
  const displayLng = latestBroadcast?.longitude ?? session.longitude;
  const hasCoords = displayLat !== 0 || displayLng !== 0;

  return (
    <div className="px-4 pb-4 pt-2 border-t border-border bg-black/20 animate-in slide-in-from-top-2 fade-in space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Peak Magnitude</p>
          <p className="text-sm font-mono">
            {session.accelerometerPeak ? `${session.accelerometerPeak.toFixed(1)} m/s²` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">
            {isActive && latestBroadcast ? 'Live Position' : 'Location'}
          </p>
          <p className="text-sm font-mono flex items-center gap-1">
            <Navigation className="w-3 h-3 text-primary" />
            {displayLat.toFixed(4)}, {displayLng.toFixed(4)}
          </p>
          {isActive && latestBroadcast && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              Updated {new Date(latestBroadcast.createdAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Mini map — uses live coords for active sessions */}
      {hasCoords && (
        <div className="relative">
          <EmergencyMap
            latitude={displayLat}
            longitude={displayLng}
            height={140}
            zoom={14}
            pulse={isActive}
          />
          {isActive && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulsing-red" />
              <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function History() {
  const { data: sessions, isLoading } = useListEmergencySessions(
    {},
    { query: { queryKey: getListEmergencySessionsQueryKey(), refetchInterval: 10000 } }
  );
  const [expanded, setExpanded] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      case 'cancelled': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'fall': return <Activity className="w-4 h-4" />;
      case 'crash': return <ShieldAlert className="w-4 h-4" />;
      default: return <ShieldAlert className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 flex flex-col min-h-full animate-in fade-in duration-300">
      <header className="flex items-center gap-3 mb-8">
        <Clock className="text-primary w-6 h-6" />
        <h1 className="text-xl font-bold font-mono tracking-wider">LOG</h1>
      </header>

      <div className="space-y-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-card rounded-2xl"></div>
            <div className="h-24 bg-card rounded-2xl"></div>
          </div>
        ) : sessions?.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground text-sm font-mono">Log empty.</p>
          </div>
        ) : (
          sessions?.map(session => (
            <div
              key={session.id}
              className={cn(
                "bg-card border rounded-2xl overflow-hidden transition-all duration-300",
                session.status === 'active'
                  ? "border-destructive shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  : "border-border"
              )}
            >
              <div
                className="p-4 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpanded(expanded === session.id ? null : session.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    session.status === 'active'
                      ? "bg-destructive text-white"
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {getTriggerIcon(session.triggerType)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground capitalize tracking-wide">
                      {session.triggerType} Alert
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* LIVE badge — only for active sessions */}
                  {session.status === 'active' && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10">
                      <Radio className="w-3 h-3 text-emerald-500 pulsing-red" />
                      <span className="text-[10px] uppercase font-bold font-mono text-emerald-400 tracking-wider">Live</span>
                    </span>
                  )}
                  <span className={cn(
                    "px-2 py-1 text-[10px] uppercase font-bold rounded border",
                    getStatusColor(session.status)
                  )}>
                    {session.status}
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    expanded === session.id && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Expanded Details */}
              {expanded === session.id && (
                <SessionDetails session={session} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
