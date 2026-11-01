import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavContext, type NavParams, type Route } from './appContext';
import { ToastProvider } from './components/common/Toasts';
import { AppShell } from './components/layout/AppShell';
import { Onboarding } from './features/onboarding/Onboarding';
import { Dashboard } from './features/dashboard/Dashboard';
import { ClientsPage } from './features/customers/ClientsPage';
import { CalendarPage } from './features/appointments/CalendarPage';
import { DesignerPage } from './features/nail-designer/DesignerPage';
import { GalleryPage } from './features/gallery/GalleryPage';
import { ServicesPage } from './features/services/ServicesPage';
import { CalculatorPage } from './features/pricing/CalculatorPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ensureDatabase } from './database/migrations';
import { useSettings } from './hooks/useSettings';

// ---------------------------------------------------------------------------
// Error boundary — Persian fallback if the UI crashes unexpectedly.
// ---------------------------------------------------------------------------

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-main" style={{ paddingTop: '20vh', textAlign: 'center' }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>مشکلی پیش آمد 🌷</h2>
          <p className="text-secondary" style={{ marginBottom: 16 }}>
            برنامه با خطای غیرمنتظره‌ای مواجه شد. داده‌های شما روی همین دستگاه امن هستند.
            دوباره تلاش کنید.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
            بارگذاری دوباره
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// PWA banners — update prompt (registerType 'prompt': never auto-reload) and
// offline-ready notice shown only after the SW has actually cached assets.
// ---------------------------------------------------------------------------

function Banners() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const onRefresh = () => setNeedRefresh(true);
    const onReady = () => setOfflineReady(true);
    window.addEventListener('naildesk:need-refresh', onRefresh);
    window.addEventListener('naildesk:offline-ready', onReady);
    return () => {
      window.removeEventListener('naildesk:need-refresh', onRefresh);
      window.removeEventListener('naildesk:offline-ready', onReady);
    };
  }, []);

  async function update() {
    const reg = (window as unknown as { __naildeskSwUpdate?: () => Promise<void> }).__naildeskSwUpdate;
    if (reg) await reg();
  }

  if (!needRefresh && !offlineReady) return null;
  if (needRefresh) {
    return (
      <div className="banner" role="alert">
        <span style={{ flex: 1 }}>نسخه جدید NailDesk آماده است.</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void update()}>
          به‌روزرسانی
        </button>
      </div>
    );
  }
  return (
    <div className="banner" role="status">
      <span style={{ flex: 1 }}>برنامه برای استفاده آفلاین آماده است.</span>
      <button type="button" className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setOfflineReady(false)} aria-label="بستن">
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type DbState = 'checking' | 'ready' | 'error';

export default function App() {
  const settings = useSettings();
  const [dbState, setDbState] = useState<DbState>('checking');
  const [route, setRoute] = useState<Route>('dashboard');
  const [params, setParams] = useState<NavParams>({});

  useEffect(() => {
    let alive = true;
    ensureDatabase().then((r) => {
      if (alive) setDbState(r.ok ? 'ready' : 'error');
    });
    return () => {
      alive = false;
    };
  }, []);

  // Theme: resolve 'system' against the OS preference and keep in sync.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = settings.theme;
      root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', root.dataset.theme === 'dark' ? '#1D1418' : '#E75A8B');
      }
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  // Ask for persistent storage once, silently, after onboarding.
  useEffect(() => {
    if (settings.onboardingDone && !settings.lastBackupAt) {
      void navigator.storage?.persist?.().catch(() => undefined);
    }
  }, [settings.onboardingDone, settings.lastBackupAt]);

  const nav = useMemo(
    () => ({
      route,
      params,
      navigate: (r: Route, p: NavParams = {}) => {
        setRoute(r);
        setParams(p);
        window.scrollTo(0, 0);
      },
      back: () => {
        setRoute('dashboard');
        setParams({});
      },
    }),
    [route, params],
  );

  if (dbState === 'checking') {
    return <Splash />;
  }

  if (dbState === 'error') {
    return (
      <div className="app-main" style={{ paddingTop: '20vh', textAlign: 'center' }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>بانک اطلاعاتی باز نشد</h2>
        <p className="text-secondary" style={{ marginBottom: 16 }}>
          دسترسی به حافظه محلی ممکن نشد. اگر حالت ناشناس (Private) هستید، از حالت عادی استفاده کنید.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (!settings.onboardingDone) {
    return (
      <ErrorBoundary>
        <ToastProvider>
          <Onboarding />
        </ToastProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <NavContext.Provider value={nav}>
          <AppShell>
            {route === 'dashboard' && <Dashboard />}
            {route === 'clients' && <ClientsPage />}
            {route === 'calendar' && <CalendarPage />}
            {route === 'designer' && <DesignerPage />}
            {route === 'gallery' && <GalleryPage />}
            {route === 'services' && <ServicesPage />}
            {route === 'calculator' && <CalculatorPage />}
            {route === 'settings' && <SettingsPage />}
          </AppShell>
          <Banners />
        </NavContext.Provider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            margin: '0 auto 12px',
            background: 'linear-gradient(180deg,#FF9EBE,#DB2777)',
          }}
        />
        <p style={{ fontWeight: 700 }}>NailDesk</p>
        <p className="hint">در حال آماده‌سازی…</p>
      </div>
    </div>
  );
}
