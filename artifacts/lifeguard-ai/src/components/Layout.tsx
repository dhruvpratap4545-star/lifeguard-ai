import { Link, useLocation } from 'wouter';
import { Activity, ShieldAlert, MessageCircle, Users, Clock } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: Activity, label: 'Dash' },
    { href: '/emergency', icon: ShieldAlert, label: 'Sensor' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
    { href: '/contacts', icon: Users, label: 'Contacts' },
    { href: '/history', icon: Clock, label: 'History' },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background text-foreground relative overflow-hidden shadow-2xl ring-1 ring-border sm:my-8 sm:h-[800px] sm:rounded-3xl">
      <main className="flex-1 overflow-y-auto pb-20 scroll-smooth">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="absolute bottom-0 w-full bg-card/90 backdrop-blur-md border-t border-border px-4 py-2 pb-safe flex justify-between items-center z-50">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon className="w-5 h-5 mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}