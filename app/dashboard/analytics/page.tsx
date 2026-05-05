'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

const BREAKDOWN_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'];

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCompact(n: number) {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(n);
  } catch {
    return String(n);
  }
}

function translateCategory(name: string) {
  return CATEGORY_TRANSLATIONS[name] ?? name;
}

function groupCategory(name: string) {
  const translated = translateCategory(name);
  const essentials = ['Rent & Housing', 'Bills & Utilities', 'Phone & Internet', 'Transport & Rideshare', 'Health', 'Education'];
  const lifestyle = ['Food & Drink', 'Shopping', 'Entertainment', 'Other'];
  const savings = ['Savings & Investment'];
  if (essentials.includes(translated)) return 'Essentials';
  if (lifestyle.includes(translated)) return 'Lifestyle';
  if (savings.includes(translated)) return 'Savings';
  return 'Other';
}

function merchantName(description?: string) {
  if (!description) return 'Unknown';
  const text = description.trim();
  const atMatch = text.match(/(?:at|@)\s*([^\-|,|–|:]+)/i);
  if (atMatch) return atMatch[1].trim();
  const split = text.split(/[-–|:|@]/).map((part) => part.trim()).filter(Boolean);
  return split[0] || text;
}

export default function AnalyticsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<null | {
    income: number;
    expenses: number;
    savings: number;
    balance: number;
    byCategory: { name: string; color: string; total: string }[];
    trend: { month: number; year: number; type: string; total: string }[];
  }>(null);
  const [transactions, setTransactions] = useState<Array<{ id: number; amount: number; type: string; description: string; date: string; category_name: string; category_color: string }>>([]);
  const [budgets, setBudgets] = useState<Array<{ id: number; amount: string; spent: string; category_name: string; category_color: string }>>([]);

  const load = useCallback(async () => {
    try {
      const [statsData, txData, budgetData] = await Promise.all([
        api.getStats({ month: String(month), year: String(year) }),
        api.getTransactions({ month: String(month), year: String(year), limit: '100' }),
        api.getBudgets({ month: String(month), year: String(year) }),
      ]);
      setStats(statsData);
      setTransactions(txData);
      setBudgets(budgetData);
    } catch (error) {
      console.error(error);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const spendingBreakdown = useMemo(() => {
    if (!stats) return [];
    const groups: Record<string, number> = { Essentials: 0, Lifestyle: 0, Savings: 0, Other: 0 };
    for (const item of stats.byCategory) {
      const group = groupCategory(item.name);
      groups[group] += Number(item.total);
    }
    return Object.entries(groups)
      .map(([name, total], index) => ({ name, total, color: BREAKDOWN_COLORS[index] }))
      .filter((item) => item.total > 0);
  }, [stats]);

  const merchantData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions.filter((tx) => tx.type === 'expense')) {
      const merchant = merchantName(tx.description);
      map.set(merchant, (map.get(merchant) || 0) + Number(tx.amount));
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [transactions]);

  const dayOfMonth = month === now.getMonth() + 1 && year === now.getFullYear() ? now.getDate() : new Date(year, month, 0).getDate();
  const burnRate = stats ? stats.expenses / dayOfMonth : 0;
  const projectedExpense = burnRate * new Date(year, month, 0).getDate();

  const currentCash = stats ? stats.income - stats.expenses : 0;
  const nextPayday = (() => {
    const today = new Date();
    const thisMonthPayday = new Date(today.getFullYear(), today.getMonth(), 25);
    return today.getDate() <= 25 ? thisMonthPayday : new Date(today.getFullYear(), today.getMonth() + 1, 25);
  })();
  const daysUntilPayday = Math.max(1, Math.ceil((nextPayday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const dailySafeSpend = currentCash / daysUntilPayday;
  const nextPaydayLabel = nextPayday.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  const cashFlowData = stats
    ? [
        { label: 'Income', value: stats.income, color: '#22c55e' },
        { label: 'Expenses', value: stats.expenses, color: '#ef4444' },
        { label: 'Net Savings', value: stats.savings, color: '#f59e0b' },
      ]
    : [];

  const trendData = useMemo(() => {
    if (!stats) return [];
    const map: Record<string, { month: string; income: number; expenses: number; net: number }> = {};
    for (const row of stats.trend) {
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!map[key]) map[key] = { month: MONTHS[row.month - 1], income: 0, expenses: 0, net: 0 };
      if (row.type === 'income') map[key].income = Number(row.total);
      else map[key].expenses = Number(row.total);
    }
    return Object.values(map).map((item) => ({ ...item, net: item.income - item.expenses }));
  }, [stats]);

  const budgetProgress = useMemo(() => {
    return budgets.map((budget) => {
      const amount = Number(budget.amount);
      const spent = Number(budget.spent);
      const used = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
      return {
        name: budget.category_name,
        amount,
        spent,
        available: Math.max(0, amount - spent),
        used,
        color: budget.category_color || '#6366f1',
      };
    });
  }, [budgets]);

  const topBudgetAlert = useMemo(() => {
    if (!budgetProgress.length || !stats) return null;
    const target = budgetProgress.find((item) => item.used >= 80) || budgetProgress[0];
    if (!target) return null;
    const daysRemaining = new Date(year, month, 0).getDate() - dayOfMonth;
    const dailySpend = burnRate;
    const projected = target.spent + dailySpend * daysRemaining;
    const willExceed = projected > target.amount;
    return {
      category: target.name,
      used: target.used,
      willExceed,
      projectedDate: willExceed ? '20th' : null,
      remaining: target.available,
    };
  }, [budgetProgress, burnRate, dayOfMonth, month, year, stats]);

  const yearSummary = useMemo(() => {
    if (!stats) return null;
    return {
      income: stats.income,
      expenses: stats.expenses,
      savings: stats.savings,
      balance: stats.balance,
      savingsRate: stats.income > 0 ? Math.round((stats.savings / stats.income) * 100) : 0,
    };
  }, [stats]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Smart financial insights with spending, cash flow, budgets, and trends.
          </p>
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-32">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Monthly Spending</p>
          <p className="text-2xl font-bold">{stats ? fmt(stats.expenses) : '-'}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Total expense tracked for the selected month.</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Burn Rate</p>
          <p className="text-2xl font-bold">{stats ? fmt(burnRate) : '-'} / day</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Average daily spending so far in the month.</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Projected End Spend</p>
          <p className="text-2xl font-bold">{stats ? fmt(projectedExpense) : '-'}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Estimated spend by the end of the month.</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Savings Rate</p>
          <p className="text-2xl font-bold">{stats ? `${yearSummary?.savingsRate}%` : '-'}</p>
        </div>
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm">Payday Survival Budget</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Based on your next payday on {nextPaydayLabel} and current cash flow.
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{daysUntilPayday} days until payday</span>
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <p className="text-4xl font-bold" style={{ color: currentCash >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {stats ? fmt(dailySafeSpend) : '-'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>recommended spending per day</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Estimated available cash</p>
            <p className="text-lg font-semibold">{stats ? fmt(currentCash) : '-'}</p>
          </div>
        </div>
        {stats && currentCash < 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--red)' }}>
            Your current estimate is negative. Reduce spending and update your records to avoid running out before payday.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm">Spending Breakdown</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Where your money went this month.</p>
            </div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Essentials / Lifestyle / Savings</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={spendingBreakdown}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                labelLine={false}
              >
                {spendingBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {spendingBreakdown.map((item) => (
              <div key={item.name} className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span>{item.name}</span>
                  <span>{Math.round((item.total / (stats?.expenses || 1)) * 100)}%</span>
                </div>
                <p className="text-sm font-semibold">{fmt(item.total)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm mb-4">Merchant Analysis</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={merchantData} margin={{ left: 24, right: 0, top: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                interval={0}
                height={70}
                tick={{ fontSize: 11, angle: -35, textAnchor: 'end', dy: 10 }}
              />
              <YAxis
                stroke="var(--text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => fmt(Number(value))}
              />
              <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#4f46e5" cursor="transparent" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-3">
            {merchantData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{item.name}</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmt(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-xl p-6 col-span-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm">Income vs Expenses</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Compare cash flow for the current month.</p>
            </div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Actuals</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cashFlowData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <XAxis dataKey="label" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} tickFormatter={(value) => fmtCompact(Number(value))} />
              <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#22c55e" cursor="transparent" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm mb-4">Predictive Alerts</h2>
          {topBudgetAlert ? (
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold">{topBudgetAlert.category} budget review</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                You have used {Math.round(topBudgetAlert.used)}% of your {topBudgetAlert.category} budget.
              </p>
              <p className="text-xs mt-3" style={{ color: topBudgetAlert.willExceed ? 'var(--red)' : 'var(--green)' }}>
                {topBudgetAlert.willExceed
                  ? `At the current rate, you may exceed this budget by the 20th.`
                  : `Spending is on track for this budget.`}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Remaining budget: {fmt(topBudgetAlert.remaining)}
              </p>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No budget warnings available yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-xl p-6 col-span-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm">Month-over-Month Trends</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Track how income and spending evolve.</p>
            </div>
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 10, right: 6, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} tickFormatter={(value) => fmtCompact(Number(value))} />
              <Tooltip formatter={(value) => fmt(Number(value))} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm mb-4">Budget Tracking</h2>
          <div className="space-y-4">
            {budgetProgress.length ? budgetProgress.map((budget) => (
              <div key={budget.name}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span>{budget.name}</span>
                  <span>{Math.round(budget.used)}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${budget.used}%`, background: budget.color }} />
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Spent {fmt(budget.spent)} of {fmt(budget.amount)} ({fmt(budget.available)} left)
                </p>
              </div>
            )) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add budgets to see progress bars and alerts.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold text-sm mb-4">Yearly Review</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Income</p>
            <p className="text-lg font-semibold">{stats ? fmt(stats.income) : '-'}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Expenses</p>
            <p className="text-lg font-semibold">{stats ? fmt(stats.expenses) : '-'}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Net Worth Change</p>
            <p className="text-lg font-semibold">{stats ? fmt(stats.balance) : '-'}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Savings Rate</p>
            <p className="text-lg font-semibold">{yearSummary ? `${yearSummary.savingsRate}%` : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
