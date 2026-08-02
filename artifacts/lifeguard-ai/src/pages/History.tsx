import { useListEmergencySessions } from '@workspace/api-client-react';
import { Clock, ShieldAlert, Activity, Navigation, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import EmergencyMap from '@/components/EmergencyMap';

export default function History() {
  const { data: sessions, isLoading } = useListEmergencySessions();
  const [expanded, setExpanded] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      case 'cancelled': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const getTriggerIcon = (trigger: string) => {
    switch(trigger) {
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
                session.status === 'active' ? "border-destructive shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "border-border"
              )}
            >
              <div 
                className="p-4 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpanded(expanded === session.id ? null : session.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    session.status === 'active' ? "bg-destructive text-white" : "bg-secondary text-muted-foreground"
                  )}>
                    {getTriggerIcon(session.triggerType)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground capitalize tracking-wide">{session.triggerType} Alert</h3>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("px-2 py-1 text-[10px] uppercase font-bold rounded border", getStatusColor(session.status))}>
                    {session.status}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded === session.id && "rotate-180")} />
                </div>
              </div>

              {/* Expanded Details */}
              {expanded === session.id && (
                <div className="px-4 pb-4 pt-2 border-t border-border bg-black/20 animate-in slide-in-from-top-2 fade-in space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Peak Magnitude</p>
                      <p className="text-sm font-mono">{session.accelerometerPeak ? `${session.accelerometerPeak.toFixed(1)} m/s²` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Location</p>
                      <p className="text-sm font-mono flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-primary" />
                        {session.latitude.toFixed(4)}, {session.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  {/* Mini map */}
                  {(session.latitude !== 0 || session.longitude !== 0) && (
                    <EmergencyMap
                      latitude={session.latitude}
                      longitude={session.longitude}
                      height={140}
                      zoom={14}
                      pulse={session.status === 'active'}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}