'use client';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/Toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading, router]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: 'white', boxShadow: '0 0 24px rgba(91,110,245,0.4)',
          animation: 'pulse-ring 1.5s ease infinite',
        }}>F</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>Loading…</div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{
        flex: 1, marginLeft: 228, padding: '32px 36px',
        minHeight: '100vh', overflowX: 'hidden',
        maxWidth: 'calc(100vw - 228px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeUp 0.3s ease both' }}>
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
