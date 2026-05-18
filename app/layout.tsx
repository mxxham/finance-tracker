'use client';
import { useAuth } from '@/lib/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/Toast';
import { getPermissionStatus, checkBudgetAlerts } from '@/lib/notifications';
import { useSettings } from '@/lib/SettingsContext';
import { ApiError } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const redirecting = useRef(false);

  // Redirect to login when not authenticated — only once, no flicker loop
  useEffect(() => {
    if (loading) return;
    if (!user && !redirecting.current) {
      redirecting.current = true;
      router.replace('/');
    }
  }, [user, loading, router]);

  // Reset redirect guard when user logs in
  useEffect(() => {
    if (user) redirecting.current = false;
  }, [user]);

  // Global 401 handler — any API call returning 401 fires this
  // Catches expired / wrong-secret tokens without causing a redirect loop
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

  useEffect(() => {
    if (prevPath.current && prevPath.current !== pathname && mainRef.current) {
      mainRef.current.classList.remove('page-enter');
      void mainRef.current.offsetWidth;
      mainRef.current.classList.add('page-enter');
    }
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

  // While auth is resolving, show a clean spinner — no flicker, no redirect
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', animation: 'pulse-ring 1.5s ease infinite', boxShadow: '0 0 24px rgba(91,110,245,0.4)' }}>F</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>Loading…</div>
      </div>
    </div>
  );

  // Not authenticated: show nothing while router.replace('/') takes effect
  // This prevents the "Please sign in again" screen from flashing
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <Sidebar />
      <main
        className="dashboard-main"
        style={{ width: '100%', paddingBottom: '84px' }}
      >
        <div ref={mainRef} className="page-enter dashboard-content">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}