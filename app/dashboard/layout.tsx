'use client';
import { useAuth } from '@/lib/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/Toast';
import { getPermissionStatus, checkBudgetAlerts } from '@/lib/notifications';
import { useSettings } from '@/lib/SettingsContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading, router]);

  const { settings } = useSettings();

  // Auto-check budgets on load if notifications are enabled
  useEffect(() => {
    if (!user || loading) return;
    if (getPermissionStatus() !== 'granted') return;
    if (!settings.budget_alerts) return;
    const threshold = settings.budget_alert_threshold ?? 80;
    // Delay slightly so page content loads first
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', animation: 'pulse-ring 1.5s ease infinite', boxShadow: '0 0 24px rgba(91,110,245,0.4)' }}>F</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em', animation: 'fadeIn 0.5s ease both' }}>Loading…</div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <Sidebar />
      <main className="dashboard-main">
        <div ref={mainRef} className="page-enter dashboard-content">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
