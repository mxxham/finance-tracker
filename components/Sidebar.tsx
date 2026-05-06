'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

const nav = [
  { href: '/dashboard',              label: 'Overview',      icon: '▦', desc: 'Summary & charts' },
  { href: '/dashboard/analytics',    label: 'Analytics',     icon: '◈', desc: 'Deep insights' },
  { href: '/dashboard/transactions', label: 'Transactions',  icon: '⇅', desc: 'All entries' },
  { href: '/dashboard/budgets',      label: 'Budgets',       icon: '◎', desc: 'Spending limits' },
  { href: '/dashboard/categories',   label: 'Categories',    icon: '⊞', desc: 'Organize' },
  { href: '/dashboard/scan',         label: 'Scan',          icon: '⊙', desc: 'Import screenshot', highlight: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/'); };
  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: 228,
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white',
            boxShadow: '0 0 16px rgba(91,110,245,0.4)',
          }}>F</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em', lineHeight: 1.1 }}>FinTrack</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Personal Finance</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {nav.map(({ href, label, icon, desc, highlight }) => {
          const active = pathname === href;
          if (highlight) {
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 10,
                background: active ? 'var(--accent-glow)' : 'linear-gradient(135deg, rgba(91,110,245,0.1), rgba(167,139,250,0.1))',
                color: active ? 'var(--accent-2)' : 'var(--accent-2)',
                border: `1px solid ${active ? 'rgba(91,110,245,0.4)' : 'rgba(91,110,245,0.2)'}`,
                textDecoration: 'none', marginTop: 6,
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{label}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  background: 'var(--accent)', color: 'white', padding: '2px 5px', borderRadius: 4,
                }}>AI</span>
              </Link>
            );
          }
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 10,
              background: active ? 'var(--accent-glow)' : 'transparent',
              color: active ? 'var(--accent-2)' : 'var(--text-soft)',
              border: `1px solid ${active ? 'rgba(91,110,245,0.25)' : 'transparent'}`,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-soft)'; } }}>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0, opacity: active ? 1 : 0.7 }}>{icon}</span>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: '-0.01em' }}>{label}</span>
              {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 10px', borderRadius: 10,
          background: 'var(--surface-2)', marginBottom: 6,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent',
          textAlign: 'left', letterSpacing: '-0.01em',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--red-muted)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,82,82,0.2)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}>
          ↗ Sign out
        </button>
      </div>
    </aside>
  );
}
