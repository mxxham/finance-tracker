'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '◈' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '▤' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: '⇄' },
  { href: '/dashboard/scan', label: 'Scan Screenshot', icon: '⊙', highlight: true },
  { href: '/dashboard/budgets', label: 'Budgets', icon: '◉' },
  { href: '/dashboard/categories', label: 'Categories', icon: '⊞' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col z-50"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ background: 'var(--accent)' }}>F</div>
        <span className="font-bold tracking-tight">FinTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon, highlight }) => {
          const active = pathname === href;
          if (highlight && !active) {
            return (
              <Link key={href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'var(--accent)20', color: 'var(--accent-2)', border: '1px solid var(--accent)40' }}>
                <span className="text-base">{icon}</span>
                {label}
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--accent)', color: 'white', fontSize: '9px' }}>AI</span>
              </Link>
            );
          }
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--accent)20' : 'transparent',
                color: active ? 'var(--accent-2)' : 'var(--text-muted)',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-2"
          style={{ background: 'var(--surface-2)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--accent)' }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full py-2 px-3 rounded-lg text-xs font-medium transition-all text-left"
          style={{ color: 'var(--text-muted)' }}>
          → Sign out
        </button>
      </div>
    </aside>
  );
}
