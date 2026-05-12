'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { showToast } from '@/components/Toast';
import { CURRENCIES, UserSettings } from '@/lib/currencies';

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid rgba(91,110,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, ...style }}>
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
        style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)', opacity: saving ? 0.6 : 1, transition: 'all 0.18s ease', letterSpacing: '-0.01em' }}
      >
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

const SECTIONS = [
  { id: 'profile',      label: 'Profile',      icon: '◉' },
  { id: 'currency',     label: 'Currency',     icon: '◎' },
  { id: 'payday',       label: 'Payday',       icon: '◈' },
  { id: 'appearance',   label: 'Appearance',   icon: '◐' },
  { id: 'display',      label: 'Display',      icon: '⊞' },
  { id: 'notifications',label: 'Alerts',       icon: '◎' },
  { id: 'password',     label: 'Password',     icon: '⊙' },
  { id: 'data',         label: 'Data',         icon: '⇅' },
  { id: 'danger',       label: 'Danger Zone',  icon: '⚠' },
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

  // Payday
  const [payday, setPayday] = useState(25);

  // Appearance
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [weekStart, setWeekStart] = useState('monday');
  const [defaultView, setDefaultView] = useState('overview');

  // Alerts
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState(80);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ txCount: number; catCount: number; memberSince: string } | null>(null);

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
      await updateSettings({ currency, locale: chosen?.locale || 'id-ID', show_decimals: showDecimals, compact_numbers: compactNumbers });
      showToast('Currency settings saved');
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
      await updateSettings({ enable_animations: enableAnimations, date_format: dateFormat, week_start: weekStart, default_view: defaultView });
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
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage your account, preferences, and data</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Side nav */}
        <div className="animate-fadeUp" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 32 }}>
          {/* User mini card */}
          <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white' }}>{initials}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 148 }}>{user?.email}</div>
            </div>
          </div>

          {/* Nav items */}
          <div style={{ padding: '8px 8px' }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
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
                <span style={{ fontSize: 13, opacity: 0.8 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="animate-fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── PROFILE ── */}
          {active === 'profile' && (
            <Card>
              <SectionTitle icon="◉" title="Profile" subtitle="Update your personal information" />
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
              <SectionTitle icon="◎" title="Currency & Formatting" subtitle="Choose your currency and how numbers are displayed" />

              {/* Current selection preview */}
              {selectedCurrency && (
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid rgba(91,110,245,0.2)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 380, overflowY: 'auto', marginBottom: 20, paddingRight: 4 }}>
                {filteredCurrencies.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, border: 'none', textAlign: 'left',
                      background: currency === c.code ? 'var(--accent-glow)' : 'var(--surface-2)',
                      outline: currency === c.code ? '1px solid rgba(91,110,245,0.4)' : '1px solid var(--border)',
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
                </div>
              </div>

              <SaveRow onSave={saveCurrency} saving={saving} />
            </Card>
          )}

          {/* ── PAYDAY ── */}
          {active === 'payday' && (
            <Card>
              <SectionTitle icon="◈" title="Payday & Budget Cycle" subtitle="Set when you get paid — used for the payday survival budget" />
              <div style={{ marginBottom: 24 }}>
                <Label>Day of month you get paid</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <button
                      key={d}
                      onClick={() => setPayday(d)}
                      style={{
                        padding: '10px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
                        background: payday === d ? 'var(--accent)' : 'var(--surface-2)',
                        color: payday === d ? 'white' : 'var(--text-muted)',
                        boxShadow: payday === d ? '0 4px 16px rgba(91,110,245,0.3)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { if (payday !== d) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { if (payday !== d) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
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
              <SectionTitle icon="◐" title="Appearance" subtitle="Customize how the app looks and behaves" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              <SectionTitle icon="⊞" title="Display Preferences" subtitle="Control what's visible throughout the app" />
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

          {/* ── ALERTS ── */}
          {active === 'notifications' && (
            <Card>
              <SectionTitle icon="◎" title="Budget Alerts" subtitle="Get notified when you approach spending limits" />
              <div>
                <Toggle
                  checked={budgetAlerts}
                  onChange={setBudgetAlerts}
                  label="Budget alerts"
                  description="Show warnings when spending approaches your budget limits"
                />
              </div>
              <div style={{ marginTop: 20, opacity: budgetAlerts ? 1 : 0.4, transition: 'opacity 0.2s', pointerEvents: budgetAlerts ? 'auto' : 'none' }}>
                <Label>Alert threshold: {alertThreshold}%</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <input
                    type="range" min={50} max={100} step={5} value={alertThreshold}
                    onChange={e => setAlertThreshold(Number(e.target.value))}
                    style={{ flex: 1, height: 4, padding: 0, borderRadius: 99, background: 'var(--surface-3)' }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: alertThreshold >= 90 ? 'var(--red)' : alertThreshold >= 75 ? 'var(--amber)' : 'var(--green)', minWidth: 42, textAlign: 'right' }}>{alertThreshold}%</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[[70,'70% — Early warning'], [80,'80% — Standard'], [90,'90% — Last chance']].map(([v, l]) => (
                    <button key={v} onClick={() => setAlertThreshold(Number(v))} style={{ padding: '8px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 600, background: alertThreshold === Number(v) ? 'var(--accent)' : 'var(--surface-2)', color: alertThreshold === Number(v) ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>{l}</button>
                  ))}
                </div>
              </div>
              <SaveRow onSave={saveAlerts} saving={saving} />
            </Card>
          )}

          {/* ── PASSWORD ── */}
          {active === 'password' && (
            <Card>
              <SectionTitle icon="⊙" title="Change Password" subtitle="Update your login password" />
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
                <SectionTitle icon="⇅" title="Your Data" subtitle="Export and manage your financial data" />
                {stats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
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
              <SectionTitle icon="⚠" title="Danger Zone" subtitle="Irreversible actions — proceed with caution" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '16px', borderRadius: 10, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Sign out of all devices</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Invalidates your current session and logs you out</div>
                  </div>
                  <button
                    onClick={logout}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: 'var(--red)', fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,82,82,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,82,82,0.08)'; }}
                  >
                    Sign out
                  </button>
                </div>
                <div style={{ padding: '16px', borderRadius: 10, border: '1px solid rgba(240,82,82,0.2)', background: 'rgba(240,82,82,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Delete all transactions</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Permanently deletes all your transaction data. Cannot be undone.</div>
                  </div>
                  <button
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(240,82,82,0.3)', background: 'rgba(240,82,82,0.08)', color: 'var(--red)', fontSize: 12, fontWeight: 700, flexShrink: 0, opacity: 0.5, cursor: 'not-allowed' }}
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