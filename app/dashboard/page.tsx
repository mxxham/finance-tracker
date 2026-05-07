'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { showToast } from '@/components/Toast';
import { AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Stats {
  income: number; expenses: number; savings: number; balance: number;
  byCategory: { name: string; color: string; total: number }[];
  trend: { month: number; year: number; type: string; total: number }[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n/1_000).toFixed(0)}K`;
  return String(n);
}

const STAT_CONFIG = [
  { key: 'income',   label: 'Income',     color: '#22d47a', bg: 'rgba(34,212,122,0.08)',  border: 'rgba(34,212,122,0.15)', icon: '↑' },
  { key: 'expenses', label: 'Expenses',    color: '#f05252', bg: 'rgba(240,82,82,0.08)',   border: 'rgba(240,82,82,0.15)',  icon: '↓' },
  { key: 'savings',  label: 'Savings',     color: '#5b6ef5', bg: 'rgba(91,110,245,0.08)',  border: 'rgba(91,110,245,0.15)', icon: '◈' },
  { key: 'balance',  label: 'Net Balance', color: '#f5a623', bg: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.15)', icon: '◎' },
];

function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}

// Animated number counter
function AnimatedNumber({ value, formatter }: { value: number; formatter: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const [key, setKey] = useState(0);
  const prevVal = useRef(value);

  useEffect(() => {
    if (prevVal.current === value) return;
    const start = prevVal.current;
    const diff = value - start;
    const duration = 700;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + diff * ease));
      if (t < 1) requestAnimationFrame(tick);
      else { setDisplay(value); setKey(k => k + 1); }
    };
    requestAnimationFrame(tick);
    prevVal.current = value;
  }, [value]);

  return (
    <span key={key} className="num-change" style={{ fontFamily: 'var(--font-mono)' }}>
      {formatter(display)}
    </span>
  );
}

// 3D Tilt card hook
function useTiltCard() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg) scale(1.01)`;
    el.style.setProperty('--glow-x', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--glow-y', `${(y + 0.5) * 100}%`);
    el.classList.remove('resetting');
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('resetting');
    el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)';
  };

  return { ref, handleMouseMove, handleMouseLeave };
}

