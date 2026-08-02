import { Link } from 'wouter';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in fade-in zoom-in duration-500">
      <AlertCircle className="w-20 h-20 text-destructive mb-6" />
      <h1 className="text-4xl font-black mb-2 uppercase tracking-widest text-foreground">Offline</h1>
      <p className="text-muted-foreground mb-8 font-mono">Signal lost. Sector unreachable.</p>
      <Link href="/" className="px-6 py-3 bg-secondary text-secondary-foreground font-bold tracking-widest rounded-xl hover:bg-secondary/80 transition-colors uppercase border border-border">
        Return to Dash
      </Link>
    </div>
  );
}