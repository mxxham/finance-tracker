'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { useSettings } from '@/lib/SettingsContext';
import { showToast } from '@/components/Toast';
import { sendTestNotification } from '@/lib/notifications';

interface Budget {
  id: number; amount: number; spent: number;
  category_id: number; category_name: string; category_color: string;
  month: number; year: number;
}
interface Category { id: number; name: string; color: string; type: string; }
interface Transaction {
  id: number; amount: number; category_id: number;
  category_name: string; date: string; type: string;
  description: string; is_recurring?: boolean;
}
interface DailyRow { day: number; type: string; total: number; }
interface TrendRow { month: number; year: number; type: string; total: number; }
interface StatsData {
  income: number; expenses: number;
  trend: TrendRow[];
  daily: DailyRow[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 6,
  letterSpacing: '0.02em', textTransform: 'uppercase',
};

// ── Sub-components ─────────────────────────────────────────────

function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w ?? '100%', height: h, borderRadius: r }} />;
}

function AnimatedBar({ pct, color, delay = 0, height = 8 }: {
  pct: number; color: string; delay?: number; height?: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(pct, 100)), 80 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ height, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 99, width: `${width}%`,
        background: color,
        transition: 'width 0.85s cubic-bezier(0.34,1.05,0.64,1)',
        boxShadow: `0 0 8px ${color}55`,
      }} />
    </div>
  );
}

