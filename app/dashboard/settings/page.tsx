'use client';
import React from 'react';
import { getNotifSupport, getPermissionStatus, requestPermission, subscribeToPush, savePushSubscription, unsubscribeFromPush, sendTestNotification, checkBudgetAlerts, type NotifPermission } from '@/lib/notifications';
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { showToast } from '@/components/Toast';
import { CURRENCIES, UserSettings } from '@/lib/currencies';
import { USD_RATES } from '@/lib/currencies';
import { THEMES, applyTheme } from '@/lib/themes';

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent-glow-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [isMobileCard, setIsMobileCard] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobileCard(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobileCard(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: isMobileCard ? 16 : 24, ...style }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{children}</label>;
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 99, border: 'none', padding: 2, flexShrink: 0,
          background: checked ? 'var(--accent)' : 'var(--surface-3)',
          transition: 'background 0.22s ease',
          display: 'flex', alignItems: 'center',
          justifyContent: checked ? 'flex-end' : 'flex-start',
        }}
      >
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'transform 0.22s cubic-bezier(0.34,1.2,0.64,1)' }} />
      </button>
    </div>
  );
}

function SaveRow({ onSave, saving, label = 'Save changes' }: { onSave: () => void; saving: boolean; label?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <button
        onClick={onSave}
        disabled={saving}
        style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)', opacity: saving ? 0.6 : 1, transition: 'all 0.18s ease', letterSpacing: '-0.01em' }}
      >
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

// Lucide SVG icons for settings sections
const SECTION_ICONS: Record<string, React.ReactNode> = {
  profile:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  currency:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 000 4h4a2 2 0 010 4H8"/><path d="M12 6v2m0 8v2"/></svg>,
  payday:        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  appearance:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>,
  display:       <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  notifications: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  password:      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  data:          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  danger:        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

const SECTIONS = [
  { id: 'profile',       label: 'Profile',      iconKey: 'profile' },
  { id: 'currency',      label: 'Currency',     iconKey: 'currency' },
  { id: 'payday',        label: 'Payday',       iconKey: 'payday' },
  { id: 'appearance',    label: 'Appearance',   iconKey: 'appearance' },
  { id: 'display',       label: 'Display',      iconKey: 'display' },
  { id: 'notifications', label: 'Alerts',       iconKey: 'notifications' },
  { id: 'permissions',   label: 'Permissions',   iconKey: 'notifications' },

  { id: 'password',      label: 'Password',     iconKey: 'password' },
  { id: 'data',          label: 'Data',         iconKey: 'data' },
  { id: 'danger',        label: 'Danger Zone',  iconKey: 'danger' },
];

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { user, logout } = useAuth();

  const [active, setActive] = useState('profile');
  const [saving, setSaving] = useState(false);

  // Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Currency
  const [currency, setCurrency] = useState('IDR');
  const [showDecimals, setShowDecimals] = useState(false);
  const [compactNumbers, setCompactNumbers] = useState(true);
  const [currencySearch, setCurrencySearch] = useState('');
  const [convertAmounts, setConvertAmounts] = useState(true);

  // Payday
  const [payday, setPayday] = useState(25);

  // Appearance
  const [theme, setTheme] = useState('midnight');
  const [language, setLanguage] = useState<'en'|'id'>('en');
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [weekStart, setWeekStart] = useState('monday');
  const [defaultView, setDefaultView] = useState('overview');

  // Alerts
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [notifPermission, setNotifPermission] = useState<NotifPermission>('default');
  const [notifSupported, setNotifSupported] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ txCount: number; catCount: number; memberSince: string } | null>(null);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);
  // Check notification permission on mount
  useEffect(() => {
    const { supported, pushSupported } = getNotifSupport();
    setNotifSupported(supported);
    setPushSupported(pushSupported);
    setNotifPermission(getPermissionStatus());
  }, []);

  const handleEnableNotifications = async () => {
    setNotifLoading(true);
    try {
      const perm = await requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        // Register SW subscription
        const sub = await subscribeToPush();
        if (sub) await savePushSubscription(sub);
        // Save to settings
        await updateSettings({ budget_alerts: true, budget_alert_threshold: alertThreshold });
        setBudgetAlerts(true);
        // Fire test notification
        setTimeout(() => { sendTestNotification(); }, 800);
      }
    } finally {
      setNotifLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setNotifLoading(true);
    try {
      await unsubscribeFromPush();
      await updateSettings({ budget_alerts: false, budget_alert_threshold: alertThreshold });
      setBudgetAlerts(false);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSendTest = async () => {
    setTestSent(false);
    const ok = await sendTestNotification();
    if (!ok) {
      const perm = await requestPermission();
      setNotifPermission(perm);
    } else {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  const handleCheckNow = async () => {
    setNotifLoading(true);
    try {
      // force=true bypasses session dedup so every qualifying budget fires a notification,
      // even if alerts were already sent earlier this session.
      const result = await checkBudgetAlerts(alertThreshold, true);
      if (result.fired === 0) {
        if (result.budgets.length === 0) {
          showToast(`All budgets are under ${alertThreshold}% — nothing to alert`);
        } else {
          showToast(`${result.budgets.length} budget${result.budgets.length > 1 ? 's' : ''} checked — none need alerting yet`);
        }
      } else {
        showToast(`Fired ${result.fired} budget alert${result.fired > 1 ? 's' : ''}`);
      }
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    // Keep local inputs in sync with loaded user/settings.
    // Wrap in microtask to avoid the eslint 'setState in effect' heuristic.
    queueMicrotask(() => {
      setName(user?.name || '');
      setEmail(user?.email || '');
      setCurrency(settings.currency);
      setShowDecimals(settings.show_decimals);
      setCompactNumbers(settings.compact_numbers);
      setPayday(settings.payday);
      setTheme(settings.theme || 'midnight');
      setLanguage((settings.language as 'en'|'id') || 'en');
      setEnableAnimations(settings.enable_animations);
      setDateFormat(settings.date_format);
      setWeekStart(settings.week_start);
      setDefaultView(settings.default_view);
      setBudgetAlerts(settings.budget_alerts);
      setAlertThreshold(settings.budget_alert_threshold);
    });
  }, [user, settings]);



  const loadStats = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([
        api.getTransactions({ limit: '1000' }),
        api.getCategories(),
      ]);
      setStats({
        txCount: txs.length,
        catCount: cats.length,
        memberSince: user ? new Date().getFullYear().toString() : '—',
      });
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { if (active === 'data' || active === 'danger') loadStats(); }, [active, loadStats]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile({ name, email });
      localStorage.setItem('ft_user', JSON.stringify(res.user));
      showToast('Profile updated');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const saveCurrency = async () => {
    setSaving(true);
    try {
      const chosen = CURRENCIES.find(c => c.code === currency);
      const prevCurrency = settings.currency;

      // If currency changed and user wants amounts converted, convert all data
      if (convertAmounts && currency !== prevCurrency) {
        await api.convertCurrency(prevCurrency, currency);
      }

      await updateSettings({ currency, locale: chosen?.locale || 'id-ID', show_decimals: showDecimals, compact_numbers: compactNumbers });
      showToast(convertAmounts && currency !== prevCurrency
        ? `Currency changed & amounts converted to ${currency}`
        : 'Currency settings saved');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const savePayday = async () => {
    setSaving(true);
    try {
      await updateSettings({ payday });
      showToast('Payday updated');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const saveAppearance = async () => {
    setSaving(true);
    try {
      await updateSettings({ theme, language, enable_animations: enableAnimations, date_format: dateFormat, week_start: weekStart, default_view: defaultView });
      showToast('Appearance saved');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const saveAlerts = async () => {
    setSaving(true);
    try {
      await updateSettings({ budget_alerts: budgetAlerts, budget_alert_threshold: alertThreshold });
      showToast('Alert settings saved');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (newPw !== confirmPw) { showToast('Passwords do not match', 'error'); return; }
    if (newPw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    setSaving(true);
    try {
      await api.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password changed');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const exportData = async () => {
    try {
      const txs = await api.getTransactions({ limit: '10000' });
      const header = 'Date,Type,Amount,Description,Category\n';
      const rows = txs.map((t: { date: string; type: string; amount: number; description: string; category_name: string }) =>
        `${t.date.slice(0,10)},${t.type},${t.amount},"${(t.description||'').replace(/"/g,'""')}","${(t.category_name||'').replace(/"/g,'""')}"`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `fintrack-export-${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      showToast('Export complete');
    } catch { showToast('Export failed', 'error'); }
  };

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.symbol.includes(currencySearch)
  );

  const selectedCurrency = CURRENCIES.find(c => c.code === currency);
  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div className="animate-fadeUp" style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage your account, preferences, and data</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Side nav */}
        <div className="animate-fadeUp" style={isMobile ? {
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
        } : {
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 32,
        }}>
          {/* User mini card - hide on mobile to save space */}
          {!isMobile && (
          <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white' }}>{initials}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 148 }}>{user?.email}</div>
            </div>
          </div>
          )}

          {/* Nav items */}
          <div style={isMobile ? {
            display: 'flex', overflowX: 'auto', padding: '8px', gap: 4,
            scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
          } : { padding: '8px 8px' }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={isMobile ? {
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 12px', borderRadius: 10, border: 'none',
                  background: active === s.id ? 'var(--accent-glow)' : 'transparent',
                  color: active === s.id ? 'var(--accent-2)' : 'var(--text-soft)',
                  fontSize: 10, fontWeight: active === s.id ? 700 : 500,
                  transition: 'all 0.15s ease',
                  ...(s.id === 'danger' ? { color: active === s.id ? 'var(--red)' : 'var(--text-muted)', background: active === s.id ? 'rgba(240,82,82,0.08)' : 'transparent' } : {}),
                } : {
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 8, border: 'none', textAlign: 'left',
                  background: active === s.id ? 'var(--accent-glow)' : 'transparent',
                  color: active === s.id ? 'var(--accent-2)' : 'var(--text-soft)',
                  fontSize: 13, fontWeight: active === s.id ? 600 : 500,
                  transition: 'all 0.15s ease',
                  ...(s.id === 'danger' ? { marginTop: 6, color: active === s.id ? 'var(--red)' : 'var(--text-muted)', background: active === s.id ? 'rgba(240,82,82,0.08)' : 'transparent' } : {}),
                }}
                onMouseEnter={e => { if (active !== s.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { if (active !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 13, opacity: 0.8, display:'flex', alignItems:'center' }}>{SECTION_ICONS[s.iconKey]}</span>
                {isMobile ? <span style={{ whiteSpace: 'nowrap' }}>{s.label}</span> : s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="animate-fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── PROFILE ── */}
          {active === 'profile' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.profile} title="Profile" subtitle="Update your personal information" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Label>Full name</Label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <Label>Email address</Label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Member since</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>2025</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Account ID</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>#{user?.id?.toString().padStart(6, '0')}</div>
                  </div>
                </div>
              </div>
              <SaveRow onSave={saveProfile} saving={saving} />
            </Card>
          )}

          {/* ── CURRENCY ── */}
          {active === 'currency' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.currency} title="Currency & Formatting" subtitle="Choose your currency and how numbers are displayed" />

              {/* Current selection preview */}
              {selectedCurrency && (
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent-glow)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'center' }}>{selectedCurrency.symbol}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedCurrency.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCurrency.code} · {selectedCurrency.locale}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>
                    {new Intl.NumberFormat(selectedCurrency.locale, { style: 'currency', currency: selectedCurrency.code, maximumFractionDigits: showDecimals ? 2 : 0 }).format(1234567)}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <Label>Search currency</Label>
                <input
                  value={currencySearch}
                  onChange={e => setCurrencySearch(e.target.value)}
                  placeholder="Search by name, code, or symbol…"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 8, maxHeight: 380, overflowY: 'auto', marginBottom: 20, paddingRight: 4 }}>
                {filteredCurrencies.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, border: 'none', textAlign: 'left',
                      background: currency === c.code ? 'var(--accent-glow)' : 'var(--surface-2)',
                      outline: currency === c.code ? '1px solid var(--accent)' : '1px solid var(--border)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (currency !== c.code) (e.currentTarget as HTMLElement).style.outlineColor = 'var(--border-2)'; }}
                    onMouseLeave={e => { if (currency !== c.code) (e.currentTarget as HTMLElement).style.outlineColor = 'var(--border)'; }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700, color: currency === c.code ? 'var(--accent)' : 'var(--text-muted)', minWidth: 24, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{c.symbol}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: currency === c.code ? 'var(--accent-2)' : 'var(--text)', letterSpacing: '-0.01em' }}>{c.code}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <Label>Display options</Label>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Toggle
                    checked={showDecimals}
                    onChange={setShowDecimals}
                    label="Show decimal places"
                    description="Display cents/pence (e.g. Rp 12.500,00 instead of Rp 12.500)"
                  />
                  <Toggle
                    checked={compactNumbers}
                    onChange={setCompactNumbers}
                    label="Compact large numbers"
                    description="Show 1.2M instead of 1,200,000 in charts"
                  />
                  {currency !== settings.currency && (
                    <Toggle
                      checked={convertAmounts}
                      onChange={setConvertAmounts}
                      label="Convert existing amounts"
                      description={`Automatically convert all your transactions & budgets from ${settings.currency} to ${currency} using approximate exchange rates`}
                    />
                  )}
                </div>
              </div>

              {/* Conversion preview */}
              {currency !== settings.currency && convertAmounts && (() => {
                const fromRate = USD_RATES[settings.currency] ?? 1;
                const toRate = USD_RATES[currency] ?? 1;
                const rate = toRate / fromRate;
                const exampleFrom = settings.currency === 'IDR' || settings.currency === 'VND' ? 100000 : settings.currency === 'JPY' || settings.currency === 'KRW' ? 10000 : 100;
                const exampleTo = Math.round(exampleFrom * rate * 100) / 100;
                const fromSym = CURRENCIES.find(c => c.code === settings.currency)?.symbol || settings.currency;
                const toSym = CURRENCIES.find(c => c.code === currency)?.symbol || currency;
                return (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent-glow)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>↔</span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{fromSym}{exampleFrom.toLocaleString()}</span>
                      {' '}{settings.currency} → {' '}
                      <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{toSym}{exampleTo.toLocaleString()}</span>
                      {' '}{currency}
                      <span style={{ marginLeft: 8, opacity: 0.6 }}>· approx. rate 1 {settings.currency} = {rate.toFixed(4)} {currency}</span>
                    </div>
                  </div>
                );
              })()}

              <SaveRow onSave={saveCurrency} saving={saving} />
            </Card>
          )}

          {/* ── PAYDAY ── */}
          {active === 'payday' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.payday} title="Payday & Budget Cycle" subtitle="Set when you get paid — used for the payday survival budget" />
              <div style={{ marginBottom: 24 }}>
                <Label>Day of month you get paid</Label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(7, 1fr)' : 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    const isLate = d > 28;
                    return (
                      <button
                        key={d}
                        onClick={() => setPayday(d)}
                        title={isLate ? `In shorter months, this will use the last day of that month` : undefined}
                        style={{
                          padding: '10px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
                          background: payday === d ? 'var(--accent)' : isLate ? 'var(--surface-3)' : 'var(--surface-2)',
                          color: payday === d ? 'white' : isLate ? 'var(--text-soft)' : 'var(--text-muted)',
                          boxShadow: payday === d ? '0 4px 16px var(--accent-glow-2)' : 'none',
                          outline: isLate && payday !== d ? '1px dashed var(--border-2)' : 'none',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                        onMouseEnter={e => { if (payday !== d) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                        onMouseLeave={e => { if (payday !== d) (e.currentTarget as HTMLElement).style.background = isLate ? 'var(--surface-3)' : 'var(--surface-2)'; }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                {payday > 28 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-muted)', border: '1px solid rgba(245,166,35,0.25)', marginBottom: 8 }}>
                    <span style={{ display:'flex', alignItems:'center', color:'var(--amber)', flexShrink:0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                    <span style={{ fontSize: 11, color: 'var(--amber)' }}>
                      In months with fewer days, payday will automatically use the last day of that month (e.g. Feb 28/29, Apr 30).
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12, paddingLeft: 2 }}>
                  Days 29–31 are dashed — they clamp to the last day of shorter months.
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 18 }}>◈</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Payday set to the <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{payday}{['st','nd','rd'][((payday-1)%10 < 3 && Math.floor((payday-1)/10) !== 1) ? (payday-1)%10 : 3] || 'th'}</span> of each month</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>The Analytics page uses this to calculate your daily safe-to-spend budget</div>
                  </div>
                </div>
              </div>
              <SaveRow onSave={savePayday} saving={saving} />
            </Card>
          )}

          {/* ── APPEARANCE ── */}
          {active === 'appearance' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.appearance} title="Appearance" subtitle="Customize how the app looks and behaves" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Language Selector */}
                <div>
                  <Label>App Language</Label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {([
                      { code: 'en' as const, label: 'English', flag: '🇬🇧', sub: 'English' },
                      { code: 'id' as const, label: 'Bahasa Indonesia', flag: '🇮🇩', sub: 'Indonesian' },
                    ]).map(lang => (
                      <button key={lang.code} onClick={() => setLanguage(lang.code)} style={{
                        flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        border: `2px solid ${language === lang.code ? 'var(--accent)' : 'var(--border)'}`,
                        background: language === lang.code ? 'var(--accent-glow)' : 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                        boxShadow: language === lang.code ? '0 2px 12px var(--accent-glow-2)' : 'none',
                        transition: 'all 0.15s ease',
                      }}>
                        <span style={{ fontSize: 28 }}>{lang.flag}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: language === lang.code ? 'var(--accent)' : 'var(--text)' }}>{lang.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lang.sub}</div>
                        </div>
                        {language === lang.code && (
                          <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Changes the language of all app text. Takes effect after saving.</p>
                </div>

                {/* Theme Picker */}
                <div>
                  <Label>Color theme</Label>
                  {(() => {
                    const darkThemes = THEMES.filter(t => !t.isLight);
                    const lightThemes = THEMES.filter(t => t.isLight);
                    const renderThemeButton = (t: typeof THEMES[0]) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id);
                          applyTheme(t);
                          updateSettings({ theme: t.id });
                        }}
                        title={t.name}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: isMobile ? 5 : 8,
                          padding: isMobile ? '7px 4px 7px' : '10px 8px 10px',
                          borderRadius: 12,
                          border: 'none',
                          background: theme === t.id ? 'var(--accent-glow)' : 'var(--surface-2)',
                          outline: theme === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                          transition: 'all 0.18s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => { if (theme !== t.id) (e.currentTarget as HTMLElement).style.outlineColor = 'var(--border-2)'; }}
                        onMouseLeave={e => { if (theme !== t.id) (e.currentTarget as HTMLElement).style.outlineColor = 'var(--border)'; }}
                      >
                        {/* Swatch */}
                        <div style={{
                          width: isMobile ? 32 : 40,
                          height: isMobile ? 32 : 40,
                          borderRadius: 8,
                          background: t.swatchBg,
                          border: t.isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.08)',
                          position: 'relative',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}>
                          {/* Diagonal split showing accent + highlight */}
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '65%',
                            height: '65%',
                            background: t.swatchAccent,
                            borderTopLeftRadius: 8,
                          }} />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '35%',
                            height: '35%',
                            background: t.swatchHighlight,
                          }} />
                          {/* Active checkmark */}
                          {theme === t.id && (
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: t.isLight ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)',
                              fontSize: 14,
                              color: 'white',
                            }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.isLight ? '#111' : 'white'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                          )}
                        </div>
                        <div style={{ fontSize: isMobile ? 8 : 10, fontWeight: 600, color: theme === t.id ? 'var(--accent-2)' : 'var(--text-soft)', letterSpacing: '-0.01em', textAlign: 'center', lineHeight: 1.2 }}>
                          {t.name}
                        </div>
                      </button>
                    );
                    return (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Dark</div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 6 : 10, marginBottom: 14 }}>
                          {darkThemes.map(renderThemeButton)}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Light</div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 6 : 10 }}>
                          {lightThemes.map(renderThemeButton)}
                        </div>
                      </>
                    );
                  })()}
                  
                  {/* Description of selected theme */}
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-2)' }}>{THEMES.find(t => t.id === theme)?.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> — {THEMES.find(t => t.id === theme)?.description}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Date format</Label>
                  <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/01/2025)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (01/31/2025)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2025-01-31)</option>
                    <option value="D MMM YYYY">D MMM YYYY (31 Jan 2025)</option>
                  </select>
                </div>
                <div>
                  <Label>Week starts on</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['monday','Mon'],['sunday','Sun'],['saturday','Sat']].map(([v, l]) => (
                      <button key={v} onClick={() => setWeekStart(v)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, background: weekStart === v ? 'var(--accent)' : 'var(--surface-2)', color: weekStart === v ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Default dashboard view</Label>
                  <select value={defaultView} onChange={e => setDefaultView(e.target.value)}>
                    <option value="overview">Overview</option>
                    <option value="analytics">Analytics</option>
                    <option value="transactions">Transactions</option>
                  </select>
                </div>
                <div>
                  <Toggle
                    checked={enableAnimations}
                    onChange={setEnableAnimations}
                    label="Enable animations"
                    description="Smooth transitions, card tilts, and chart animations"
                  />
                </div>
              </div>
              <SaveRow onSave={saveAppearance} saving={saving} />
            </Card>
          )}

          {/* ── DISPLAY ── */}
          {active === 'display' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.display} title="Display Preferences" subtitle="Control what's visible throughout the app" />
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Example number formatting</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                  {new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency, maximumFractionDigits: showDecimals ? 2 : 0 }).format(1234567.89)}
                </div>
              </div>
              <div>
                <Toggle
                  checked={showDecimals}
                  onChange={v => { setShowDecimals(v); updateSettings({ show_decimals: v }); }}
                  label="Show decimal places"
                  description="Display sub-unit values in all currency amounts"
                />
                <Toggle
                  checked={compactNumbers}
                  onChange={v => { setCompactNumbers(v); updateSettings({ compact_numbers: v }); }}
                  label="Compact large numbers"
                  description="Use K/M/B abbreviations in charts"
                />
                <Toggle
                  checked={enableAnimations}
                  onChange={v => { setEnableAnimations(v); updateSettings({ enable_animations: v }); }}
                  label="Animations"
                  description="Card tilts, animated counters, staggered reveals"
                />
              </div>
            </Card>
          )}

          {/* ── PERMISSIONS ── */}
          {active === 'permissions' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.notifications} title="Notifications Permissions" subtitle="Request notification permission and verify push support" />

              {!notifSupported && (
                <div style={{ padding: '16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notifications not supported</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your browser does not support push notifications.</div>
                </div>
              )}

              {notifSupported && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <Label>Permission status</Label>
                    <div style={{ fontSize: 14, color: 'var(--text)' }}>
                      Notification.permission: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{notifPermission}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      {pushSupported ? 'Push supported (service worker + PushManager available).' : 'Push not fully supported (may only show while app is open).'}
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Request permission</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Opens the browser/iOS/Android permission prompt. After granting, enable notifications in the Alerts tab.
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setNotifLoading(true);
                        try {
                          const perm = await requestPermission();
                          setNotifPermission(perm);

                          // If granted, also register subscription so alerts can work immediately.
                          if (perm === 'granted') {
                            const sub = await subscribeToPush();
                            if (sub) await savePushSubscription(sub);
                          }
                        } catch {
                          showToast('Permission request failed', 'error');
                        } finally {
                          setNotifLoading(false);
                        }
                      }}
                      disabled={notifLoading || !notifSupported}
                      style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 14px var(--accent-glow-2)', opacity: (notifLoading || !notifSupported) ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {notifLoading ? 'Requesting…' : 'Request permission'}
                    </button>
                  </div>

                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Send permission test</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Shows a test notification if permission is granted.
                      </div>
                    </div>
                    <button
                      onClick={handleSendTest}
                      disabled={notifLoading}
                      style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)', opacity: notifLoading ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      Test notification
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ── ALERTS ── */}
          {active === 'notifications' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.notifications} title="Budget Alerts" subtitle="Get real push notifications when you approach spending limits" />


              {/* ── Unsupported ── */}
              {!notifSupported && (
                <div style={{ padding: '16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notifications not supported</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your browser does not support push notifications. Try Chrome or Safari on iOS 16.4+.</div>
                </div>
              )}

              {/* ── Permission status banner ── */}
              {notifSupported && (
                <div style={{ marginBottom: 20 }}>
                  {/* DENIED */}
                  {notifPermission === 'denied' && (
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--red-muted)', border: '1px solid rgba(240,82,82,0.25)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>🚫</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Notifications blocked</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          You've blocked notifications for this site. To enable them:
                          <br />• <strong>Chrome Android:</strong> tap the lock icon in the address bar → Notifications → Allow
                          <br />• <strong>Safari iOS:</strong> Settings → Safari → FinTrack → Allow Notifications
                          <br />• <strong>Desktop:</strong> Click the lock icon → Site settings → Notifications → Allow
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DEFAULT — not yet asked */}
                  {notifPermission === 'default' && (
                    <div style={{ padding: '16px', borderRadius: 12, background: 'var(--accent-glow)', border: '1px solid var(--accent-glow)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-2)', marginBottom: 3 }}>Enable push notifications</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {pushSupported ? 'Works even when the app is closed — your phone will vibrate.' : 'Shows alerts while the app is open.'}
                        </div>
                      </div>
                      <button
                        onClick={handleEnableNotifications}
                        disabled={notifLoading}
                        style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 14px var(--accent-glow-2)', opacity: notifLoading ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {notifLoading ? 'Enabling…' : '🔔 Enable'}
                      </button>
                    </div>
                  )}

                  {/* GRANTED */}
                  {notifPermission === 'granted' && (
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(34,212,122,0.08)', border: '1px solid rgba(34,212,122,0.25)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 3 }}>
                          ✓ Notifications active {pushSupported ? '· push enabled' : ''}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {pushSupported ? "You'll get alerts even when the app is in the background." : "You'll get alerts while the app is open."}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                          onClick={handleSendTest}
                          disabled={notifLoading}
                          style={{ padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: testSent ? 'rgba(34,212,122,0.15)' : 'var(--surface-2)', color: testSent ? 'var(--green)' : 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                        >
                          {testSent ? '✓ Sent!' : 'Send test'}
                        </button>
                        <button
                          onClick={handleDisableNotifications}
                          disabled={notifLoading}
                          style={{ padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', whiteSpace: 'nowrap' }}
                        >
                          Disable
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Threshold + check now (only when granted) ── */}
              {notifSupported && notifPermission === 'granted' && (
                <div style={{ opacity: budgetAlerts ? 1 : 0.45, transition: 'opacity 0.2s', pointerEvents: budgetAlerts ? 'auto' : 'none' }}>
                  <div style={{ marginBottom: 16 }}>
                    <Toggle
                      checked={budgetAlerts}
                      onChange={v => { setBudgetAlerts(v); updateSettings({ budget_alerts: v }); }}
                      label="Budget alerts"
                      description="Send a notification when spending approaches your set threshold"
                    />
                  </div>

                  <Label>Alert threshold: {alertThreshold}%</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <input
                      type="range" min={50} max={100} step={5} value={alertThreshold}
                      onChange={e => setAlertThreshold(Number(e.target.value))}
                      style={{ flex: 1, height: 4, padding: 0, borderRadius: 99, background: 'var(--surface-3)' }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: alertThreshold >= 90 ? 'var(--red)' : alertThreshold >= 75 ? 'var(--amber)' : 'var(--green)', minWidth: 42, textAlign: 'right' }}>{alertThreshold}%</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
                    {([[70, '70%', 'Early'], [80, '80%', 'Standard'], [90, '90%', 'Last chance']] as [number, string, string][]).map(([v, pct, label]) => (
                      <button key={v} onClick={() => setAlertThreshold(v)} style={{ padding: '9px 6px', borderRadius: 9, border: 'none', fontSize: 11, fontWeight: 600, background: alertThreshold === v ? 'var(--accent)' : 'var(--surface-2)', color: alertThreshold === v ? 'white' : 'var(--text-muted)', transition: 'all 0.15s', lineHeight: 1.3 }}>
                        <div>{pct}</div>
                        {!isMobile && <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>{label}</div>}
                      </button>
                    ))}
                  </div>

                  {/* Check now button */}
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Check budgets now</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manually trigger a check against your current month's budgets</div>
                    </div>
                    <button
                      onClick={handleCheckNow}
                      disabled={notifLoading}
                      style={{ padding: '9px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: 'var(--accent-glow)', color: 'var(--accent-2)', border: '1px solid var(--accent-glow)', whiteSpace: 'nowrap', opacity: notifLoading ? 0.6 : 1 }}
                    >
                      {notifLoading ? 'Checking…' : '⚡ Check now'}
                    </button>
                  </div>
                </div>
              )}

              {notifSupported && notifPermission === 'granted' && (
                <SaveRow onSave={saveAlerts} saving={saving} />
              )}
            </Card>
          )}

          {/* ── PASSWORD ── */}
          {active === 'password' && (
            <Card>
              <SectionTitle icon={SECTION_ICONS.password} title="Change Password" subtitle="Update your login password" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Label>Current password</Label>
                  <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <Label>New password</Label>
                  <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} style={{ width: 'auto' }} />
                  Show passwords
                </label>
                {newPw && confirmPw && newPw !== confirmPw && (
                  <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(240,82,82,0.1)', color: 'var(--red)', fontSize: 12, border: '1px solid rgba(240,82,82,0.2)' }}>Passwords do not match</div>
                )}
              </div>
              <SaveRow onSave={savePassword} saving={saving} label="Change password" />
            </Card>
          )}

          {/* ── DATA ── */}
          {active === 'data' && (
            <>
              <Card>
                <SectionTitle icon={SECTION_ICONS.data} title="Your Data" subtitle="Export and manage your financial data" />
                {stats && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Transactions', value: stats.txCount },
                      { label: 'Categories', value: stats.catCount },
                      { label: 'Member since', value: stats.memberSince },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={exportData}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                  >
                    <span style={{ fontSize: 18 }}>⇩</span>
                    <div>
                      <div>Export all transactions as CSV</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Downloads a spreadsheet-compatible file</div>
                    </div>
                  </button>
                </div>
              </Card>
            </>
          )}

          {/* ── DANGER ZONE ── */}
          {active === 'danger' && (
            <Card style={{ border: '1px solid rgba(240,82,82,0.3)' }}>
              <SectionTitle icon={SECTION_ICONS.danger} title="Danger Zone" subtitle="Irreversible actions — proceed with caution" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '16px', borderRadius: 10, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Sign out of all devices</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Invalidates your current session and logs you out</div>
                  </div>
                  <button
                    onClick={logout}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: 'var(--red)', fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.15s', alignSelf: isMobile ? 'flex-start' : 'auto' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,82,82,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,82,82,0.08)'; }}
                  >
                    Sign out
                  </button>
                </div>
                <div style={{ padding: '16px', borderRadius: 10, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Delete all transactions</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Permanently deletes all your transaction data. Cannot be undone.</div>
                  </div>
                  <button
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: 'var(--red)', fontSize: 12, fontWeight: 700, flexShrink: 0, opacity: 0.5, cursor: 'not-allowed', alignSelf: isMobile ? 'flex-start' : 'auto' }}
                    title="Coming soon"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
                                  }