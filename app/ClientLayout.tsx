'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

// Full-screen loading skeleton shown on first app paint before auth resolves
function AppLoadingSkeleton() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', background: 'var(--bg)',
      position: 'fixed', inset: 0, zIndex: 9999,
      animation: 'fadeIn 0.15s ease both',
    }}>
      {/* Sidebar skeleton */}
      <div style={{
        width: 220, borderRight: '1px solid var(--border)',
        background: 'var(--surface)', padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', opacity: 0.9 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: 70, borderRadius: 4, marginBottom: 4 }} />
            <div className="skeleton" style={{ height: 9, width: 100, borderRadius: 4 }} />
          </div>
        </div>
        {/* Nav items */}
        {[40, 60, 50, 55, 45, 50].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10 }}>
            <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 11, width: `${w}%`, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
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

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div className="skeleton" style={{ height: 10, width: 64, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 22, width: 110, borderRadius: 5, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 4, borderRadius: 99 }} />
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div className="skeleton" style={{ height: 14, width: 140, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 10, width: 90, borderRadius: 4, marginBottom: 20 }} />
            <div className="skeleton" style={{ height: 180, borderRadius: 8 }} />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div className="skeleton" style={{ height: 14, width: 90, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 10, width: 110, borderRadius: 4, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 130, borderRadius: 8, marginBottom: 14 }} />
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 11, borderRadius: 4, marginBottom: 8 }} />)}
          </div>
        </div>

        {/* Recent transactions */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 13, width: 140, borderRadius: 4 }} />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 11, width: '60%', borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 9, width: '40%', borderRadius: 4 }} />
              </div>
              <div className="skeleton" style={{ height: 13, width: 70, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();

  // Show full skeleton on very first paint (auth check in progress)
  // Only on dashboard routes — auth page handles its own loading
  const isDashboard = pathname?.startsWith('/dashboard');
  if (loading && isDashboard) return <AppLoadingSkeleton />;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}