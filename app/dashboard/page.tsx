'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Stats {
  income: number; expenses: number; savings: number; balance: number;
  byCategory: { name: string; color: string; total: number }[];
  trend: { month: number; year: number; type: string; total: number }[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Transfer Masuk': 'Incoming Transfer',
  'Makan & Minum': 'Food & Drink',
  'Belanja': 'Shopping',
  'Tagihan & Utilitas': 'Bills & Utilities',
  'Pulsa & Internet': 'Phone & Internet',
  'Hiburan': 'Entertainment',
  'Kesehatan': 'Health',
  'Sewa & Kost': 'Rent & Housing',
  'Pendidikan': 'Education',
  'Tabungan & Investasi': 'Savings & Investment',
  'Lainnya': 'Other',
  'Transport & Ojol': 'Transport & Rideshare',
};

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentTx, setRecentTx] = useState<{ id: number; description: string; amount: number; type: string; date: string; category_name: string; category_color: string }[]>([]);

  const translateCategory = (name: string) => CATEGORY_TRANSLATIONS[name] ?? name;

  const load = useCallback(async () => {
    try {
      const [s, tx] = await Promise.all([
        api.getStats({ month: String(month), year: String(year) }),
        api.getTransactions({ month: String(month), year: String(year), limit: '8' }),
      ]);
      setStats(s);
      setRecentTx(tx);
    } catch (e) { console.error(e); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  // Build trend chart data
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

  const categoryData = stats?.byCategory ? [...stats.byCategory]
    .map(c => ({
      ...c,
      total: Number(c.total),
      name: CATEGORY_TRANSLATIONS[c.name] ?? c.name,
    }))
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 6) : [];

  const statCards = stats ? [
    { label: 'Income', value: fmt(stats.income), color: 'var(--green)', bg: '#22c55e15' },
    { label: 'Expenses', value: fmt(stats.expenses), color: 'var(--red)', bg: '#ef444415' },
    { label: 'Savings', value: fmt(stats.savings), color: 'var(--accent-2)', bg: '#6366f115' },
    { label: 'Net Balance', value: fmt(stats.balance), color: 'var(--amber)', bg: '#f59e0b15' },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your financial snapshot</p>
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-32">
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-xl font-bold font-mono" style={{ color }}>{value}</p>
            <div className="mt-3 h-1.5 rounded-full" style={{ background: bg }}>
              <div className="h-full rounded-full" style={{ background: color, width: '60%' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="col-span-2 rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm mb-6">Income vs Expenses — Last 6 Months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text)' }} formatter={(v) => fmt(Number(v))} />
              <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#gIncome)" name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#gExp)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by category pie chart */}
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm mb-4">Spending by Category</h2>
          {categoryData.length ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={4}
                    label={({ name }) => name}
                    labelLine={false}
                    stroke="#ffffff"
                    strokeWidth={1}
                    fill="#4f46e5"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || '#4f46e5'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {categoryData.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: c.color || '#4f46e5' }} />
                      <span style={{ color: 'var(--text-muted)' }}>{c.name}</span>
                    </div>
                    <span className="font-mono font-medium">{fmt(Number(c.total))}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No data yet</p>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm">Recent Transactions</h2>
        </div>
        {recentTx.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>No transactions this month</p>
        ) : (
          <div>
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: tx.category_color || 'var(--accent)' }}>
                    {translateCategory(tx.category_name)?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tx.description || 'No description'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {translateCategory(tx.category_name)} · {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="font-mono font-semibold text-sm" style={{ color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