function TiltStatCard({ cfg, val, incomeVal, staggerIdx }: { cfg: typeof STAT_CONFIG[0]; val: number; incomeVal: number; staggerIdx: number }) {
  const { ref, handleMouseMove, handleMouseLeave } = useTiltCard();
  const pct = cfg.key === 'income' ? 100 : incomeVal > 0 ? Math.min(100, Math.max(0, (val / incomeVal) * 100)) : 0;

  return (
    <div
      ref={ref}
      className={`tilt-card animate-fadeUp stagger-${staggerIdx + 1}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden',
      }}
    >
      <div className="tilt-glow" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{cfg.label}</span>
        <span style={{ width: 24, height: 24, borderRadius: 6, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: cfg.color, fontWeight: 700 }}>{cfg.icon}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: cfg.color, lineHeight: 1 }}>
        <AnimatedNumber value={val ?? 0} formatter={fmt} />
      </div>
      <div style={{ marginTop: 14, height: 3, borderRadius: 99, background: cfg.bg }}>
        <div
          className="bar-animated"
          style={{ height: '100%', borderRadius: 99, background: cfg.color, width: `${pct}%` }}
        />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{pct.toFixed(0)}% of income</div>
    </div>
  );
}

const MODAL_OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};
const MODAL_BOX: React.CSSProperties = {
  width: '100%', maxWidth: 440, borderRadius: 20,
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column', gap: 16,
};

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTx, setRecentTx] = useState<{ id: number; description: string; amount: number; type: string; date: string; category_name: string; category_color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [modalExiting, setModalExiting] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string; color: string; type: string }[]>([]);
  const [form, setForm] = useState({ amount: '', type: 'expense', description: '', date: now.toISOString().split('T')[0], category_id: '' });
  const [saving, setSaving] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  const load = useCallback(async () => {
    setError(null); setLoading(true);
    try {
      const [s, tx] = await Promise.all([
        api.getStats({ month: String(month), year: String(year) }),
        api.getTransactions({ month: String(month), year: String(year), limit: '8' }),
      ]);
      setStats(s); setRecentTx(tx);
      setChartKey(k => k + 1); // re-trigger chart animations
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const closeModal = () => {
    setModalExiting(true);
    setTimeout(() => { setShowQuickAdd(false); setModalExiting(false); }, 200);
  };

  const openQuickAdd = async () => {
    if (!categories.length) { const c = await api.getCategories().catch(() => []); setCategories(c); }
    setForm({ amount: '', type: 'expense', description: '', date: now.toISOString().split('T')[0], category_id: '' });
    setShowQuickAdd(true);
  };

  const handleQuickSave = async () => {
    if (!form.amount) { showToast('Enter an amount', 'error'); return; }
    setSaving(true);
    try {
      await api.createTransaction({ amount: Number(form.amount), type: form.type, description: form.description, date: form.date, category_id: form.category_id ? Number(form.category_id) : null });
      showToast('Transaction added');
      closeModal();
      load();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const addRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple-dot';
    dot.style.left = `${e.clientX - rect.left - 5}px`;
    dot.style.top  = `${e.clientY - rect.top  - 5}px`;
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  };

  const trendData = (() => {
    if (!stats) return [];
    const map: Record<string, { month: string; income: number; expenses: number }> = {};
    for (const row of stats.trend) {
      const key = `${row.year}-${String(row.month).padStart(2,'0')}`;
      if (!map[key]) map[key] = { month: MONTHS[Number(row.month)-1], income: 0, expenses: 0 };
      if (row.type === 'income') map[key].income = Number(row.total);
      else map[key].expenses = Number(row.total);
    }
    return Object.values(map);
  })();

  const categoryData = stats?.byCategory
    ? [...stats.byCategory].map(c => ({ ...c, total: Number(c.total), name: translateCategory(c.name) })).sort((a,b) => b.total - a.total).slice(0,6)
    : [];

  const incomeVal = stats?.income ?? 0;
  const filteredCats = categories.filter(c => c.type === form.type);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const savingsRate = incomeVal > 0 && stats ? Math.round((stats.savings / incomeVal) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div className="animate-fadeUp" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>
            {MONTHS[month-1]} {year}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>
            Financial overview
            {stats && savingsRate > 0 && <span style={{ marginLeft: 8, color: savingsRate >= 20 ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>· {savingsRate}% saved</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 100, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 84, fontSize: 13 }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={(e) => { addRipple(e); openQuickAdd(); }}
            className="btn-ripple"
            style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'var(--accent)', color: 'white', border: 'none',
              boxShadow: '0 4px 16px rgba(91,110,245,0.3)', letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(91,110,245,0.45)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(91,110,245,0.3)'}
          >+ Quick Add</button>
        </div>
      </div>

      {error && (
        <div className="animate-fadeDown" style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--red-muted)', border: '1px solid rgba(240,82,82,0.25)', color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={load} style={{ background: 'rgba(240,82,82,0.15)', border: 'none', color: 'var(--red)', padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* Stat Cards — staggered with 3D tilt */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {loading ? STAT_CONFIG.map((s, i) => (
          <div key={s.key} className={`animate-fadeUp stagger-${i+1}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <Skeleton w={64} h={10} /><div style={{ marginTop: 14 }}><Skeleton w={100} h={20} /></div>
            <div style={{ marginTop: 12 }}><Skeleton h={4} /></div>
          </div>
        )) : STAT_CONFIG.map((cfg, i) => (
          <TiltStatCard
            key={`${cfg.key}-${month}-${year}`}
            cfg={cfg}
            val={stats ? (stats as unknown as Record<string, number>)[cfg.key] : 0}
            incomeVal={incomeVal}
            staggerIdx={i}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
        {/* Trend Chart */}
        <div className="scroll-reveal animate-fadeUp stagger-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Income vs Expenses</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Last 6 months trend</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 2, background: '#22d47a', display: 'inline-block', borderRadius: 2 }} />Income</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 2, background: '#f05252', display: 'inline-block', borderRadius: 2 }} />Expenses</span>
            </div>
          </div>
          {loading ? <Skeleton h={180} /> : (
            <ResponsiveContainer key={chartKey} width="100%" height={180}>
              <AreaChart data={trendData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d47a" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22d47a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f05252" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#f05252" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => fmtShort(v)} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}
                  formatter={(v) => fmt(Number(v))}
                />
                <Area type="monotone" dataKey="income" stroke="#22d47a" strokeWidth={2} fill="url(#gI)" name="Income" dot={false}
                  isAnimationActive={true} animationDuration={900} animationEasing="ease-out" />
                <Area type="monotone" dataKey="expenses" stroke="#f05252" strokeWidth={2} fill="url(#gE)" name="Expenses" dot={false}
                  isAnimationActive={true} animationDuration={900} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Spending by Category */}
        <div className="scroll-reveal animate-fadeUp stagger-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>By Category</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Spending breakdown</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton h={140} r={10} />
              {[1,2,3].map(i => <Skeleton key={i} h={14} />)}
            </div>
          ) : categoryData.length ? (
            <>
              <ResponsiveContainer key={chartKey} width="100%" height={140}>
                <PieChart>
                  <Pie data={categoryData} dataKey="total" nameKey="name" cx="50%" cy="50%"
                    innerRadius={38} outerRadius={62} paddingAngle={3} startAngle={90} endAngle={-270}
                    isAnimationActive={true} animationDuration={800} animationEasing="ease-out">
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.color || '#5b6ef5'} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                {categoryData.slice(0,5).map((c, i) => (
                  <div key={i} className={`animate-slideInLeft stagger-${i+1}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color || '#5b6ef5', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{c.name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11, color: 'var(--text)' }}>{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 8 }}>
              <div style={{ fontSize: 32, opacity: 0.15 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No spending data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Recent Transactions</div>
          <a href="/dashboard/transactions" style={{ fontSize: 12, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 500, transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >View all →</a>
        </div>
        {loading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
                <Skeleton w={36} h={36} r={10} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton w={160} h={11} />
                  <Skeleton w={100} h={9} />
                </div>
                <Skeleton w={80} h={12} />
              </div>
            ))}
          </div>
        ) : recentTx.length === 0 ? (
          <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px' }}>
            <div style={{ fontSize: 36, opacity: 0.12 }}>⇅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)' }}>No transactions this month</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add your first transaction to get started</p>
            <button onClick={openQuickAdd} className="btn-ripple" style={{ marginTop: 4, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none' }}>
              + Add Transaction
            </button>
          </div>
        ) : recentTx.map((tx, idx) => (
          <div
            key={tx.id}
            className={`animate-slideInLeft stagger-${Math.min(idx + 1, 8)}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 24px',
              borderBottom: idx < recentTx.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.14s ease, transform 0.14s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
              (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `${tx.category_color}22`,
              border: `1px solid ${tx.category_color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: tx.category_color || 'var(--accent)',
              transition: 'transform 0.15s ease',
            }}>
              {translateCategory(tx.category_name)?.[0] || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'No description'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {translateCategory(tx.category_name)} · {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
              {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div
          className="modal-overlay"
          style={MODAL_OVERLAY}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className={modalExiting ? 'modal-box-exit' : 'modal-box-enter'} style={MODAL_BOX}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>Quick Add</h2>
              <button onClick={closeModal} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: '4px 8px', borderRadius: 7, transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
              >×</button>
            </div>

            {/* Type toggle with animated pill */}
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 4, bottom: 4,
                width: 'calc(50% - 4px)',
                left: form.type === 'expense' ? 4 : 'calc(50%)',
                borderRadius: 7,
                background: form.type === 'income' ? 'var(--green)' : 'var(--red)',
                transition: 'left 0.28s cubic-bezier(0.34,1.1,0.64,1), background 0.22s ease',
                pointerEvents: 'none',
              }} />
              {['expense','income'].map(t => (
                <button key={t} onClick={() => setForm(f => ({...f, type: t}))} style={{
                  flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'transparent',
                  color: form.type === t ? 'white' : 'var(--text-muted)',
                  border: 'none', textTransform: 'capitalize', position: 'relative', zIndex: 1,
                  transition: 'color 0.2s ease',
                }}>{t}</button>
              ))}
            </div>

            <div className="animate-fadeIn stagger-1">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Amount</label>
              <input type="number" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="0" autoFocus />
            </div>
            <div className="animate-fadeIn stagger-2">
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="What was this for?" />
            </div>
            <div className="animate-fadeIn stagger-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Category</label>
                <select value={form.category_id} onChange={e => setForm(f=>({...f,category_id:e.target.value}))}>
                  <option value="">None</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
              </div>
            </div>
            <div className="animate-fadeIn stagger-4" style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
              >Cancel</button>
              <button onClick={handleQuickSave} disabled={saving} className="btn-ripple" onMouseDown={addRipple} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)', opacity: saving ? 0.6 : 1, transition: 'all 0.18s ease' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}