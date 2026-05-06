'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const BREAKDOWN_COLORS = ['#5b6ef5','#22d47a','#f5a623','#f05252'];

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n/1_000).toFixed(0)}K`;
  return String(n);
}
function groupCategory(name: string) {
  const t = translateCategory(name);
  const essentials = ['Rent & Housing','Bills & Utilities','Phone & Internet','Transport & Rideshare','Health','Education'];
  const savings = ['Savings & Investment'];
  if (essentials.includes(t)) return 'Essentials';
  if (savings.includes(t)) return 'Savings';
  if (['Food & Drink','Shopping','Entertainment'].includes(t)) return 'Lifestyle';
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
}

export default function AnalyticsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<StatsData | null>(null);
  const [transactions, setTransactions] = useState<{ id: number; amount: number; type: string; description: string; date: string; category_name: string; category_color: string }[]>([]);
  const [budgets, setBudgets] = useState<{ id: number; amount: string; spent: string; category_name: string; category_color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, tx, b] = await Promise.all([
        api.getStats({ month: String(month), year: String(year) }),
        api.getTransactions({ month: String(month), year: String(year), limit: '100' }),
        api.getBudgets({ month: String(month), year: String(year) }),
      ]);
      setStats(s); setTransactions(tx); setBudgets(b);
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
    const map: Record<string, { month: string; income: number; expenses: number; net: number }> = {};
    for (const row of stats.trend) {
      const key = `${row.year}-${String(row.month).padStart(2,'0')}`;
      if (!map[key]) map[key] = { month: MONTHS[row.month-1], income: 0, expenses: 0, net: 0 };
      if (row.type === 'income') map[key].income = Number(row.total);
      else map[key].expenses = Number(row.total);
    }
    return Object.values(map).map(item => ({ ...item, net: item.income - item.expenses }));
  }, [stats]);

  const budgetProgress = useMemo(() => budgets.map(b => {
    const amount = Number(b.amount), spent = Number(b.spent);
    return { name: translateCategory(b.category_name), amount, spent, available: Math.max(0, amount - spent), used: amount > 0 ? Math.min(100, spent/amount*100) : 0, color: b.category_color || '#5b6ef5' };
  }), [budgets]);

  const dayOfMonth = month === now.getMonth()+1 && year === now.getFullYear() ? now.getDate() : new Date(year,month,0).getDate();
  const burnRate = stats ? stats.expenses / dayOfMonth : 0;
  const projectedExpense = burnRate * new Date(year, month, 0).getDate();
  const currentCash = stats ? stats.income - stats.expenses : 0;
  const nextPayday = (() => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth(), 25); return d.getDate() <= 25 ? p : new Date(d.getFullYear(), d.getMonth()+1, 25); })();
  const daysUntilPayday = Math.max(1, Math.ceil((nextPayday.getTime() - now.getTime()) / 86400000));
  const dailySafeSpend = currentCash / daysUntilPayday;
  const savingsRate = stats && stats.income > 0 ? Math.round((stats.savings / stats.income) * 100) : 0;

  const STAT_CARDS = stats ? [
    { label: 'Monthly Spending', value: fmt(stats.expenses), sub: 'Total expenses tracked', color: 'var(--red)' },
    { label: 'Daily Burn Rate', value: `${fmt(burnRate)}/d`, sub: 'Average daily spend', color: 'var(--amber)' },
    { label: 'Projected Month-end', value: fmt(projectedExpense), sub: 'Estimated total spend', color: 'var(--purple)' },
    { label: 'Savings Rate', value: `${savingsRate}%`, sub: 'Of total income saved', color: savingsRate >= 20 ? 'var(--green)' : 'var(--amber)' },
  ] : null;

  const cardStyle = (color: string) => ({ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, borderLeft: `3px solid ${color}` });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Analytics</h1>
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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {loading ? Array.from({length:4}).map((_,i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <Skeleton w={80} h={10} /><div style={{marginTop:12}}><Skeleton w={110} h={22}/></div><div style={{marginTop:8}}><Skeleton w={140} h={9}/></div>
          </div>
        )) : STAT_CARDS?.map(({ label, value, sub, color }) => (
          <div key={label} style={cardStyle(color)}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color, fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Payday Survival */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Payday Survival Budget</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Next payday: {nextPayday.toLocaleDateString(undefined, { month:'long', day:'numeric' })} · {daysUntilPayday} days away</div>
          </div>
          <div style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, background: daysUntilPayday <= 5 ? 'var(--red-muted)' : 'var(--surface-2)', color: daysUntilPayday <= 5 ? 'var(--red)' : 'var(--text-muted)', border: `1px solid ${daysUntilPayday <= 5 ? 'rgba(240,82,82,0.25)' : 'var(--border)'}`, fontWeight: 600 }}>
            {daysUntilPayday} days left
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
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
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 9, background: 'var(--red-muted)', border: '1px solid rgba(240,82,82,0.25)', fontSize: 12, color: 'var(--red)' }}>
            ⚠ Expenses exceed income this period. Reduce spending or add income transactions.
          </div>
        )}
      </div>

      {/* Spending Breakdown + Merchant */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Spending Breakdown</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Essentials · Lifestyle · Savings · Other</div>
          {loading ? <Skeleton h={220} r={10} /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={spendingBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} startAngle={90} endAngle={-270}>
                    {spendingBreakdown.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginTop: 16 }}>
                {spendingBreakdown.map(item => (
                  <div key={item.name} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{item.name}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{Math.round((item.total / (stats?.expenses || 1)) * 100)}%</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{fmt(item.total)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
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
                  <div key={m.name} style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red)', fontWeight: 600 }}>{fmt(m.total)}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-3)' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length], width: `${(m.total/maxVal)*100}%` }} />
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

      {/* Trends + Budget Tracking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Month-over-Month Trends</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Income, expenses & net savings over time</div>
          {loading ? <Skeleton h={220} r={10} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} tickFormatter={v => fmtShort(Number(v))} />
                <Tooltip formatter={v => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="income" stroke="#22d47a" strokeWidth={2} name="Income" dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="#f05252" strokeWidth={2} name="Expenses" dot={false} />
                <Line type="monotone" dataKey="net" stroke="#5b6ef5" strokeWidth={2} strokeDasharray="5 4" name="Net" dot={false} />
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

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>Budget Tracking</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Progress vs limits</div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Array.from({length:3}).map((_,i) => <Skeleton key={i} h={50} r={9}/>)}
            </div>
          ) : budgetProgress.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {budgetProgress.map(b => {
                const over = b.used >= 100;
                const warn = !over && b.used >= 80;
                return (
                  <div key={b.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--text-muted)' }}>{Math.round(b.used)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${b.used}%`, background: over ? 'var(--red)' : warn ? 'var(--amber)' : b.color, transition: 'width 0.6s ease' }} />
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

      {/* Monthly Summary */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 18 }}>Monthly Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {loading ? Array.from({length:4}).map((_,i) => <Skeleton key={i} h={72} r={10}/>) : [
            { label: 'Total Income', value: stats ? fmt(stats.income) : '—', color: 'var(--green)' },
            { label: 'Total Expenses', value: stats ? fmt(stats.expenses) : '—', color: 'var(--red)' },
            { label: 'Net Balance', value: stats ? fmt(stats.balance) : '—', color: 'var(--text)' },
            { label: 'Savings Rate', value: `${savingsRate}%`, color: savingsRate >= 20 ? 'var(--green)' : savingsRate >= 10 ? 'var(--amber)' : 'var(--red)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '16px 18px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)', color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
