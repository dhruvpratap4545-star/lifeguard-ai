import { useGetStats, useListEmergencySessions } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { ShieldAlert, ShieldCheck, Activity, MapPin, Navigation, Phone, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGpsEngine } from '@/hooks/useGpsEngine';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recentSessions, isLoading: sessionsLoading } = useListEmergencySessions({ limit: 3 });
  
  const hasActiveEmergency = recentSessions?.some(s => s.status === 'active');
  const [sosActive, setSosActive] = useState(false);

  // Live GPS tracking for widget
  const { coords, startTracking, stopTracking } = useGpsEngine();
  
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  const handleSOS = () => {
    setSosActive(true);
    setTimeout(() => {
      setLocation('/emergency?mode=sos');
    }, 400);
  };

  return (
    <div className="flex flex-col p-6 space-y-8 animate-in fade-in zoom-in duration-500">
      <header className="flex justify-between items-center mt-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">LifeGuard</h1>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mt-1">System Active</p>
        </div>
        <div className={cn(
          "px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-2",
          hasActiveEmergency 
            ? "bg-destructive/10 border-destructive text-destructive pulsing-red" 
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        )}>
          {hasActiveEmergency ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          {hasActiveEmergency ? 'ALERT' : 'SAFE'}
        </div>
      </header>

      {/* SOS Button */}
      <section className="flex justify-center py-4">
        <button
          onClick={handleSOS}
          disabled={sosActive}
          data-testid="button-sos"
          className={cn(
            "relative group rounded-full w-48 h-48 flex flex-col items-center justify-center transition-all duration-300",
            sosActive ? "scale-95" : "hover:scale-105 active:scale-95"
          )}
        >
          <div className="absolute inset-0 rounded-full bg-destructive opacity-20 pulsing-red pointer-events-none"></div>
          <div className="absolute inset-2 rounded-full bg-destructive/40 blur-md pointer-events-none"></div>
          <div className="relative z-10 w-40 h-40 rounded-full bg-gradient-to-b from-destructive to-red-700 shadow-2xl flex flex-col items-center justify-center border-4 border-destructive-foreground/20">
            <Activity className="w-12 h-12 text-white mb-2" />
            <span className="text-white font-black text-2xl tracking-widest">SOS</span>
          </div>
        </button>
      </section>

      {/* GPS Widget */}
      <section className="bg-card rounded-2xl border border-card-border p-4 shadow-lg flex items-center gap-4">
        <div className="bg-primary/10 p-3 rounded-full text-primary relative overflow-hidden">
          <div className="radar-sweep"></div>
          <Navigation className="w-6 h-6 relative z-10" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground uppercase font-mono mb-1">Live Location</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono text-foreground">
              {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Acquiring...'}
            </span>
          </div>
        </div>
        <MapPin className="w-5 h-5 text-muted-foreground" />
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-card-border p-4">
          <p className="text-xs text-muted-foreground uppercase font-mono mb-2">Emergencies</p>
          <p className="text-3xl font-black">{statsLoading ? '--' : stats?.totalEmergencies || 0}</p>
        </div>
        <div className="bg-card rounded-2xl border border-card-border p-4">
          <p className="text-xs text-muted-foreground uppercase font-mono mb-2">Contacts</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black">{statsLoading ? '--' : stats?.totalContacts || 0}</p>
            <Phone className="w-5 h-5 text-muted-foreground mb-1" />
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
          <button onClick={() => setLocation('/history')} className="text-xs text-primary font-mono flex items-center">
            View All <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </div>
        
        <div className="space-y-3">
          {sessionsLoading ? (
            <div className="h-16 rounded-xl bg-card border border-border animate-pulse"></div>
          ) : recentSessions?.length === 0 ? (
            <div className="text-center p-6 border border-dashed rounded-xl border-border text-muted-foreground text-sm">
              No recent emergencies
            </div>
          ) : (
            recentSessions?.map(session => (
              <div key={session.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    session.status === 'active' ? "bg-destructive pulsing-red" : 
                    session.status === 'resolved' ? "bg-emerald-500" : "bg-muted-foreground"
                  )} />
                  <div>
                    <p className="text-sm font-bold capitalize">{session.triggerType}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold uppercase",
                  session.status === 'active' ? "bg-destructive/20 text-destructive" :
                  "bg-muted text-muted-foreground"
                )}>
                  {session.status}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}