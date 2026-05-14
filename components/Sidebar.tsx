'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

// Lucide-style SVG icons for nav
const NAV_ICONS: Record<string, React.ReactNode> = {
  overview:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  analytics:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  transactions:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/><polyline points="19 7 12 0 5 7" style={{opacity:0.5}}/></svg>,
  budgets:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  categories:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h10M4 18h6"/></svg>,
  scan:          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  settings:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

const nav = [
  { href: '/dashboard',              label: 'Overview',     iconKey: 'overview',     desc: 'Summary & charts' },
  { href: '/dashboard/analytics',    label: 'Analytics',    iconKey: 'analytics',    desc: 'Deep insights' },
  { href: '/dashboard/transactions', label: 'Transactions', iconKey: 'transactions', desc: 'All entries' },
  { href: '/dashboard/budgets',      label: 'Budgets',      iconKey: 'budgets',      desc: 'Spending limits' },
  { href: '/dashboard/categories',   label: 'Categories',   iconKey: 'categories',   desc: 'Organize' },
  { href: '/dashboard/scan',         label: 'Scan',         iconKey: 'scan',         desc: 'Import screenshot', highlight: true },
  { href: '/dashboard/settings',     label: 'Settings',     iconKey: 'settings',     desc: 'Preferences' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [activeY, setActiveY] = useState(0);
  const [activeH, setActiveH] = useState(40);
  const [ready, setReady] = useState(false);
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const userCardRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { logout(); router.push('/'); };
  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Update sliding active indicator position
  useEffect(() => {
    const activeIdx = nav.findIndex(n => n.href === pathname);
    if (activeIdx === -1 || !navContainerRef.current) return;
    const el = navRefs.current[activeIdx];
    const container = navContainerRef.current;
    if (!el) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setActiveY(elRect.top - containerRect.top + container.scrollTop);
    setActiveH(elRect.height);
    setReady(true);
  }, [pathname, collapsed]);

  // Magnetic hover effect
  const handleNavMouseMove = (e: React.MouseEvent<HTMLAnchorElement>, idx: number) => {
    const el = navRefs.current[idx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top  - rect.height / 2) / rect.height;
    el.style.transform = `translate(${x * 3}px, ${y * 2}px)`;
  };
  const handleNavMouseLeave = (idx: number) => {
    const el = navRefs.current[idx];
    if (!el) return;
    el.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1), background 0.15s ease, color 0.15s ease';
    el.style.transform = 'translate(0,0)';
    setTimeout(() => { if (el) el.style.transition = ''; }, 420);
  };

  const w = collapsed ? 60 : 228;

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh',
      width: w,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      transition: 'width 0.32s cubic-bezier(0.22,1,0.36,1)',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '22px 14px 18px' : '22px 20px 18px',
        borderBottom: '1px solid var(--border)',
        transition: 'padding 0.3s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
            animation: 'pulse-calm 4s ease infinite',
            boxShadow: '0 0 16px rgba(91,110,245,0.4)',
          }}>F</div>
          {!collapsed && (
            <div className="sidebar-logo-text" style={{ overflow: 'hidden', whiteSpace: 'nowrap', transition: 'opacity 0.2s ease' }}>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em', lineHeight: 1.1 }}>FinTrack</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Personal Finance</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 14, padding: 4, flexShrink: 0,
            opacity: 0.7, cursor: 'pointer',
            transform: collapsed ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.3s ease, opacity 0.2s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>

      {/* Nav */}
      <div ref={navContainerRef} style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', position: 'relative' }}>
        {/* Sliding active indicator */}
        {ready && (
          <div style={{
            position: 'absolute',
            left: 10, right: 10,
            top: activeY,
            height: activeH,
            borderRadius: 10,
            background: 'var(--accent-glow)',
            border: '1px solid rgba(91,110,245,0.25)',
            transition: 'top 0.3s cubic-bezier(0.34,1.1,0.64,1), height 0.3s ease',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}

        {nav.map(({ href, label, iconKey, highlight }, idx) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              ref={el => { navRefs.current[idx] = el; }}
              title={collapsed ? label : undefined}
              onMouseMove={e => handleNavMouseMove(e, idx)}
              onMouseLeave={() => handleNavMouseLeave(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 0' : '9px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10,
                color: active
                  ? (highlight ? 'var(--accent-2)' : 'var(--accent-2)')
                  : 'var(--text-soft)',
                textDecoration: 'none',
                transition: 'background 0.15s ease, color 0.15s ease',
                position: 'relative', zIndex: 1,
                whiteSpace: 'nowrap',
                background: highlight && !active ? 'linear-gradient(135deg, rgba(91,110,245,0.07), rgba(167,139,250,0.07))' : 'transparent',
                ...(highlight && !active ? { border: '1px solid rgba(91,110,245,0.15)', marginTop: 6 } : { border: '1px solid transparent', marginTop: 0 }),
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                  (e.currentTarget as HTMLElement).style.background = active ? '' : 'var(--surface-2)';
                }
              }}
            >
              <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: active ? 1 : 0.7, transition: 'opacity 0.15s' }}>{NAV_ICONS[iconKey]}</span>
              {!collapsed && (
                <span className="sidebar-label" style={{ fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: '-0.01em', overflow: 'hidden', transition: 'opacity 0.2s' }}>{label}</span>
              )}
              {!collapsed && highlight && (
                <span className="sidebar-badge" style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', background: 'var(--accent)', color: 'white', padding: '2px 5px', borderRadius: 4 }}>AI</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        {!collapsed && (
          <div
            ref={userCardRef}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 10px', borderRadius: 10,
              background: 'var(--surface-2)', marginBottom: 6,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              border: '1px solid transparent',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.015)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(91,110,245,0.2)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(91,110,245,0.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>{initials}</div>
            <div className="sidebar-user-name" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: 36, height: 36, borderRadius: '50%', margin: '0 auto 6px',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
          }}>{initials}</div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: collapsed ? '8px 4px' : '8px 10px', borderRadius: 8,
            fontSize: 12, fontWeight: 500,
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid transparent', letterSpacing: '-0.01em',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--red-muted)';
            (e.currentTarget as HTMLElement).style.color = 'var(--red)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,82,82,0.2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
          }}
        >
          {collapsed
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            : <span style={{display:'flex',alignItems:'center',gap:6}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Sign out</span>
          }
        </button>
      </div>
    </aside>
  );
}