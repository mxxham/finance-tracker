'use client';
import { useAuth } from '@/lib/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/Toast';
import { getPermissionStatus, checkBudgetAlerts } from '@/lib/notifications';
import { useSettings } from '@/lib/SettingsContext';
import { ApiError } from '@/lib/api';

// Full-screen skeleton shown while auth resolves — lives here, not in ClientLayout,
// because useAuth() requires AuthProvider to be in scope (which it is here but not in root layout)
function DashboardSkeleton() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* Sidebar skeleton */}
      <div style={{ width: 228, borderRight: '1px solid var(--border)', background: 'var(--surface)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', opacity: 0.9 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: 70, borderRadius: 4, marginBottom: 4 }} />
            <div className="skeleton" style={{ height: 9, width: 100, borderRadius: 4 }} />
          </div>
        </div>
        {[40, 60, 50, 55, 45, 50, 48, 42].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10 }}>
            <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 11, width: `${w}%`, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div className="skeleton" style={{ height: 28, width: 160, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: 120, borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ height: 36, width: 86, borderRadius: 9 }} />
            <div className="skeleton" style={{ height: 36, width: 78, borderRadius: 9 }} />
            <div className="skeleton" style={{ height: 36, width: 72, borderRadius: 9 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div className="skeleton" style={{ height: 10, width: 64, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 22, width: 110, borderRadius: 5, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 4, borderRadius: 99 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div className="skeleton" style={{ height: 14, width: 140, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 10, width: 90, borderRadius: 4, marginBottom: 20 }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: 90, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 130, borderRadius: 8, marginBottom: 12 }} />
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 11, borderRadius: 4, marginBottom: 8 }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const redirecting = useRef(false);

  // Single redirect — guarded so it never loops
  useEffect(() => {
    if (loading) return;
    if (!user && !redirecting.current) {
      redirecting.current = true;
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) redirecting.current = false;
  }, [user]);

  // Listen for 401s from any API call and log out cleanly
  useEffect(() => {
    const handle401 = (e: Event) => {
      const err = (e as CustomEvent<ApiError>).detail;
      if (err?.status === 401 && !redirecting.current) {
        redirecting.current = true;
        logout();
        router.replace('/');
      }
    };
    window.addEventListener('api:unauthorized', handle401);
    return () => window.removeEventListener('api:unauthorized', handle401);
  }, [logout, router]);

  const { settings } = useSettings();

  useEffect(() => {
    if (!user || loading) return;
    if (getPermissionStatus() !== 'granted') return;
    if (!settings.budget_alerts) return;
    const threshold = settings.budget_alert_threshold ?? 80;
    const timer = setTimeout(() => {
      checkBudgetAlerts(threshold).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, loading, settings.budget_alerts, settings.budget_alert_threshold]);

  // Nav order for determining slide direction
  const NAV_ORDER = [
    '/dashboard',
    '/dashboard/transactions',
    '/dashboard/budgets',
    '/dashboard/savings',
    '/dashboard/analytics',
    '/dashboard/recurring',
    '/dashboard/categories',
    '/dashboard/scan',
    '/dashboard/settings',
  ];

  useEffect(() => {
    if (!prevPath.current || prevPath.current === pathname || !mainRef.current) {
      prevPath.current = pathname;
      return;
    }
    const prev = prevPath.current;
    const prevIdx = NAV_ORDER.indexOf(prev);
    const nextIdx = NAV_ORDER.indexOf(pathname);
    const goingForward = nextIdx > prevIdx || prevIdx === -1;

    const el = mainRef.current;
    el.classList.remove('page-enter', 'page-enter-back');
    void el.offsetWidth; // force reflow
    el.classList.add(goingForward ? 'page-enter' : 'page-enter-back');

    prevPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    const observe = () => {
      document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
    };
    observe();
    const timer = setTimeout(observe, 400);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [pathname]);

  // Auth resolving → show skeleton (matches real layout to prevent flash)
  if (loading) return <DashboardSkeleton />;

  // Not authed → render nothing, redirect is in flight
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <Sidebar />
      <main className="dashboard-main" style={{ width: '100%', paddingBottom: '84px' }}>
        <div ref={mainRef} className="page-enter dashboard-content">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
