import type { ReactNode } from 'react';
import {
  CalendarDays,
  Home,
  Images,
  Palette,
  Settings,
  Users,
} from 'lucide-react';
import { cx } from '../../utils/misc';
import { ROUTE_TITLES, type Route } from '../../appContext';
import { useNav } from '../../appContext';

interface TabDef {
  id: Route;
  label: string;
  icon: typeof Home;
}

export const TABS: TabDef[] = [
  { id: 'dashboard', label: 'خانه', icon: Home },
  { id: 'clients', label: 'مشتری‌ها', icon: Users },
  { id: 'calendar', label: 'تقویم', icon: CalendarDays },
  { id: 'designer', label: 'طراحی', icon: Palette },
  { id: 'gallery', label: 'گالری', icon: Images },
  { id: 'settings', label: 'تنظیمات', icon: Settings },
];

export function BottomNav() {
  const { route, navigate } = useNav();
  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = route === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={cx(active && 'active')}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(t.id)}
          >
            <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { route, back } = useNav();
  const isTab = TABS.some((t) => t.id === route);
  return (
    <div className="app">
      <header className="app-header">
        {!isTab && (
          <button type="button" className="icon-btn" onClick={back} aria-label="بازگشت">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <h1>{ROUTE_TITLES[route]}</h1>
      </header>
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
