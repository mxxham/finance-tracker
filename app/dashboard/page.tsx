'use client';
import OnboardingFlow from '@/components/OnboardingFlow';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { showToast } from '@/components/Toast';
import { AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useSettings } from '@/lib/SettingsContext';
import { BalanceCard } from '@/components/BalanceCard';

interface Stats {
  income: number;
  expenses: number;
  savings: number;
  balance: number;
  byCategory: { name: string; color: string; total: number }[];
  trend: { month: number; year: number; type: string; total: number }[];
}
interface Budget {
  id: number;
  amount: number;
  spent: number;
  category_id: number;
  category_name: string;
  category_color: string;
}
interface SavingsGoal {
  id: number;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ────────────────────────────────────────────────────────────────
function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}

function AnimatedNumber({ value, formatter }: { value: number; formatter: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prevVal = useRef(value);
  useEffect(() => {
    if (prevVal.current === value) return;
    const start = prevVal.current;
    const diff = value - start;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / 700);
      setDisplay(Math.round(start + diff * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };

    requestAnimationFrame(tick);
    prevVal.current = value;
  }, [value]);

  return <span style={{ fontFamily: 'var(--font-mono)' }}>{formatter(display)}</span>;
}

function useTiltCard() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

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

const STAT_CONFIG = [
  {
    key: 'income',
    label: 'Income',
    color: '#22d47a',
    bg: 'rgba(34,212,122,0.08)',
    border: 'rgba(34,212,122,0.15)',
    icon: '↑',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    color: '#f05252',
    bg: 'rgba(240,82,82,0.08)',
    border: 'rgba(240,82,82,0.15)',
    icon: '↓',
  },
  {
    key: 'savings',
    label: 'Saved',
    color: 'var(--accent)',
    bg: 'var(--accent-glow)',
    border: 'var(--accent-glow-2)',
    icon: '◈',
  },
  {
    key: 'monthlyNet',
    label: 'Monthly Net',
    color: '#f5a623',
    bg: 'rgba(245,166,35,0.08)',
    border: 'rgba(245,166,35,0.15)',
    icon: '◎',
  },
] as const;

function TiltStatCard({
  cfg,
  val,
  incomeVal,
  staggerIdx,
  fmt,
}: {
  cfg: (typeof STAT_CONFIG)[number];
  val: number;
  incomeVal: number;
  staggerIdx: number;
  fmt: (n: number) => string;
}) {
  const { ref, handleMouseMove, handleMouseLeave } = useTiltCard();

  const pct =
    cfg.key === 'income'
      ? 100
      : incomeVal > 0
        ? Math.min(100, Math.max(0, (Math.abs(val) / incomeVal) * 100))
        : 0;

  return (
    <div
      ref={ref}
      className={`tilt-card animate-fadeUp stagger-${staggerIdx + 1}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="tilt-glow" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: cfg.color,
            fontWeight: 700,
          }}
        >
          {cfg.icon}
        </span>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: cfg.key === 'monthlyNet' ? (val >= 0 ? cfg.color : '#f05252') : cfg.color,
          lineHeight: 1,
        }}
      >
        <AnimatedNumber value={val ?? 0} formatter={fmt} />
      </div>
      <div style={{ marginTop: 12, height: 3, borderRadius: 99, background: cfg.bg }}>
        <div className="bar-animated" style={{ height: '100%', borderRadius: 99, background: cfg.color, width: `${pct}%` }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>{pct.toFixed(0)}% of income</div>
    </div>
  );
  </>
  );
}

// ── Budget Mini Overview ───────────────────────────────────────────────────
function BudgetOverviewStrip({ budgets, fmt }: { budgets: Budget[]; fmt: (n: number) => string }) {
  if (budgets.length === 0)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--surface-2)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        No budgets set for this month.
        <a href="/dashboard/budgets" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Set budgets →
        </a>
      </div>
    );

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const overallPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  const overCount = budgets.filter((b) => Number(b.spent) > Number(b.amount)).length;
  const warnCount = budgets.filter((b) => {
    const p = (Number(b.spent) / Number(b.amount)) * 100;
    return p >= 80 && p < 100;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
            <span>
              {fmt(totalSpent)} spent of {fmt(totalBudget)}
            </span>
            <span
              style={{
                fontWeight: 700,
                color: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)',
              }}
            >
              {overallPct.toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                borderRadius: 99,
                width: `${overallPct}%`,
                background: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)',
                transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)',
                boxShadow: `0 0 6px ${overallPct >= 80 ? 'rgba(240,82,82,0.4)' : 'rgba(34,212,122,0.3)'}`,
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {overCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', background: 'rgba(240,82,82,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              🚨 {overCount} over
            </span>
          )}
          {warnCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', background: 'rgba(245,166,35,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              ⚠ {warnCount} near limit
            </span>
          )}
          {overCount === 0 && warnCount === 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', background: 'rgba(34,212,122,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              ✓ All on track
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
        {budgets.slice(0, 4).map((b) => {
          const pct = Number(b.amount) > 0 ? Math.min((Number(b.spent) / Number(b.amount)) * 100, 100) : 0;
          const over = Number(b.spent) > Number(b.amount);
          const warn = !over && pct >= 80;

          return (
            <div
              key={b.id}
              style={{
                padding: '8px 10px',
                background: 'var(--surface-2)',
                borderRadius: 9,
                border: `1px solid ${over ? 'rgba(240,82,82,0.2)' : 'var(--border)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.category_color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                    {translateCategory(b.category_name)}
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: over ? 'var(--red)' : warn ? 'var(--amber)' : b.category_color, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {budgets.length > 4 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
          +{budgets.length - 4} more categories ·{' '}
          <a href="/dashboard/budgets" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            View all →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Savings Mini Overview ────────────────────────────────────────────────
function SavingsOverviewStrip({ goals, fmt }: { goals: SavingsGoal[]; fmt: (n: number) => string }) {
  const active = goals.filter((g) => g.status === 'active');

  if (goals.length === 0)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'center',
          padding: '12px 16px',
          background: 'var(--surface-2)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        No savings goals yet.
        <a href="/dashboard/savings" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          Create a goal →
        </a>
      </div>
    );

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const overallPct = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  const daysUntil = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
            <span>
              {fmt(totalSaved)} saved of {fmt(totalTarget)}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{overallPct.toFixed(0)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                borderRadius: 99,
                width: `${overallPct}%`,
                background: 'var(--accent)',
                transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)',
                boxShadow: '0 0 6px var(--accent-glow-2)',
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
          {active.length} active · {goals.filter((g) => g.status === 'completed').length} done
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {active.slice(0, 3).map((g) => {
          const pct = Number(g.target_amount) > 0 ? Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100) : 0;
          const days = g.deadline ? daysUntil(g.deadline) : null;

          return (
            <div
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 10,
                border: `1px solid ${g.color}25`,
                flex: '1 1 160px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: g.color + '20',
                  border: `1.5px solid ${g.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {g.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                  {g.name}
                </div>
                <div style={{ height: 3, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden', marginBottom: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: g.color, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {pct.toFixed(0)}%{days !== null ? ` · ${days}d left` : ''}
                </div>
              </div>
            </div>
          );
        })}

        {active.length > 3 && (
          <a
            href="/dashboard/savings"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              background: 'var(--surface-2)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            +{active.length - 3} more
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const MODAL_OVERLAY: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(6px)',
};

export default function DashboardPage() {
  const { fmt, fmtShort } = useSettings();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTx, setRecentTx] = useState<
    { id: number; description: string; amount: number; type: string; date: string; category_name: string; category_color: string }[]
  >([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userName, setUserName] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [modalExiting, setModalExiting] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string; color: string; type: string }[]>([]);
  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'expense' | 'income',
    description: '',
    date: now.toISOString().split('T')[0],
    category_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  const closeModal = () => {
    setModalExiting(true);
    setTimeout(() => {
      setShowQuickAdd(false);
      setModalExiting(false);
    }, 200);
  };

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const [s, tx, b, g] = await Promise.all([
        api.getStats({ month: String(month), year: String(year) }),
        api.getTransactions({ month: String(month), year: String(year), limit: '8' }),
        api.getBudgets({ month: String(month), year: String(year) }).catch(() => []),
        api.getSavingsGoals().catch(() => []),
      ]);

      setStats(s);
      setRecentTx(tx);
      setBudgets(Array.isArray(b) ? b : []);
      setSavingsGoals(Array.isArray(g) ? g : []);
      setChartKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const openQuickAdd = async () => {
    if (!categories.length) {
      const c = await api.getCategories().catch(() => []);
      setCategories(c);
    }

    setForm({
      amount: '',
      type: 'expense',
      description: '',
      date: now.toISOString().split('T')[0],
      category_id: '',
    });

    setShowQuickAdd(true);
  };

  const handleQuickSave = async () => {
    if (!form.amount) {
      showToast('Enter an amount', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.createTransaction({
        amount: Number(form.amount),
        type: form.type,
        description: form.description,
        date: form.date,
        category_id: form.category_id ? Number(form.category_id) : null,
      });

      showToast('Transaction added');
      closeModal();
      load();
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();

    const dot = document.createElement('span');
    dot.className = 'ripple-dot';
    dot.style.left = `${e.clientX - rect.left - 5}px`;
    dot.style.top = `${e.clientY - rect.top - 5}px`;

    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  };

  // Derived values
  const incomeVal = stats?.income ?? 0;
  const monthlyNet = (stats?.income ?? 0) - (stats?.expenses ?? 0);
  const allTimeBalance = stats?.balance ?? 0;

  const totalSavedInGoals = savingsGoals.reduce((s, g) => s + Number(g.current_amount), 0);
  const availableBalance = allTimeBalance - totalSavedInGoals;

  const savingsRate = incomeVal > 0 && stats ? Math.round((stats.savings / incomeVal) * 100) : 0;

  const statValues: Record<string, number> = {
    income: stats?.income ?? 0,
    expenses: stats?.expenses ?? 0,
    savings: stats?.savings ?? 0,
    monthlyNet,
  };

  const filteredCats = categories.filter((c) => c.type === form.type);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const trendData = (() => {
    if (!stats) return [];

    const map: Record<string, { month: string; income: number; expenses: number }> = {};

    for (const row of stats.trend) {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!map[key]) map[key] = { month: MONTHS[Number(row.month) - 1], income: 0, expenses: 0 };
      if (row.type === 'income') map[key].income = Number(row.total);
      else map[key].expenses = Number(row.total);
    }

    return Object.values(map);
  })();

  const categoryData = stats?.byCategory
    ? [...stats.byCategory]
        .map((c) => ({ ...c, total: Number(c.total), name: translateCategory(c.name) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
    : [];

  return (
    <>
    {showOnboarding && (
      <OnboardingFlow
        userName={userName}
        onComplete={() => { setShowOnboarding(false); void load(); }}
      />
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Header ── */}
      <div
        className="animate-fadeUp"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>
            {MONTHS[month - 1]} {year}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>
            Financial overview
            {stats && savingsRate > 0 && (
              <span style={{ marginLeft: 8, color: savingsRate >= 20 ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
                · {savingsRate}% saved
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 90, fontSize: 13 }}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 78, fontSize: 13 }}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={(e) => {
              addRipple(e);
              openQuickAdd();
            }}
            className="btn-ripple"
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 16px var(--accent-glow-2)',
              whiteSpace: 'nowrap',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--red-muted)',
            border: '1px solid rgba(240,82,82,0.25)',
            color: 'var(--red)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <button
            onClick={load}
            style={{ background: 'rgba(240,82,82,0.15)', border: 'none', color: 'var(--red)', padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Hero Balance Card ── */}
      <BalanceCard
        balance={stats ? Number(stats.balance) : null}
        balanceLabel="Available Balance"
        balanceSub="All-time income minus expenses"
        loading={loading}
        fmt={fmt}
        variant="full"
        chips={[
          { label: 'Income', value: stats ? '+' + fmt(stats.income) : '—', valueColor: '#4ade80', sub: 'this month' },
          { label: 'Expenses', value: stats ? '−' + fmt(stats.expenses) : '—', valueColor: '#f87171', sub: 'this month' },
          { label: 'Saved', value: stats ? fmt(stats.savings) : '—', sub: 'this month' },
          { label: 'Monthly Net', value: stats ? fmt(stats.income - stats.expenses) : '—', valueColor: stats && (stats.income - stats.expenses) >= 0 ? '#4ade80' : '#f87171', sub: 'income − expenses' },
        ]}
      />

      {/* ── Available Balance Strip ── */}
      {!loading && stats && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', flexWrap: 'wrap' }}>
          <div style={{ padding: '10px 16px', flex: 1, borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: monthlyNet >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>This month {monthlyNet >= 0 ? 'surplus' : 'deficit'}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: monthlyNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(Math.abs(monthlyNet))}</span>
          </div>

          {totalSavedInGoals > 0 && (
            <div style={{ padding: '10px 16px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>In goals</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{fmt(totalSavedInGoals)}</span>
            </div>
          )}

          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Available</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: availableBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(availableBalance)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>all-time{totalSavedInGoals > 0 ? ' − goals' : ''}</span>
          </div>
        </div>
      )}

      {/* ── Desktop two-column / Mobile stacked layout ── */}
      <div className="overview-desktop-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="scroll-reveal animate-fadeUp stagger-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Income vs Expenses</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Last 6 months trend</div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 2, background: '#22d47a', display: 'inline-block', borderRadius: 2 }} />Income
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 2, background: '#f05252', display: 'inline-block', borderRadius: 2 }} />Expenses
                </span>
              </div>
            </div>

            {loading ? (
              <Skeleton h={200} />
            ) : (
              <ResponsiveContainer key={chartKey} width="100%" height={200}>
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
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}
                    formatter={(v) => fmt(Number(v))}
                  />
                  <Area type="monotone" dataKey="income" stroke="#22d47a" strokeWidth={2} fill="url(#gI)" name="Income" dot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                  <Area type="monotone" dataKey="expenses" stroke="#f05252" strokeWidth={2} fill="url(#gE)" name="Expenses" dot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Recent Transactions</div>
              <a href="/dashboard/transactions" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                View all →
              </a>
            </div>

            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                  <Skeleton w={36} h={36} r={10} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton w={160} h={11} />
                    <Skeleton w={100} h={9} />
                  </div>
                  <Skeleton w={70} h={12} />
                </div>
              ))
            ) : recentTx.length === 0 ? (
              <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 18px' }}>
                <div style={{ fontSize: 36, opacity: 0.12 }}>⇅</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)' }}>No transactions this month</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add your first transaction to get started</p>
                <button onClick={openQuickAdd} className="btn-ripple" style={{ marginTop: 4, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none' }}>
                  + Add Transaction
                </button>
              </div>
            ) : (
              recentTx.map((tx, idx) => (
                <div
                  key={tx.id}
                  className={`animate-slideInLeft stagger-${Math.min(idx + 1, 8)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 18px',
                    borderBottom: idx < recentTx.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.14s ease',
                  }}
                  onMouseEnter={(e) => (((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'))}
                  onMouseLeave={(e) => (((e.currentTarget as HTMLElement).style.background = 'transparent'))}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${tx.category_color}22`, border: `1px solid ${tx.category_color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: tx.category_color || 'var(--accent)' }}>
                    {translateCategory(tx.category_name)?.[0] || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'No description'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {translateCategory(tx.category_name)} · {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                    {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="scroll-reveal animate-fadeUp stagger-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 18px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>By Category</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Spending breakdown</div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton h={130} r={10} />
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} h={14} />
                ))}
              </div>
            ) : categoryData.length ? (
              <>
                <ResponsiveContainer key={chartKey} width="100%" height={130}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={56}
                      paddingAngle={3}
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color || '#5b6ef5'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                  {categoryData.slice(0, 5).map((c, i) => (
                    <div key={i} className={`animate-slideInLeft stagger-${i + 1}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color || '#5b6ef5', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{c.name}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11, color: 'var(--text)' }}>{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 130, gap: 8 }}>
                <div style={{ fontSize: 28, opacity: 0.15 }}>◎</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No spending data yet</p>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 2 }}>Budgets</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Spending limits this month</div>
              </div>
              <a href="/dashboard/budgets" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, opacity: 0.8 }}>
                Details →
              </a>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton h={6} r={99} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} h={48} r={9} />
                  ))}
                </div>
              </div>
            ) : (
              <BudgetOverviewStrip budgets={budgets} fmt={fmt} />
            )}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 2 }}>Savings Goals</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Progress across all goals</div>
              </div>
              <a href="/dashboard/savings" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, opacity: 0.8 }}>
                Details →
              </a>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton h={6} r={99} />
                <div style={{ display: 'flex', gap: 8 }}>{[1, 2].map((i) => <Skeleton key={i} h={52} r={10} />)}</div>
              </div>
            ) : (
              <SavingsOverviewStrip goals={savingsGoals} fmt={fmt} />
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Add Modal ── */}
      {showQuickAdd && (
        <div
          className="modal-overlay"
          style={MODAL_OVERLAY}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className={`modal-box ${modalExiting ? 'modal-box-exit' : 'modal-box-enter'}`}
            style={{
              width: '100%',
              maxWidth: 480,
              borderRadius: '20px 20px 0 0',
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              padding: '20px 20px 32px',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>Quick Add</h2>
              <button onClick={closeModal} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: '4px 8px', borderRadius: 7 }}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  width: 'calc(50% - 4px)',
                  left: form.type === 'expense' ? 4 : 'calc(50%)',
                  borderRadius: 7,
                  background: form.type === 'income' ? 'var(--green)' : 'var(--red)',
                  transition: 'left 0.28s cubic-bezier(0.34,1.1,0.64,1), background 0.22s ease',
                  pointerEvents: 'none',
                }}
              />

              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'transparent',
                    color: form.type === t ? 'white' : 'var(--text-muted)',
                    border: 'none',
                    textTransform: 'capitalize',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'color 0.2s ease',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Amount</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" autoFocus />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What was this for?" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Category</label>
                <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                  <option value="">None</option>
                  {filteredCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {translateCategory(c.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button
                onClick={handleQuickSave}
                disabled={saving}
                className="btn-ripple"
                onMouseDown={addRipple}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 16px var(--accent-glow-2)',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }
