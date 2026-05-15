'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, ReferenceLine, Legend } from 'recharts';
import { useSettings } from '@/lib/SettingsContext';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const BREAKDOWN_COLORS = ['#5b6ef5','#22d47a','#f5a623','#f05252'];

function groupCategory(name: string) {
  const t = (translateCategory(name) + ' ' + name).toLowerCase();
  if (/food|drink|beverage|makan|minum|qris|e-wallet|wallet|shop|belanja|entertain|hiburan|dining|resto|cafe|kopi/.test(t)) return 'Lifestyle';
  if (/rent|housing|kost|sewa|bill|utilit|tagihan|phone|pulsa|internet|transport|ojol|rideshare|health|kesehatan|edu|pendidikan/.test(t)) return 'Essentials';
  if (/saving|invest|tabungan/.test(t)) return 'Savings';
  return 'Other';
}
function merchantName(desc?: string) {
  if (!desc) return 'Unknown';
  const m = desc.trim().match(/(?:at|@)\s*([^\-|,|–|:]+)/i);
  if (m) return m[1].trim();
  return desc.split(/[-–|:|@]/)[0].trim() || desc;
}
function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}
const TOOLTIP_STYLE = { background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 12 };

interface StatsData {
  income: number; expenses: number; savings: number; balance: number;
  byCategory: { name: string; color: string; total: string }[];
  trend: { month: number; year: number; type: string; total: string }[];
  daily: { dow: number; day: number; date_str: string; type: string; total: string }[];
  weekdayPattern: { dow: number; avg_spend: string }[];
  categoryMoM: { name: string; color: string; month: number; year: number; total: string }[];
  txFrequency: { day: number; count: string; type: string }[];
}

export default function AnalyticsPage() {
  const { fmt, fmtShort, settings } = useSettings();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<StatsData | null>(null);
  const [transactions, setTransactions] = useState<{ id: number; amount: number; type: string; description: string; date: string; date_str: string; category_name: string; category_color: string }[]>([]);
  const [budgets, setBudgets] = useState<{ id: number; amount: string; spent: string; category_name: string; category_color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartKey, setChartKey] = useState(0);
  const [trendView, setTrendView] = useState<'mom'|'dod'>('mom');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  type DetailModal =
    | { type: 'merchant'; name: string }
    | { type: 'category'; name: string; color: string }
    | { type: 'group'; name: string }
    | { type: 'biggest'; tx: typeof transactions[0] }
    | null;
  const [detailModal, setDetailModal] = useState<DetailModal>(null);

  const handleTrendViewChange = (v: 'mom'|'dod') => {
    setTrendView(v);
    setChartKey(k => k + 1);
  };


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, tx, b] = await Promise.all([
        api.getStats({ month: String(month), year: String(year) }),
        api.getTransactions({ month: String(month), year: String(year), limit: '100' }),
        api.getBudgets({ month: String(month), year: String(year) }),
      ]);
      setStats(s); setTransactions(tx); setBudgets(b);
      setChartKey(k => k + 1);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const spendingBreakdown = useMemo(() => {
    if (!stats) return [];
    const groups: Record<string, number> = { Essentials: 0, Lifestyle: 0, Savings: 0, Other: 0 };
    for (const item of stats.byCategory) groups[groupCategory(item.name)] += Number(item.total);
    return Object.entries(groups).map(([name, total], i) => ({ name, total, color: BREAKDOWN_COLORS[i] })).filter(i => i.total > 0);
  }, [stats]);

  const merchantData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions.filter(t => t.type === 'expense')) map.set(merchantName(tx.description), (map.get(merchantName(tx.description)) || 0) + Number(tx.amount));
    return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total).slice(0,5);
  }, [transactions]);

  const trendData = useMemo(() => {
    if (!stats) return [];

    // Month-over-month (existing stats endpoint)
    const momMap: Record<string, { month: string; day: string; income: number; expenses: number; net: number }> = {};
    for (const row of stats.trend) {
      const key = `${row.year}-${String(row.month).padStart(2,'0')}`;
      if (!momMap[key]) {
        momMap[key] = {
          month: MONTHS[row.month - 1],
          day: '—',
          income: 0,
          expenses: 0,
          net: 0,
        };
      }
      if (row.type === 'income') momMap[key].income = Number(row.total);
      else momMap[key].expenses = Number(row.total);
    }

    return Object.values(momMap).map(item => ({ ...item, net: item.income - item.expenses }));
  }, [stats]);

  // Day-over-Day: aggregate by day-of-week (Sun..Sat) for selected month
  const dodData = useMemo(() => {
    if (!stats) return [];
    const dowMap: Record<number, { day: string; income: number; expenses: number; net: number }> = {};
    for (let i = 0; i < 7; i++) {
      dowMap[i] = { day: DAYS_OF_WEEK[i], income: 0, expenses: 0, net: 0 };
    }
    for (const row of stats.daily) {
      const dow = Number(row.dow);
      if (row.type === 'income') dowMap[dow].income += Number(row.total);
      else dowMap[dow].expenses += Number(row.total);
    }
    return DAYS_OF_WEEK.map((_, i) => ({ ...dowMap[i], net: dowMap[i].income - dowMap[i].expenses }));
  }, [stats]);


  // Daily spend bars (day 1–31) for the selected month
  const dailyBarData = useMemo(() => {
    if (!stats) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayMap: Record<number, { expenses: number; income: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) dayMap[d] = { expenses: 0, income: 0 };
    for (const row of stats.daily) {
      const d = Number(row.day);
      if (row.type === 'expense') dayMap[d].expenses += Number(row.total);
      else dayMap[d].income += Number(row.total);
    }
    return Object.entries(dayMap).map(([d, v]) => ({ day: d, ...v }));
  }, [stats, month, year]);

  // Cumulative spend vs ideal flat-line
  const cumulativeData = useMemo(() => {
    if (!stats) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = month === now.getMonth() + 1 && year === now.getFullYear() ? now.getDate() : daysInMonth;
    const idealPerDay = stats.income > 0 ? stats.income / daysInMonth : 0;
    let runningExpense = 0;
    const result = [];
    for (const item of dailyBarData) {
      const d = Number(item.day);
      runningExpense += item.expenses;
      result.push({
        day: d,
        actual: d <= today ? runningExpense : undefined,
        ideal: idealPerDay * d,
      });
    }
    return result;
  }, [dailyBarData, stats, month, year, now]);

  // Category-level bar data (top 8)
  const categoryBarData = useMemo(() => {
    if (!stats) return [];
    return stats.byCategory
      .slice(0, 8)
      .map(c => ({ rawName: c.name, name: translateCategory(c.name).replace(' & ', ' & '), total: Number(c.total), color: c.color || '#5b6ef5' }));
  }, [stats]);

  // Radar data — spending balance across groups (% of income)
  const radarData = useMemo(() => {
    if (!stats || stats.income === 0) return [];
    const groups: Record<string, number> = { Essentials: 0, Lifestyle: 0, Savings: 0, Other: 0 };
    for (const item of stats.byCategory) groups[groupCategory(item.name)] += Number(item.total);
    return Object.entries(groups).map(([subject, value]) => ({
      subject,
      value: Math.round((value / stats.income) * 100),
      fullMark: 100,
    }));
  }, [stats]);

  // Waterfall: Income → categories breakdown → Net
  const waterfallData = useMemo(() => {
    if (!stats) return [];
    const result: { name: string; value: number; base: number; color: string; isTotal?: boolean }[] = [];
    result.push({ name: 'Income', value: stats.income, base: 0, color: '#22d47a', isTotal: true });
    let remaining = stats.income;
    const topCats = stats.byCategory.slice(0, 5);
    for (const c of topCats) {
      const val = Number(c.total);
      remaining -= val;
      result.push({ name: translateCategory(c.name).split(' ')[0], value: val, base: remaining, color: '#f05252' });
    }
    const otherTotal = stats.expenses - topCats.reduce((a, c) => a + Number(c.total), 0);
    if (otherTotal > 0) { remaining -= otherTotal; result.push({ name: 'Other', value: otherTotal, base: remaining, color: '#f05252' }); }
    result.push({ name: 'Net', value: Math.max(0, remaining), base: 0, color: remaining >= 0 ? '#5b6ef5' : '#f05252', isTotal: true });
    return result;
  }, [stats]);

  // Spending heatmap — day-of-month grid colored by expense intensity
  const heatmapData = useMemo(() => {
    if (!stats) return { cells: [] as { day: number | null; value: number; intensity: number }[], maxVal: 1, daysInMonth: 0 };
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const dayMap: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) dayMap[d] = 0;
    for (const row of stats.daily) {
      if (row.type === 'expense') dayMap[Number(row.day)] = (dayMap[Number(row.day)] || 0) + Number(row.total);
    }
    const maxVal = Math.max(1, ...Object.values(dayMap));
    const cells: { day: number | null; value: number; intensity: number }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, value: 0, intensity: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const val = dayMap[d] || 0;
      cells.push({ day: d, value: val, intensity: val / maxVal });
    }
    return { cells, maxVal, daysInMonth };
  }, [stats, month, year]);

  // Budget vs Actual grouped bar data
  const budgetVsActual = useMemo(() => {
    if (!budgets.length) return [];
    return budgets.map(b => ({
      name: translateCategory(b.category_name).split(' ')[0],
      budget: Number(b.amount),
      actual: Number(b.spent),
      color: b.category_color || '#5b6ef5',
    })).sort((a, b) => b.actual - a.actual);
  }, [budgets]);

  // Weekday pattern — avg spend per day of week (all time)
  const weekdayPatternData = useMemo(() => {
    if (!stats) return [];
    const map: Record<number, number> = {};
    for (const row of stats.weekdayPattern) map[Number(row.dow)] = Number(row.avg_spend);
    return DAYS_OF_WEEK.map((d, i) => ({ day: d, avg: Math.round(map[i] || 0) }));
  }, [stats]);

  // Category MoM — pivot into series per top-5 category
  const categoryMoMData = useMemo(() => {
    if (!stats) return { series: [] as { name: string; color: string }[], data: [] as Record<string, string | number>[] };
    const catTotals: Record<string, { color: string; total: number }> = {};
    for (const row of stats.categoryMoM) {
      const name = translateCategory(row.name);
      if (!catTotals[name]) catTotals[name] = { color: row.color || '#5b6ef5', total: 0 };
      catTotals[name].total += Number(row.total);
    }
    const top5 = Object.entries(catTotals).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    const series = top5.map(([name, { color }]) => ({ name, color }));
    const monthMap: Record<string, Record<string, number>> = {};
    for (const row of stats.categoryMoM) {
      const key = `${MONTHS[Number(row.month) - 1]} '${String(row.year).slice(2)}`;
      if (!monthMap[key]) monthMap[key] = {};
      const name = translateCategory(row.name);
      if (series.find(s => s.name === name)) monthMap[key][name] = (monthMap[key][name] || 0) + Number(row.total);
    }
    const data: Record<string, string | number>[] = Object.entries(monthMap).map(([label, vals]) => ({ label, ...vals }));
    return { series, data };
  }, [stats]);

  // Transaction frequency — count per day this month
  const txFreqData = useMemo(() => {
    if (!stats) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayMap: Record<number, { expenses: number; income: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) dayMap[d] = { expenses: 0, income: 0 };
    for (const row of stats.txFrequency) {
      const d = Number(row.day);
      if (row.type === 'expense') dayMap[d].expenses = Number(row.count);
      else dayMap[d].income = Number(row.count);
    }
    return Object.entries(dayMap).map(([d, v]) => ({ day: Number(d), ...v, total: v.expenses + v.income }));
  }, [stats, month, year]);

  // Top 5 biggest expense transactions this month
  const biggestTxs = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'expense')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
  }, [transactions]);

  // Average transaction size by category
  const avgTxByCategory = useMemo(() => {
    const catMap: Record<string, { rawName: string; name: string; color: string; total: number; count: number }> = {};
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const key = tx.category_name || 'Uncategorised';
      if (!catMap[key]) catMap[key] = { rawName: key, name: translateCategory(key), color: tx.category_color || '#5b6ef5', total: 0, count: 0 };
      catMap[key].total += Number(tx.amount);
      catMap[key].count += 1;
    }
    return Object.values(catMap)
      .map(c => ({ ...c, avg: Math.round(c.total / c.count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 6);
  }, [transactions]);

  const budgetProgress = useMemo(() => budgets.map(b => {
    const amount = Number(b.amount), spent = Number(b.spent);
    return { name: translateCategory(b.category_name), amount, spent, available: Math.max(0, amount - spent), used: amount > 0 ? Math.min(100, spent/amount*100) : 0, color: b.category_color || '#5b6ef5' };
  }), [budgets]);

  const dayOfMonth = month === now.getMonth()+1 && year === now.getFullYear() ? now.getDate() : new Date(year,month,0).getDate();
  const burnRate = stats ? stats.expenses / dayOfMonth : 0;
  const projectedExpense = burnRate * new Date(year, month, 0).getDate();
  const currentCash = stats ? stats.income - stats.expenses : 0;
  const paydayDate = settings.payday;
  const nextPayday = (() => {
    const d = new Date();
    const daysInThisMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const effectivePayday = Math.min(paydayDate, daysInThisMonth);
    const p = new Date(d.getFullYear(), d.getMonth(), effectivePayday);
    if (d.getDate() <= effectivePayday) return p;
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(paydayDate, daysInNextMonth));
  })();
  const daysUntilPayday = Math.max(1, Math.ceil((nextPayday.getTime() - now.getTime()) / 86400000));
  const dailySafeSpend = currentCash / daysUntilPayday;
  const savingsRate = stats && stats.income > 0 ? Math.round((stats.savings / stats.income) * 100) : 0;

  const STAT_CARDS = stats ? [
    { label: 'Monthly Spending',    value: fmt(stats.expenses),    sub: 'Total expenses tracked',     color: 'var(--red)'    },
    { label: 'Daily Burn Rate',     value: `${fmt(burnRate)}/d`,   sub: 'Average daily spend',        color: 'var(--amber)'  },
    { label: 'Projected Month-end', value: fmt(projectedExpense),  sub: 'Estimated total spend',      color: 'var(--purple)' },
    { label: 'Savings Rate',        value: `${savingsRate}%`,      sub: 'Of total income saved',      color: savingsRate >= 20 ? 'var(--green)' : 'var(--amber)' },
  ] : null;

  // Drill-down modal: resolves which transactions to show based on modal type
  const modalTxs = useMemo(() => {
    if (!detailModal) return [];
    if (detailModal.type === 'merchant') {
      const key = detailModal.name.toLowerCase();
      return transactions.filter(tx => merchantName(tx.description).toLowerCase() === key);
    }
    if (detailModal.type === 'category') {
      return transactions.filter(tx => tx.type === 'expense' && (tx.category_name || 'Uncategorised') === detailModal.name);
    }
    if (detailModal.type === 'group') {
      return transactions.filter(tx => tx.type === 'expense' && groupCategory(tx.category_name) === detailModal.name);
    }
    return [];
  }, [detailModal, transactions]);

  const DrillModal = detailModal ? (() => {
    const title =
      detailModal.type === 'merchant' ? detailModal.name :
      detailModal.type === 'category' ? translateCategory(detailModal.name) :
      detailModal.type === 'group'    ? `${detailModal.name} group` : '';
    const total = modalTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return createPortal(
      <>
        <div onClick={() => setDetailModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 50, width: '100%', maxWidth: 480, maxHeight: '75vh', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 48px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideInUp 0.22s cubic-bezier(0.34,1.2,0.64,1) both' }}>
          <div style={{ padding: '12px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 12px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {modalTxs.length} transaction{modalTxs.length !== 1 ? 's' : ''}
                  {total > 0 && <> · <span style={{ color: 'var(--red)' }}>{fmt(total)} total</span></>}
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '4px 9px', borderRadius: 7, lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {modalTxs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No transactions found</div>
            ) : modalTxs.map(tx => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tx.category_color || '#5b6ef5', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'No description'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{translateCategory(tx.category_name) || 'Uncategorised'} · {tx.date_str || tx.date?.slice(0,10)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', flexShrink: 0, marginLeft: 12 }}>
                  {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>,
      document.body
    );
  })() : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {DrillModal}
      {/* Header */}
      <div className="animate-fadeUp" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Smart financial insights & trends</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 96, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80, fontSize: 13 }}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards — staggered */}
      <div className="an-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`animate-fadeUp stagger-${i + 1}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <Skeleton w={80} h={10} />
            <div style={{ marginTop: 12 }}><Skeleton w={110} h={22} /></div>
            <div style={{ marginTop: 8 }}><Skeleton w={140} h={9} /></div>
          </div>
        )) : STAT_CARDS?.map(({ label, value, sub, color }, i) => (
          <div key={label} className={`animate-fadeUp stagger-${i + 1}`} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 22,
            transition: 'border-color 0.2s ease, transform 0.18s ease, box-shadow 0.18s ease',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{sub}</div>
          </div>
        ))}
      </div>


      {/* Payday Survival */}
      <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Payday Survival Budget</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Next payday: {nextPayday.toLocaleDateString(undefined, { month:'long', day:'numeric' })} · {daysUntilPayday} days away</div>
          </div>
          <div style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, background: daysUntilPayday <= 5 ? 'var(--red-muted)' : 'var(--surface-2)', color: daysUntilPayday <= 5 ? 'var(--red)' : 'var(--text-muted)', border: `1px solid ${daysUntilPayday <= 5 ? 'rgba(240,82,82,0.25)' : 'var(--border)'}`, fontWeight: 600 }}>
            {daysUntilPayday} days left
          </div>
        </div>
        <div className="an-payday-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Safe to spend per day</div>
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.05em', color: currentCash >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {stats ? fmt(dailySafeSpend) : '—'}
            </div>
          </div>
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Available cash</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em', color: currentCash >= 0 ? 'var(--text)' : 'var(--red)' }}>{stats ? fmt(currentCash) : '—'}</div>
          </div>
        </div>
        {stats && currentCash < 0 && (
          <div className="animate-slideInUp" style={{ marginTop: 14, padding: '10px 14px', borderRadius: 9, background: 'var(--red-muted)', border: '1px solid rgba(240,82,82,0.25)', fontSize: 12, color: 'var(--red)' }}>
            Expenses exceed income this period. Reduce spending or add income transactions.
          </div>
        )}
      </div>

      {/* Spending Breakdown + Merchant */}
      <div className="an-grid-main" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Income vs Expenses</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Where your money went this month</div>
          {loading ? <Skeleton h={220} r={10} /> : stats ? (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer key={chartKey} width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Expenses', value: stats.expenses, color: '#f05252' },
                        { name: 'Savings', value: Math.max(0, stats.income - stats.expenses), color: '#22d47a' },
                      ]}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={62} outerRadius={92}
                      paddingAngle={stats.expenses > 0 && stats.income > stats.expenses ? 3 : 0}
                      startAngle={90} endAngle={-270}
                      isAnimationActive animationDuration={900} animationEasing="ease-out"
                    >
                      <Cell fill="#f05252" />
                      <Cell fill="#22d47a" />
                    </Pie>
                    <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>saved</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em', color: stats.income > 0 && stats.expenses < stats.income ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
                    {stats.income > 0 ? `${Math.round(Math.max(0, (stats.income - stats.expenses) / stats.income) * 100)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>of income</div>
                </div>
              </div>

              {/* Stat rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                {[
                  { label: 'Income', value: stats.income, color: '#22d47a', pct: 100 },
                  { label: 'Expenses', value: stats.expenses, color: '#f05252', pct: stats.income > 0 ? (stats.expenses / stats.income) * 100 : 0 },
                  { label: 'Net Savings', value: stats.income - stats.expenses, color: stats.income >= stats.expenses ? '#22d47a' : '#f05252', pct: stats.income > 0 ? Math.abs((stats.income - stats.expenses) / stats.income) * 100 : 0 },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: row.label === 'Net Savings' ? row.color : 'var(--text)' }}>
                      {row.label === 'Net Savings' && row.value >= 0 ? '+' : row.label === 'Net Savings' ? '' : ''}{fmt(row.value)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>{Math.round(row.pct)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</p>
            </div>
          )}
        </div>

        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Top Merchants</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Where you spend the most</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({length:5}).map((_,i) => <Skeleton key={i} h={44} r={9} />)}
            </div>
          ) : merchantData.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {merchantData.map((m, i) => {
                const maxVal = merchantData[0].total;
                return (
                  <div key={m.name} className={`animate-slideInLeft stagger-${i+1}`}
                    onClick={() => setDetailModal({ type: 'merchant', name: m.name })}
                    style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', transition: 'transform 0.15s, border-color 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red)', fontWeight: 600 }}>{fmt(m.total)}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-3)' }}>
                      <div className="bar-animated" style={{ height: '100%', borderRadius: 99, background: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length], width: `${(m.total/maxVal)*100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No expense data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Trends + Budget */}
      <div className="an-grid-main" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>{trendView === 'mom' ? 'Month-over-Month Trends' : 'Day-over-Day Trends'}</div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>View</label>
              <select
                value={trendView}
                onChange={e => handleTrendViewChange(e.target.value as 'mom'|'dod')}
                style={{ width: 190, fontSize: 13, marginLeft: 10 }}
              >
                <option value="mom">Month-over-Month</option>
                <option value="dod">Day-over-Day (this month)</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{trendView === 'mom' ? 'Income & expenses with net savings (last 6 months)' : 'Income & expenses by day of week (this month)'}</div>
          {loading ? <Skeleton h={220} r={10} /> : (
            <ResponsiveContainer key={chartKey} width="100%" height={220}>
              <LineChart data={trendView === 'mom' ? trendData : dodData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey={trendView === 'mom' ? 'month' : 'day'} stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="income"   stroke="#22d47a" strokeWidth={2} name="Income"   dot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                <Line type="monotone" dataKey="expenses" stroke="#f05252" strokeWidth={2} name="Expenses" dot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                <Line type="monotone" dataKey="net"      stroke="#5b6ef5" strokeWidth={2} strokeDasharray="5 4" name="Net" dot={false} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[{c:'#22d47a',l:'Income'},{c:'#f05252',l:'Expenses'},{c:'#5b6ef5',l:'Net'}].map(({c,l}) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 14, height: 2, background: c, borderRadius: 2 }} />{l}
              </div>
            ))}
          </div>
        </div>

        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Budget Tracking</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Progress vs limits</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Array.from({length:3}).map((_,i) => <Skeleton key={i} h={50} r={9}/>)}
            </div>
          ) : budgetProgress.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {budgetProgress.map((b, i) => {
                const over = b.used >= 100;
                const warn = !over && b.used >= 80;
                return (
                  <div key={b.name} className={`animate-fadeUp stagger-${i+1}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--text-muted)' }}>{Math.round(b.used)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div className="bar-animated" style={{ height: '100%', borderRadius: 99, width: `${b.used}%`, background: over ? 'var(--red)' : warn ? 'var(--amber)' : b.color }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{fmt(b.spent)} of {fmt(b.amount)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Add budgets to see progress here</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily Spend Bars + Cumulative */}
      <div className="an-grid-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Daily Spending</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Expense amount for each day this month</div>
          {loading ? <Skeleton h={180} r={10} /> : (
            <ResponsiveContainer key={chartKey} width="100%" height={180}>
              <BarChart data={dailyBarData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} interval={4} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} labelFormatter={l => `Day ${l}`} />
                <Bar dataKey="expenses" name="Expenses" fill="#f05252" radius={[3,3,0,0]} isAnimationActive animationDuration={800} />
                <Bar dataKey="income" name="Income" fill="#22d47a" radius={[3,3,0,0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            {[{c:'#f05252',l:'Expenses'},{c:'#22d47a',l:'Income'}].map(({c,l}) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Cumulative Spend vs Ideal</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Actual running total vs even-spend target</div>
          {loading ? <Skeleton h={180} r={10} /> : (
            <ResponsiveContainer key={chartKey} width="100%" height={180}>
              <AreaChart data={cumulativeData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f05252" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f05252" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradIdeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b6ef5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#5b6ef5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} interval={4} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} labelFormatter={l => `Day ${l}`} />
                <Area type="monotone" dataKey="ideal" name="Ideal pace" stroke="#5b6ef5" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradIdeal)" dot={false} isAnimationActive animationDuration={900} connectNulls />
                <Area type="monotone" dataKey="actual" name="Actual spend" stroke="#f05252" strokeWidth={2} fill="url(#gradActual)" dot={false} isAnimationActive animationDuration={900} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            {[{c:'#f05252',l:'Actual'},{c:'#5b6ef5',l:'Ideal pace'}].map(({c,l}) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 14, height: 2, background: c, borderRadius: 2 }} />{l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Bars + Radar */}
      <div className="an-grid-main" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Spending by Category</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Top categories ranked by expense amount</div>
          {loading ? <Skeleton h={220} r={10} /> : categoryBarData.length ? (
            <ResponsiveContainer key={chartKey} width="100%" height={220}>
              <BarChart data={categoryBarData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <YAxis type="category" dataKey="name" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} width={90} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="total" name="Spent" radius={[0,4,4,0]} isAnimationActive animationDuration={800}
                  onClick={(data) => {
                    const name = (data as { name?: string }).name;
                    const entry = categoryBarData.find(c => c.name === name);
                    if (entry) setDetailModal({ type: 'category', name: entry.rawName || entry.name, color: entry.color || '#5b6ef5' });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {categoryBarData.map((entry, i) => <Cell key={i} fill={entry.color || '#5b6ef5'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No category data yet</p>
            </div>
          )}
        </div>

        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Spending by Group</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>% of income per spending group</div>
          {loading ? <Skeleton h={220} r={10} /> : radarData.length && radarData.some(d => d.value > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 8 }}>
              {radarData.map((item, i) => {
                const colors = ['#f05252', '#5b6ef5', '#22d47a', '#f5a623'];
                const pct = Math.min(item.value, 100);
                return (
                  <div key={item.subject}
                    onClick={() => item.value > 0 && setDetailModal({ type: 'group', name: item.subject })}
                    style={{ cursor: item.value > 0 ? 'pointer' : 'default' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{item.subject}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: colors[i] }}>{item.value}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, width: `${pct}%`,
                        background: `linear-gradient(90deg, ${colors[i]}cc, ${colors[i]})`,
                        transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {fmt(radarData[i].value * (stats?.income || 0) / 100)} of income
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Add income & expenses to see balance</p>
            </div>
          )}
        </div>
      </div>

      {/* Waterfall + Savings Trend */}
      <div className="an-grid-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Income Waterfall</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>How income flows into expenses and net savings</div>
          {loading ? <Skeleton h={200} r={10} /> : waterfallData.length ? (
            <ResponsiveContainer key={chartKey} width="100%" height={200}>
              <BarChart data={waterfallData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null;
                    const valueEntry = payload.find(p => p.dataKey === 'value');
                    if (!valueEntry || Number(valueEntry.value) === 0) return null;
                    return (
                      <div style={TOOLTIP_STYLE as React.CSSProperties}>
                        <div style={{ padding: '6px 10px', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                          <div>{fmt(Number(valueEntry.value))}</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="base" stackId="w" fill="rgba(0,0,0,0)" stroke="none" isAnimationActive={false} legendType="none" />
                <Bar dataKey="value" stackId="w" name="Amount" radius={[4,4,0,0]} isAnimationActive animationDuration={850}>
                  {waterfallData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</p>
            </div>
          )}
        </div>

        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Savings Trend</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Income, expenses & net savings — last 6 months</div>
          {loading ? <Skeleton h={200} r={10} /> : trendData.length ? (
            <ResponsiveContainer key={chartKey} width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d47a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22d47a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f05252" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f05252" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b6ef5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5b6ef5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Area type="monotone" dataKey="income"   name="Income"   stroke="#22d47a" strokeWidth={2} fill="url(#gradIncome)"   dot={false} isAnimationActive animationDuration={900} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f05252" strokeWidth={2} fill="url(#gradExpenses)" dot={false} isAnimationActive animationDuration={900} />
                <Area type="monotone" dataKey="net"      name="Net"      stroke="#5b6ef5" strokeWidth={2} fill="url(#gradNet)"      dot={false} isAnimationActive animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No trend data yet</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            {[{c:'#22d47a',l:'Income'},{c:'#f05252',l:'Expenses'},{c:'#5b6ef5',l:'Net'}].map(({c,l}) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 14, height: 2, background: c, borderRadius: 2 }} />{l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spending Heatmap */}
      <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Spending Heatmap</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tap a day to inspect</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Daily expense intensity for {MONTHS[month-1]} {year}</div>
        {loading ? <Skeleton h={120} r={10} /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
              {DAYS_OF_WEEK.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {(heatmapData.cells || []).map((cell, i) => {
                const isSelected = selectedDay === cell.day;
                return (
                  <div key={i}
                    onClick={() => cell.day && setSelectedDay(isSelected ? null : cell.day)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 5,
                      background: cell.day === null
                        ? 'transparent'
                        : cell.value === 0
                          ? 'var(--surface-2)'
                          : `rgba(240,82,82,${0.12 + cell.intensity * 0.88})`,
                      border: isSelected
                        ? '2px solid #5b6ef5'
                        : cell.day ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: cell.day ? 'pointer' : 'auto',
                      transition: 'transform 0.1s, border-color 0.15s',
                      position: 'relative',
                      boxShadow: isSelected ? '0 0 0 3px rgba(91,110,245,0.25)' : 'none',
                    }}
                    onMouseEnter={e => { if (cell.day) (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                  >
                    {cell.day && <span style={{ fontSize: 10, color: isSelected ? '#fff' : cell.intensity > 0.5 ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)', fontWeight: 600, pointerEvents: 'none' }}>{cell.day}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Low</span>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                <div key={v} style={{ width: 16, height: 16, borderRadius: 3, background: `rgba(240,82,82,${0.12 + v * 0.88})` }} />
              ))}
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>High</span>
            </div>

            {/* Day detail modal */}
            {selectedDay !== null && (() => {
              // Use date_str (YYYY-MM-DD from server) — no JS timezone parsing
              const targetStr = `${year}-${String(month).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
              const dayTxs = transactions.filter(tx => (tx.date_str || tx.date?.slice(0,10)) === targetStr);
              const dayTotal = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
              const dow = new Date(year, month - 1, selectedDay).toLocaleDateString('en-US', { weekday: 'long' });
              return createPortal(
                <>
                  {/* Backdrop */}
                  <div onClick={() => setSelectedDay(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
                  {/* Modal */}
                  <div style={{
                    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 50, width: '100%', maxWidth: 480, maxHeight: '75vh',
                    background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '20px 20px 0 0',
                    boxShadow: '0 -8px 48px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', animation: 'slideInUp 0.22s cubic-bezier(0.34,1.2,0.64,1) both',
                  }}>
                    {/* Header */}
                    <div style={{ padding: '12px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 12px' }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{dow}, {MONTHS[month-1]} {selectedDay}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            {dayTxs.length} transaction{dayTxs.length !== 1 ? 's' : ''}
                            {dayTotal > 0 && <> · <span style={{ color: 'var(--red)' }}>{fmt(dayTotal)} spent</span></>}
                          </div>
                        </div>
                        <button onClick={() => setSelectedDay(null)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '4px 9px', borderRadius: 7, lineHeight: 1 }}>✕</button>
                      </div>
                    </div>
                    {/* Body */}
                    <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dayTxs.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No transactions on this day</div>
                      ) : dayTxs.map(tx => (
                        <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: tx.category_color || '#5b6ef5', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'No description'}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tx.category_name || 'Uncategorised'}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', flexShrink: 0, marginLeft: 12 }}>
                            {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>,
                document.body
              );
            })()}
          </>
        )}
      </div>

      {/* Budget vs Actual + Weekday Pattern */}
      <div className="an-grid-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Budget vs Actual</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Side-by-side budget limit and actual spend per category</div>
          {loading ? <Skeleton h={200} r={10} /> : budgetVsActual.length ? (
            <ResponsiveContainer key={chartKey} width="100%" height={200}>
              <BarChart data={budgetVsActual} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={3} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="budget" name="Budget" fill="rgba(91,110,245,0.3)" stroke="#5b6ef5" strokeWidth={1} radius={[3,3,0,0]} isAnimationActive animationDuration={800} />
                <Bar dataKey="actual" name="Actual" radius={[3,3,0,0]} isAnimationActive animationDuration={800}>
                  {budgetVsActual.map((entry, i) => (
                    <Cell key={i} fill={entry.actual > entry.budget ? '#f05252' : entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Add budgets to compare here</p>
            </div>
          )}
          {budgetVsActual.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
              {[{c:'rgba(91,110,245,0.4)',l:'Budget'},{c:'#22d47a',l:'Actual'}].map(({c,l}) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Weekday Spending Pattern</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Average daily expense by day of week (all time)</div>
          {loading ? <Skeleton h={200} r={10} /> : weekdayPatternData.some(d => d.avg > 0) ? (
            <ResponsiveContainer key={chartKey} width="100%" height={200}>
              <BarChart data={weekdayPatternData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} labelFormatter={l => `${l}s`} />
                <Bar dataKey="avg" name="Avg spend" radius={[4,4,0,0]} isAnimationActive animationDuration={800}>
                  {(() => {
                    const maxAvg = Math.max(...weekdayPatternData.map(d => d.avg), 1);
                    return weekdayPatternData.map((entry, i) => (
                      <Cell key={i} fill={`rgba(245,166,35,${0.3 + (entry.avg / maxAvg) * 0.7})`} />
                    ));
                  })()}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>More transaction history needed</p>
            </div>
          )}
        </div>
      </div>

      {/* Biggest Transactions + Avg Tx by Category */}
      <div className="an-grid-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Biggest single transactions */}
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Biggest Transactions</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Top 5 largest expenses this month</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({length:5}).map((_,i) => <Skeleton key={i} h={52} r={9} />)}
            </div>
          ) : biggestTxs.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {biggestTxs.map((tx, i) => {
                const maxAmt = Number(biggestTxs[0].amount);
                const pct = (Number(tx.amount) / maxAmt) * 100;
                return (
                  <div key={tx.id}
                    onClick={() => setDetailModal({ type: 'merchant', name: merchantName(tx.description) })}
                    style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    {/* background fill bar */}
                    <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(240,82,82,0.07)', borderRadius: 10, transition: 'width 0.8s ease' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, width: 20, textAlign: 'center' }}>#{i+1}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'No description'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tx.category_color || '#5b6ef5', flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{translateCategory(tx.category_name) || 'Uncategorised'}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tx.date_str || tx.date?.slice(0,10)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--red)', flexShrink: 0 }}>−{fmt(Number(tx.amount))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No expenses this month yet</p>
            </div>
          )}
        </div>

        {/* Average transaction size by category */}
        <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Avg Transaction by Category</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>How much you typically spend per transaction</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({length:5}).map((_,i) => <Skeleton key={i} h={52} r={9} />)}
            </div>
          ) : avgTxByCategory.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {avgTxByCategory.map((cat) => {
                const maxAvg = avgTxByCategory[0].avg;
                const pct = (cat.avg / maxAvg) * 100;
                return (
                  <div key={cat.name}
                    onClick={() => setDetailModal({ type: 'category', name: cat.rawName, color: cat.color })}
                    style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: `${cat.color}14`, borderRadius: 10, transition: 'width 0.8s ease' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{cat.count} transaction{cat.count !== 1 ? 's' : ''} · {fmt(cat.total)} total</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{fmt(cat.avg)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>per txn</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '52px 0' }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No expense transactions yet</p>
            </div>
          )}
        </div>

      </div>

      {/* Transaction Frequency */}
      <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Transaction Frequency</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Number of transactions per day this month</div>
        {loading ? <Skeleton h={160} r={10} /> : txFreqData.some(d => d.total > 0) ? (
          <>
            <ResponsiveContainer key={chartKey} width="100%" height={160}>
              <BarChart data={txFreqData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }} barSize={7} barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} interval={4} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={10} allowDecimals={false} />
                <Tooltip formatter={v => [`${v} txn`, '']} contentStyle={TOOLTIP_STYLE} labelFormatter={l => `Day ${l}`} />
                <Bar dataKey="expenses" name="Expenses" stackId="a" fill="#f05252" radius={[0,0,0,0]} isAnimationActive animationDuration={800} />
                <Bar dataKey="income" name="Income" stackId="a" fill="#22d47a" radius={[3,3,0,0]} isAnimationActive animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
              {[{c:'#f05252',l:'Expense txns'},{c:'#22d47a',l:'Income txns'}].map(({c,l}) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0' }}>
            <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No transactions this month yet</p>
          </div>
        )}
      </div>

      {/* Monthly Summary */}
      <div className="scroll-reveal" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 18 }}>Monthly Summary</div>
        <div className="an-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {loading ? Array.from({length:4}).map((_,i) => <Skeleton key={i} h={72} r={10}/>) :
            [
              { label: 'Total Income',    value: stats ? fmt(stats.income) : '—',   color: 'var(--green)' },
              { label: 'Total Expenses',  value: stats ? fmt(stats.expenses) : '—', color: 'var(--red)'   },
              { label: 'Net Balance',     value: stats ? fmt(stats.balance) : '—',  color: 'var(--text)'  },
              { label: 'Savings Rate',    value: `${savingsRate}%`,                 color: savingsRate >= 20 ? 'var(--green)' : savingsRate >= 10 ? 'var(--amber)' : 'var(--red)' },
            ].map(({ label, value, color }, i) => (
              <div key={label} className={`animate-fadeUp stagger-${i+1}`} style={{ padding: '16px 18px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', transition: 'transform 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)', color }}>{value}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}