function HealthDot({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Watch Out' : 'At Risk';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

function DonutChart({ budgets, fmt }: { budgets: Budget[]; fmt: (n: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const size = 180, r = 70;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const overallPct = total > 0 ? Math.min((totalSpent / total) * 100, 100) : 0;

  if (!budgets.length || total === 0) return null;

  let offset = 0;
  const arcs = budgets.map(b => {
    const dash = (Number(b.amount) / total) * circ;
    const arc = { id: b.id, dash, offset, color: b.category_color, name: translateCategory(b.category_name), amount: Number(b.amount), spent: Number(b.spent) };
    offset += dash + 2;
    return arc;
  });

  const hov = hovered !== null ? arcs.find(a => a.id === hovered) : null;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
        {arcs.map(arc => (
          <circle key={arc.id} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color}
            strokeWidth={hovered === arc.id ? 22 : 18}
            strokeDasharray={`${arc.dash - 2} ${circ - (arc.dash - 2)}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-width 0.15s ease, opacity 0.15s ease', opacity: hovered !== null && hovered !== arc.id ? 0.3 : 1, cursor: 'pointer' }}
            onMouseEnter={() => setHovered(arc.id)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <circle cx={cx} cy={cy} r={r - 10} fill="none"
          stroke={overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)'}
          strokeWidth="4"
          strokeDasharray={`${(overallPct / 100) * (2 * Math.PI * (r - 10))} ${2 * Math.PI * (r - 10)}`}
          strokeLinecap="round" opacity="0.5"
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {hov ? (
          <>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, textAlign: 'center', maxWidth: 60 }}>{hov.name}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: hov.color }}>{fmt(hov.spent)}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>of {fmt(hov.amount)}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Spent</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{overallPct.toFixed(0)}%</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmt(totalSpent)}</div>
          </>
        )}
      </div>
    </div>
  );
}

function SpendingTrendChart({ dailyData, totalBudget, daysInMonth, dayOfMonth, fmt }: {
  dailyData: Array<{ day: number; total: number }>;
  totalBudget: number; daysInMonth: number; dayOfMonth: number;
  fmt: (n: number) => string;
}) {
  const W = 560, H = 130;
  const PAD = { t: 12, r: 60, b: 28, l: 52 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  // Build cumulative by day
  const cum: number[] = Array(daysInMonth).fill(0);
  dailyData.forEach(d => { if (d.day >= 1 && d.day <= daysInMonth) cum[d.day - 1] = d.total; });
  for (let i = 1; i < daysInMonth; i++) cum[i] = (cum[i] || 0) + cum[i - 1];

  const currentSpent = cum[Math.max(dayOfMonth - 1, 0)] || 0;
  const dailyRate = dayOfMonth > 0 ? currentSpent / dayOfMonth : 0;
  const forecastEnd = dailyRate * daysInMonth;
  const maxVal = Math.max(totalBudget * 1.1, forecastEnd, currentSpent, 1);

  const xOf = (day: number) => PAD.l + ((day - 1) / Math.max(daysInMonth - 1, 1)) * cW;
  const yOf = (val: number) => PAD.t + cH - (val / maxVal) * cH;

  const actualPts = cum.slice(0, dayOfMonth).map((v, i) => `${xOf(i + 1)},${yOf(v)}`).join(' ');
  const budgetY = yOf(totalBudget);
  const overBudget = forecastEnd > totalBudget;
  const yLabels = [0, 0.5, 1].map(f => ({ val: maxVal * f, y: yOf(maxVal * f) }));
  const xTicks = [1, 8, 15, 22, daysInMonth].filter((v, i, a) => a.indexOf(v) === i && v <= daysInMonth);

  const areaPath = actualPts
    ? `M ${xOf(1)},${yOf(0)} L ${actualPts.split(' ').join(' L ')} L ${xOf(dayOfMonth)},${yOf(0)} Z`
    : '';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {yLabels.map(({ val, y }) => (
        <g key={val}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4" />
          <text x={PAD.l - 5} y={y + 4} textAnchor="end" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
            {val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}k` : Math.round(val).toString()}
          </text>
        </g>
      ))}
      {/* Budget line */}
      <line x1={PAD.l} y1={budgetY} x2={W - PAD.r} y2={budgetY} stroke="var(--amber)" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.8" />
      <text x={W - PAD.r + 6} y={budgetY + 4} fontSize="9" fill="var(--amber)" fontFamily="var(--font-mono)">Budget</text>
      {/* Area */}
      {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
      {/* Forecast line */}
      {dayOfMonth < daysInMonth && currentSpent > 0 && (
        <line
          x1={xOf(dayOfMonth)} y1={yOf(currentSpent)}
          x2={xOf(daysInMonth)} y2={yOf(forecastEnd)}
          stroke={overBudget ? 'var(--red)' : 'var(--green)'}
          strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round" opacity="0.8"
        />
      )}
      {/* Actual line */}
      {actualPts && (
        <polyline points={actualPts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* Today dot */}
      {dayOfMonth > 0 && dayOfMonth <= daysInMonth && (
        <>
          <line x1={xOf(dayOfMonth)} y1={PAD.t} x2={xOf(dayOfMonth)} y2={H - PAD.b} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
          <circle cx={xOf(dayOfMonth)} cy={yOf(currentSpent)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        </>
      )}
      {/* Forecast end dot */}
      {dayOfMonth < daysInMonth && currentSpent > 0 && (
        <circle cx={xOf(daysInMonth)} cy={yOf(forecastEnd)} r="3.5" fill={overBudget ? 'var(--red)' : 'var(--green)'} stroke="var(--surface)" strokeWidth="2" opacity="0.9" />
      )}
      {/* X-axis */}
      {xTicks.map(day => (
        <text key={day} x={xOf(day)} y={H - PAD.b + 12} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">{day}</text>
      ))}
    </svg>
  );
}

function MonthlyBarChart({ trendData }: { trendData: TrendRow[] }) {
  const now = new Date();
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS[d.getMonth()] };
  });
  const values = months6.map(m => {
    const row = trendData.find(r => Number(r.month) === m.month && Number(r.year) === m.year && r.type === 'expense');
    return row ? Number(row.total) : 0;
  });
  const maxVal = Math.max(...values, 1);
  const W = 560, H = 100;
  const barW = 60, gap = (W - barW * 6) / 7;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible' }}>
      {values.map((val, i) => {
        const x = gap + i * (barW + gap);
        const barH = Math.max((val / maxVal) * H, val > 0 ? 4 : 0);
        const y = H - barH;
        const isLatest = i === 5;
        return (
          <g key={i}>
            <rect x={x} y={0} width={barW} height={H} rx={6} fill="var(--surface-2)" />
            <rect x={x} y={y} width={barW} height={barH} rx={6}
              fill={isLatest ? 'var(--accent)' : 'var(--border-2)'}
              opacity={isLatest ? 0.9 : 0.6}
            />
            {val > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="8.5"
                fill={isLatest ? 'var(--accent-2)' : 'var(--text-muted)'}
                fontFamily="var(--font-mono)" fontWeight="600">
                {val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}k` : Math.round(val).toString()}
              </text>
            )}
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="10"
              fill={isLatest ? 'var(--text-soft)' : 'var(--text-muted)'}
              fontFamily="var(--font-sans)" fontWeight={isLatest ? '700' : '400'}>
              {months6[i].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function BudgetsPage() {
  const { fmt, settings } = useSettings();
  const payday = settings.payday || 25;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevBudgets, setPrevBudgets] = useState<Budget[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'trends' | 'recurring'>('overview');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const [notifLoading, setNotifLoading] = useState(false);
  const handleSendTest = async () => {
    setNotifLoading(true);
    try {
      const ok = await sendTestNotification();
      if (!ok) {
        // Debug: determine which condition failed.
        // This helps distinguish: unsupported vs permission not granted.
        // (Notification.permission values: 'granted' | 'denied' | 'default')
        let debug = {} as any;
        try {
          const perm = typeof window !== 'undefined' ? (window.Notification?.permission ?? 'unknown') : 'unknown';
          debug = {
            supported: !!(typeof window !== 'undefined' && 'Notification' in window),
            serviceWorker: typeof window !== 'undefined' && 'serviceWorker' in navigator,
            pushManager: typeof window !== 'undefined' && !!(navigator as any).PushManager,
            permission: perm,
            permissionEnum: ok,
          };
        } catch (e) {
          debug = { error: e instanceof Error ? e.message : String(e) };
        }

        // Visible in DevTools console
        // eslint-disable-next-line no-console
        console.log('[Budgets/TestNotification] sendTestNotification() failed debug:', debug);

        const perm = debug.permission;
        if (perm === 'denied') {
          showToast('Test failed: permission denied (see console for details)', 'error');
        } else if (perm === 'default' || perm === 'unknown') {
          showToast('Test failed: permission not granted yet (see console for details)', 'error');
        } else {
          showToast('Test failed: notifications not supported/enabled (see console for details)', 'error');
        }
      }
    } catch {
      showToast('Failed to send test notification', 'error');
    } finally {
      setNotifLoading(false);
    }

  };


  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = month === now.getMonth() + 1 && year === now.getFullYear() ? now.getDate() : daysInMonth;
  const monthProgress = (dayOfMonth / daysInMonth) * 100;
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // ── Payday-cycle aware calculations ──
  // The "cycle" runs from payday of this month to the day before payday next month.
  // e.g. payday=25: cycle is 25th → 24th of next month.
  const cycleStart = isCurrentMonth
    ? new Date(year, month - 1, Math.min(payday, daysInMonth))
    : new Date(year, month - 1, 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
  const cycleEnd = isCurrentMonth
    ? new Date(nextYear, nextMonth - 1, Math.min(payday, daysInNextMonth) - 1)
    : new Date(year, month - 1, daysInMonth);

  const cycleLengthDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1);
  const daysElapsedInCycle = isCurrentMonth
    ? Math.max(0, Math.min(cycleLengthDays, Math.round((now.getTime() - cycleStart.getTime()) / 86400000)))
    : cycleLengthDays;
  const daysLeft = Math.max(0, cycleLengthDays - daysElapsedInCycle);
  const nextPayday = isCurrentMonth
    ? new Date(nextYear, nextMonth - 1, Math.min(payday, daysInNextMonth))
    : null;
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  // daysLeft is from the payday-cycle calculation above
  const safeDailySpend = totalRemaining > 0 && daysLeft > 0 ? totalRemaining / daysLeft : 0;
  const forecastSpend = isCurrentMonth && daysElapsedInCycle > 0 ? (totalSpent / daysElapsedInCycle) * cycleLengthDays : totalSpent;
  const forecastOver = forecastSpend > totalBudget;

  const overBudgetList = budgets.filter(b => Number(b.spent) > Number(b.amount));
  const nearLimitList = budgets.filter(b => { const p = (Number(b.spent) / Number(b.amount)) * 100; return p >= 80 && p < 100; });
  const underUsedList = budgets.filter(b => (Number(b.spent) / Number(b.amount)) * 100 < 30 && isCurrentMonth && daysElapsedInCycle > Math.floor(cycleLengthDays / 2));
  const healthScore = Math.max(0, 100 - overBudgetList.length * 20 - nearLimitList.length * 8 - (forecastOver ? 15 : 0));

  const getTrend = (b: Budget) => {
    const prev = prevBudgets.find(pb => pb.category_id === b.category_id);
    return prev ? Number(b.spent) - Number(prev.spent) : null;
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const recurringTxns = transactions.filter(t => t.is_recurring);
  const recurringTotal = recurringTxns.reduce((s, t) => s + Number(t.amount), 0);
  const dailyExpense = (stats?.daily || []).filter(d => d.type === 'expense').map(d => ({ day: Number(d.day), total: Number(d.total) }));

  // ── Data loading ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pm = month === 1 ? 12 : month - 1;
      const py = month === 1 ? year - 1 : year;
      const [b, c, t, pb, s] = await Promise.all([
        api.getBudgets({ month: String(month), year: String(year) }),
        api.getCategories(),
        api.getTransactions({ month: String(month), year: String(year), limit: '500' }).catch(() => []),
        api.getBudgets({ month: String(pm), year: String(py) }).catch(() => []),
        api.getStats({ month: String(month), year: String(year) }).catch(() => null),
      ]);
      setBudgets(Array.isArray(b) ? b : []);
      setCategories(Array.isArray(c) ? c : []);
      setTransactions(Array.isArray(t) ? t : (t?.transactions ?? []));
      setPrevBudgets(Array.isArray(pb) ? pb : []);
      setStats(s);
    } catch { showToast('Failed to load budgets', 'error'); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ──
  const handleSave = async () => {
    if (!form.category_id || !form.amount) { showToast('Fill in all fields', 'error'); return; }
    try {
      await api.createBudget({ ...form, amount: Number(form.amount), month, year });
      showToast('Budget saved'); setShowModal(false); load();
    } catch { showToast('Failed to save budget', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this budget?')) return;
    try { await api.deleteBudget(id); showToast('Budget deleted', 'info'); load(); }
    catch { showToast('Failed to delete', 'error'); }
  };

  // ── Rule-based suggestions ──
  const getRuleSuggestions = (): Array<{ icon: string; title: string; body: string; color: string }> => {
    if (!budgets.length) return [];
    const tips: Array<{ icon: string; title: string; body: string; color: string }> = [];

    // 1. Over-budget categories
    overBudgetList.forEach(b => {
      const overAmt = Number(b.spent) - Number(b.amount);
      tips.push({
        icon: 'over',
        title: `${translateCategory(b.category_name)} is over budget`,
        body: `You've exceeded your ${fmt(Number(b.amount))} limit by ${fmt(overAmt)}. Pause non-essential spending in this category for the rest of the month.`,
        color: 'var(--red)',
      });
    });

    // 2. Near-limit categories
    nearLimitList.forEach(b => {
      const pct = Math.round((Number(b.spent) / Number(b.amount)) * 100);
      const remaining = Number(b.amount) - Number(b.spent);
      tips.push({
        icon: 'warn',
        title: `${translateCategory(b.category_name)} is at ${pct}%`,
        body: `Only ${fmt(remaining)} left in this budget${daysLeft > 0 ? ` for ${daysLeft} more days` : ''}. Limit spending here to avoid going over.`,
        color: 'var(--amber)',
      });
    });

    // 3. Forecast over budget
    if (isCurrentMonth && forecastOver && daysElapsedInCycle > 3) {
      const overBy = forecastSpend - totalBudget;
      tips.push({
        icon: 'down',
        title: 'On track to exceed your total budget',
        body: `At your current daily rate of ${fmt(Math.round(totalSpent / Math.max(1, daysElapsedInCycle)))}/day, you'll overspend by ${fmt(Math.round(overBy))} by payday. Try to spend no more than ${fmt(Math.round(safeDailySpend > 0 ? safeDailySpend : 0))}/day.`,
        color: 'var(--red)',
      });
    }

    // 4. Under-used budgets (past mid-month with very low usage)
    underUsedList.forEach(b => {
      const free = Number(b.amount) - Number(b.spent);
      tips.push({
        icon: 'tip',
        title: `${translateCategory(b.category_name)} budget is barely used`,
        body: `You've only used ${Math.round((Number(b.spent) / Number(b.amount)) * 100)}% of this budget. Consider moving ${fmt(free)} to a category that's running low.`,
        color: 'var(--green)',
      });
    });

    // 5. Healthy overall — positive tip
    if (tips.length === 0 && isCurrentMonth) {
      tips.push({
        icon: 'check',
        title: "You're on track this month",
        body: `All budgets are within limits. Keep spending ≤ ${fmt(Math.round(safeDailySpend))}/day for the remaining ${daysLeft} days to finish comfortably under budget.`,
        color: 'var(--green)',
      });
    }

    // 6. Recurring costs eating most of budget
    if (recurringTotal > 0 && totalBudget > 0 && recurringTotal / totalBudget > 0.6) {
      tips.push({
        icon: 'repeat',
        title: 'Recurring costs are high',
        body: `Fixed expenses account for ${Math.round((recurringTotal / totalBudget) * 100)}% (${fmt(recurringTotal)}) of your total budget. Review subscriptions or recurring charges you might be able to reduce.`,
        color: 'var(--purple)',
      });
    }

    // 7. Big spender — category using most of budget
    const biggestSpender = [...budgets].sort((a, b) => Number(b.spent) / Number(b.amount) - Number(a.spent) / Number(a.amount))[0];
    if (biggestSpender && !overBudgetList.find(b => b.id === biggestSpender.id) && !nearLimitList.find(b => b.id === biggestSpender.id)) {
      const pct = Math.round((Number(biggestSpender.spent) / Number(biggestSpender.amount)) * 100);
      if (pct >= 50) {
        tips.push({
          icon: 'watch',
          title: `Watch ${translateCategory(biggestSpender.category_name)}`,
          body: `This is your highest-usage category at ${pct}% spent (${fmt(Number(biggestSpender.spent))} of ${fmt(Number(biggestSpender.amount))}). It has ${fmt(Number(biggestSpender.amount) - Number(biggestSpender.spent))} left — pace yourself.`,
          color: 'var(--accent)',
        });
      }
    }

    return tips.slice(0, 5);
  };

  // ── Style helpers ──
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
  const tabBtn = (tab: string): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: activeTab === tab ? 'var(--accent)' : 'transparent',
    color: activeTab === tab ? 'white' : 'var(--text-muted)',
    border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
  });

  const emptyState = !loading && budgets.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Budgets</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {MONTH_FULL[month - 1]} {year} · Day {dayOfMonth} of {daysInMonth}
            {isCurrentMonth && daysLeft > 0 && ` · ${daysLeft}d to payday`}
            {isCurrentMonth && nextPayday && (
              <span style={{ marginLeft: 4, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                (next: {nextPayday.getDate()}/{nextPayday.getMonth() + 1})
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 86, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 78, fontSize: 13 }}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleSendTest}
            disabled={notifLoading}
            style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', whiteSpace: 'nowrap', opacity: notifLoading ? 0.6 : 1 }}>
            {notifLoading ? 'Sending…' : 'Send test'}
          </button>
          <button
            onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }}
            style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)', whiteSpace: 'nowrap' }}>
            + Add Budget
          </button>
        </div>
      </div>

      {/* ── Empty State ── */}
      {emptyState && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 320 }}>
            <div style={{ padding: 40, background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="50" fill="none" stroke="var(--border-2)" strokeWidth="18" />
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <circle key={i} cx="70" cy="70" r="50" fill="none"
                    stroke={['#5b6ef5','#22d47a','#f5a623','#f05252','#a78bfa'][i]}
                    strokeWidth="18"
                    strokeDasharray={`${55} ${2 * Math.PI * 50}`}
                    strokeDashoffset={-(2 * Math.PI * 50 * deg / 360)}
                    opacity="0.2"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
                  />
                ))}
                <text x="70" y="66" textAnchor="middle" fontSize="12" fill="var(--text-muted)" fontFamily="var(--font-sans)">No</text>
                <text x="70" y="82" textAnchor="middle" fontSize="12" fill="var(--text-muted)" fontFamily="var(--font-sans)">budgets</text>
              </svg>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 180 }}>
                Set limits per category to unlock spending insights
              </div>
            </div>
            <div style={{ padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>Start tracking budgets</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Set monthly spending limits per category and get live progress bars, forecasts, health scores, and smart rule-based suggestions.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Category progress bars & health indicators', 'Month-end spending forecasts', 'Insights: over-budget & near-limit alerts', 'Smart rule-based budget suggestions'].map(item => (
                  <div key={item} style={{ fontSize: 13, color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{item.split(' ')[0]}</span>
                    <span>{item.split(' ').slice(1).join(' ')}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }}
                style={{ padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.35)', alignSelf: 'flex-start' }}>
                Create your first budget &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      {!loading && !emptyState && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 8, overflowX: 'auto' }} className="stats-scroll">
          {[
            { label: 'Total Budget', value: fmt(totalBudget), sub: `${budgets.length} categories`, color: 'var(--accent)' },
            { label: 'Total Spent', value: fmt(totalSpent), sub: `${overallPct.toFixed(0)}% of budget`, color: totalSpent > totalBudget ? 'var(--red)' : 'var(--green)' },
            { label: 'Remaining', value: fmt(Math.abs(totalRemaining)), sub: totalRemaining >= 0 ? 'left to spend' : 'over budget', color: totalRemaining >= 0 ? 'var(--text)' : 'var(--red)' },
            { label: 'Safe Daily', value: safeDailySpend > 0 ? fmt(Math.round(safeDailySpend)) : '—', sub: daysLeft > 0 ? `per day · ${daysLeft}d to payday` : 'cycle ended', color: safeDailySpend > 0 ? 'var(--green)' : 'var(--text-muted)' },
            { label: 'Forecast', value: fmt(Math.round(forecastSpend)), sub: forecastOver ? 'over budget' : 'projected spend', color: forecastOver ? 'var(--red)' : 'var(--amber)' },
          ].map((item, i) => (
            <div key={i} style={{ ...card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: item.color, opacity: 0.8 }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)', color: item.color, marginBottom: 3 }}>{item.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Donut + Trend Chart ── */}
      {!loading && !emptyState && (
        <div className="budgets-viz-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
          {/* Donut */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', alignSelf: 'flex-start' }}>Breakdown</div>
            <DonutChart budgets={budgets} fmt={fmt} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {budgets.slice(0, 6).map(b => {
                const pct = totalBudget > 0 ? ((Number(b.amount) / totalBudget) * 100).toFixed(0) : '0';
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: b.category_color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translateCategory(b.category_name)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
                  </div>
                );
              })}
              {budgets.length > 6 && <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>+{budgets.length - 6} more</div>}
            </div>
          </div>

          {/* Right: overall bar + spending trend chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Overall progress */}
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Overall Usage</span>
                  <HealthDot score={healthScore} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)' }}>
                  {overallPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 14, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${Math.min(overallPct, 100)}%`,
                  background: `linear-gradient(90deg, var(--accent), ${overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)'})`,
                  transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)',
                  boxShadow: `0 0 14px ${overallPct >= 80 ? 'rgba(240,82,82,0.35)' : 'rgba(91,110,245,0.35)'}`,
                }} />
                {isCurrentMonth && (
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${monthProgress}%`, width: 2, background: 'rgba(255,255,255,0.25)' }} title="Month progress" />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 4 }}>
                <span>{fmt(totalSpent)} spent</span>
                {isCurrentMonth && <span style={{ color: 'var(--text-soft)' }}>Month: {Math.round(monthProgress)}% elapsed</span>}
                <span>{fmt(totalBudget)} budget</span>
              </div>
            </div>

            {/* Spending trend chart */}
            <div style={{ ...card, padding: '16px 20px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Spending Trend</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cumulative daily spend · dashed = forecast</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Projected</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: forecastOver ? 'var(--red)' : 'var(--green)' }}>
                    {fmt(Math.round(forecastSpend))}
                  </div>
                </div>
              </div>
              {dailyExpense.length > 0
                ? <SpendingTrendChart dailyData={dailyExpense} totalBudget={totalBudget} daysInMonth={daysInMonth} dayOfMonth={dayOfMonth} fmt={fmt} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--text-muted)', fontSize: 12 }}>No transaction data for this month yet</div>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      {!loading && !emptyState && (
        <div className="tabs-row" style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content', maxWidth: '100%' }}>
          {(['overview', 'insights', 'trends', 'recurring'] as const).map(tab => (
            <button key={tab} style={tabBtn(tab)} onClick={() => setActiveTab(tab)}>
              {tab === 'overview' ? 'Overview' : tab === 'insights' ? 'Insights' : tab === 'trends' ? 'Trends' : 'Recurring'}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: OVERVIEW ── */}
      {!loading && !emptyState && activeTab === 'overview' && (
        <div className="budget-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {budgets.map((b, idx) => {
            const spent = Number(b.spent);
            const budget = Number(b.amount);
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const over = spent > budget;
            const warn = !over && pct >= 80;
            const barColor = over ? 'var(--red)' : warn ? 'var(--amber)' : b.category_color;
            const remaining = budget - spent;
            const trend = getTrend(b);
            const healthSc = over ? 0 : warn ? 50 : 100;
            const isExpanded = expandedCard === b.id;
            const dailyAvg = dayOfMonth > 0 ? spent / dayOfMonth : 0;
            const projectedTotal = dailyAvg * daysInMonth;
            const catDailyBudget = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;

            return (
              <div key={b.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${over ? 'rgba(240,82,82,0.3)' : isExpanded ? 'var(--border-2)' : 'var(--border)'}`,
                  borderRadius: 16, padding: 20,
                  transition: 'border-color 0.15s ease', cursor: 'pointer',
                }}
                onClick={() => setExpandedCard(isExpanded ? null : b.id)}
                onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(240,82,82,0.45)' : 'var(--border-2)'; }}
                onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(240,82,82,0.3)' : 'var(--border)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: `${b.category_color}18`, border: `1.5px solid ${b.category_color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, color: b.category_color, flexShrink: 0,
                    }}>
                      {translateCategory(b.category_name)[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 3 }}>{translateCategory(b.category_name)}</div>
                      <HealthDot score={healthSc} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {trend !== null && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: trend > 0 ? 'var(--red)' : 'var(--green)', background: trend > 0 ? 'rgba(240,82,82,0.12)' : 'rgba(34,212,122,0.12)', padding: '2px 5px', borderRadius: 4 }}>
                        {trend > 0 ? '↑' : '↓'} {fmt(Math.abs(trend))}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(b.id); }}
                      title="Delete"
                      style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(240,82,82,0.12)'; el.style.color = 'var(--red)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--surface-2)'; el.style.color = 'var(--text-muted)'; }}>
                      &times;
                    </button>
                  </div>
                </div>

                <AnimatedBar pct={pct} color={barColor} delay={idx * 70} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: over ? 'var(--red)' : 'var(--text)' }}>{fmt(spent)}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>of</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmt(budget)}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--green)' }}>{pct.toFixed(0)}%</span>
                </div>

                {over
                  ? <div style={{ marginTop: 5, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>{fmt(spent - budget)} over budget</div>
                  : <div style={{ marginTop: 5, fontSize: 11, color: 'var(--green)' }}>{fmt(remaining)} remaining · {(100 - pct).toFixed(0)}% left</div>
                }

                {isExpanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div className="expanded-mini-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: 'Daily Avg', value: fmt(Math.round(dailyAvg)), color: 'var(--text)' },
                        { label: 'Safe Daily', value: catDailyBudget > 0 ? fmt(Math.round(catDailyBudget)) : 'N/A', color: catDailyBudget > 0 ? 'var(--green)' : 'var(--red)' },
                        { label: 'Projected', value: fmt(Math.round(projectedTotal)), color: projectedTotal > budget ? 'var(--red)' : 'var(--text)' },
                        { label: 'vs Prev', value: trend === null ? '—' : `${trend > 0 ? '+' : ''}${fmt(trend)}`, color: trend === null ? 'var(--text-muted)' : trend > 0 ? 'var(--red)' : 'var(--green)' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    {isCurrentMonth && projectedTotal > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Projected vs budget</div>
                        <AnimatedBar pct={Math.min((projectedTotal / budget) * 100, 100)} color={projectedTotal > budget ? 'var(--red)' : 'var(--amber)'} height={5} />
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{fmt(Math.round(projectedTotal))} of {fmt(budget)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: INSIGHTS ── */}
      {!loading && !emptyState && activeTab === 'insights' && (
        <div className="insights-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Safe Daily Spending */}
            <div style={{
              ...card,
              background: safeDailySpend > 0 ? 'linear-gradient(135deg, rgba(34,212,122,0.06) 0%, var(--surface) 60%)' : 'var(--surface)',
              border: safeDailySpend > 0 ? '1px solid rgba(34,212,122,0.2)' : '1px solid rgba(240,82,82,0.25)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Safe Daily Spending
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em', marginBottom: 6, color: safeDailySpend > 0 ? 'var(--green)' : 'var(--red)' }}>
                {safeDailySpend > 0 ? fmt(Math.round(safeDailySpend)) : 'Over!'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: safeDailySpend > 0 && budgets.length > 0 ? 12 : 0, lineHeight: 1.6 }}>
                {safeDailySpend > 0
                  ? `Spend up to ${fmt(Math.round(safeDailySpend))} per day for the remaining ${daysLeft} day${daysLeft !== 1 ? 's' : ''} until payday to stay on track.`
                  : totalRemaining < 0
                    ? `You're ${fmt(Math.abs(totalRemaining))} over your total budget.`
                    : 'Pay cycle has ended or no days remaining.'}
              </div>
              {safeDailySpend > 0 && budgets.filter(b => Number(b.spent) < Number(b.amount)).length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Per category</div>
                  {budgets.filter(b => Number(b.spent) < Number(b.amount)).slice(0, 4).map(b => {
                    const catRemaining = Number(b.amount) - Number(b.spent);
                    const catDaily = daysLeft > 0 ? catRemaining / daysLeft : 0;
                    return (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: b.category_color }} />
                          <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>{translateCategory(b.category_name)}</span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>
                          {fmt(Math.round(catDaily))}/day
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Over Budget */}
            {overBudgetList.length > 0 ? (
              <div style={{ ...card, border: '1px solid rgba(240,82,82,0.25)', background: 'rgba(240,82,82,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 12 }}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Over Budget</span> <span style={{ fontWeight: 400, opacity: 0.7 }}>({overBudgetList.length})</span>
                </div>
                {overBudgetList.map(b => {
                  const overAmt = Number(b.spent) - Number(b.amount);
                  const pct = (Number(b.spent) / Number(b.amount)) * 100;
                  return (
                    <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(240,82,82,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: b.category_color }} />
                          <span style={{ fontSize: 13 }}>{translateCategory(b.category_name)}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>+{fmt(overAmt)}</span>
                      </div>
                      <AnimatedBar pct={100} color="var(--red)" />
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                        {pct.toFixed(0)}% · budget was {fmt(Number(b.amount))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ ...card, border: '1px solid rgba(34,212,122,0.15)', background: 'rgba(34,212,122,0.03)', textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ marginBottom: 8, display:'flex', justifyContent:'center', color:'var(--green)', opacity:0.6 }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>No overspending!</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All categories are within their budget.</div>
              </div>
            )}

            {/* Near Limit */}
            {nearLimitList.length > 0 && (
              <div style={{ ...card, border: '1px solid rgba(245,166,35,0.2)', background: 'rgba(245,166,35,0.03)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 12 }}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Near Limit</span> <span style={{ fontWeight: 400, opacity: 0.7 }}>({nearLimitList.length})</span>
                </div>
                {nearLimitList.map(b => {
                  const pct = (Number(b.spent) / Number(b.amount)) * 100;
                  return (
                    <div key={b.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(245,166,35,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: b.category_color }} />
                          <span style={{ fontSize: 12 }}>{translateCategory(b.category_name)}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{pct.toFixed(0)}%</span>
                      </div>
                      <AnimatedBar pct={pct} color="var(--amber)" />
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                        {fmt(Number(b.amount) - Number(b.spent))} remaining of {fmt(Number(b.amount))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Under-used */}
            {underUsedList.length > 0 && (
              <div style={{ ...card, border: '1px solid rgba(34,212,122,0.15)', background: 'rgba(34,212,122,0.03)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Under-used Budgets</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Low usage past mid-month — consider reallocating these funds.
                </div>
                {underUsedList.map(b => {
                  const pct = (Number(b.spent) / Number(b.amount)) * 100;
                  return (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(34,212,122,0.1)' }}>
                      <span style={{ fontSize: 12 }}>{translateCategory(b.category_name)}</span>
                      <span style={{ fontSize: 11, color: 'var(--green)' }}>{pct.toFixed(0)}% used · {fmt(Number(b.amount) - Number(b.spent))} free</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Health Score */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Budget Health Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
                <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
                  <svg viewBox="0 0 88 88" width="88" height="88">
                    <circle cx="44" cy="44" r="34" fill="none" stroke="var(--surface-2)" strokeWidth="10" />
                    <circle cx="44" cy="44" r="34" fill="none"
                      stroke={healthScore >= 80 ? 'var(--green)' : healthScore >= 50 ? 'var(--amber)' : 'var(--red)'}
                      strokeWidth="10"
                      strokeDasharray={`${(healthScore / 100) * 213.6} 213.6`}
                      strokeLinecap="round"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px', transition: 'stroke-dasharray 1s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{healthScore}</span>
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <HealthDot score={healthScore} />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
                    {healthScore >= 80 ? "You're managing your budget well. Keep up the great work!" :
                     healthScore >= 50 ? "A few categories need attention before month end." :
                     "Multiple budgets are at risk — review your spending now."}
                  </div>
                </div>
              </div>
              {[
                { label: 'On track', value: budgets.filter(b => (Number(b.spent) / Number(b.amount)) * 100 < 80).length, color: 'var(--green)', icon: 'check' },
                { label: 'Near limit (80–100%)', value: nearLimitList.length, color: 'var(--amber)', icon: 'warn' },
                { label: 'Over budget', value: overBudgetList.length, color: 'var(--red)', icon: 'over' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)', marginBottom: 4 }}>
                  {{
                    check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
                    warn:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                    over:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
                  }[item.icon]}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}/{budgets.length}</span>
                </div>
              ))}
            </div>

            {/* Forecast alert */}
            {isCurrentMonth && (
              <div style={{
                ...card,
                border: `1px solid ${forecastOver ? 'rgba(240,82,82,0.25)' : 'rgba(34,212,122,0.15)'}`,
                background: forecastOver ? 'rgba(240,82,82,0.04)' : 'rgba(34,212,122,0.03)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: forecastOver ? 'var(--red)' : 'var(--green)', marginBottom: 8 }}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                    {forecastOver
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    }
                    {forecastOver ? 'Forecast: Over Budget' : 'Forecast: On Track'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'Current spend', value: fmt(totalSpent), color: 'var(--text)' },
                    { label: 'Projected total', value: fmt(Math.round(forecastSpend)), color: forecastOver ? 'var(--red)' : 'var(--green)' },
                    { label: 'Budget', value: fmt(totalBudget), color: 'var(--text-muted)' },
                    { label: forecastOver ? 'Over by' : 'Under by', value: fmt(Math.abs(Math.round(forecastSpend - totalBudget))), color: forecastOver ? 'var(--red)' : 'var(--green)' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Based on your daily spend of <strong style={{ color: 'var(--text-soft)' }}>{fmt(Math.round(totalSpent / Math.max(dayOfMonth, 1)))}/day</strong> over the past {dayOfMonth} day{dayOfMonth !== 1 ? 's' : ''}.
                </div>
              </div>
            )}

            {/* Rule-based Suggestions */}
            <div style={{ ...card }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, display:'flex', alignItems:'center', gap:6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Smart Suggestions
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Personalised tips based on your budget data</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {getRuleSuggestions().map((tip, i) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    over:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                    warn:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                    down:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
                    tip:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><path d="M12 18a6 6 0 000-12"/><line x1="12" y1="22" x2="12" y2="18"/></svg>,
                    check:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
                    repeat: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
                    watch:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                  };
                  return (
                    <div key={i} style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface-2)', borderLeft: `3px solid ${tip.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, color: tip.color }}>
                        {iconMap[tip.icon]}
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{tip.title}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 19 }}>{tip.body}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: TRENDS ── */}
      {!loading && !emptyState && activeTab === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>6-Month Spending</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Total expenses per month</div>
            <MonthlyBarChart trendData={stats?.trend ?? []} />
          </div>
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Category Trends</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current vs previous month — top bar = now, faint bar = last month</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {budgets.map((b, idx) => {
                const spent = Number(b.spent);
                const budget = Number(b.amount);
                const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                const trend = getTrend(b);
                const barColor = spent > budget ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : b.category_color;
                const prevSpent = prevBudgets.find(pb => pb.category_id === b.category_id);
                const prevPct = prevSpent && budget > 0 ? Math.min((Number(prevSpent.spent) / budget) * 100, 100) : 0;
                const trendPct = prevSpent && Number(prevSpent.spent) > 0 ? ((spent - Number(prevSpent.spent)) / Number(prevSpent.spent)) * 100 : null;

                return (
                  <div key={b.id} style={{ padding: '12px 0', borderBottom: idx < budgets.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: b.category_color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{translateCategory(b.category_name)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {trend !== null && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: trend > 0 ? 'var(--red)' : 'var(--green)', background: trend > 0 ? 'rgba(240,82,82,0.12)' : 'rgba(34,212,122,0.12)', padding: '2px 6px', borderRadius: 4 }}>
                            {trend > 0 ? '↑' : '↓'} {fmt(Math.abs(trend))} {trendPct !== null ? `(${Math.abs(trendPct).toFixed(0)}%)` : ''}
                          </span>
                        )}
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-soft)' }}>{fmt(spent)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <AnimatedBar pct={pct} color={barColor} delay={idx * 50} />
                      {prevSpent && Number(prevSpent.spent) > 0 && (
                        <AnimatedBar pct={prevPct} color="var(--border-2)" height={4} delay={idx * 50 + 200} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>{pct.toFixed(0)}% of {fmt(budget)} budget</span>
                      {prevSpent && <span style={{ opacity: 0.6 }}>prev: {fmt(Number(prevSpent.spent))}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: RECURRING ── */}
      {!loading && !emptyState && activeTab === 'recurring' && (
        <div className="insights-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Recurring Expenses</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fixed costs this month</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{fmt(recurringTotal)}</div>
              </div>
            </div>
            {recurringTxns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ marginBottom: 8, opacity: 0.2, display:"flex", justifyContent:"center" }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg></div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>No recurring transactions found</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>Mark transactions as recurring on the Transactions page</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recurringTxns.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{t.description || translateCategory(t.category_name)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{translateCategory(t.category_name)} · {t.date?.slice(0, 10)}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>{fmt(Number(t.amount))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {totalBudget > 0 && (
              <div style={{ ...card }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recurring vs Discretionary</div>
                <div style={{ height: 12, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min((recurringTotal / totalBudget) * 100, 100)}%`,
                    background: 'var(--purple)', transition: 'width 0.9s ease',
                    boxShadow: '0 0 10px rgba(167,139,250,0.35)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span>Recurring: {fmt(recurringTotal)} ({((recurringTotal / totalBudget) * 100).toFixed(0)}%)</span>
                  <span>Flexible: {fmt(Math.max(0, totalBudget - recurringTotal))}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Fixed costs', value: fmt(recurringTotal), color: 'var(--purple)' },
                    { label: 'Discretionary', value: fmt(Math.max(0, totalBudget - recurringTotal)), color: 'var(--accent)' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ ...card, background: 'linear-gradient(135deg, rgba(91,110,245,0.06) 0%, var(--surface) 60%)', border: '1px solid rgba(91,110,245,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Month Progress
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 4 }}>
                {daysLeft}d left
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
                {daysLeft > 0 ? `${daysLeft} days until payday. Safe daily: ${fmt(Math.round(safeDailySpend))}.` : 'Pay cycle has ended.'}
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${monthProgress}%`, background: 'var(--accent)', opacity: 0.6 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{Math.round(monthProgress)}% of month elapsed</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading Skeletons ── */}
      {loading && (
        <div className="budgets-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...card }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <Skeleton w={36} h={36} r={10} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton w={120} h={13} /><Skeleton w={80} h={10} />
                </div>
              </div>
              <Skeleton h={8} r={99} />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton w={80} h={10} /><Skeleton w={50} h={10} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', background: 'var(--surface)', border: '1px solid var(--border-2)', padding: '20px 20px 36px', boxShadow: '0 -8px 48px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>Set Budget</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4, cursor: 'pointer' }}>&times;</button>
            </div>
            <div>
              <label style={LABEL_STYLE}>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select category&hellip;</option>
                {expenseCategories.map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Monthly Limit</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)', cursor: 'pointer' }}>Save Budget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}