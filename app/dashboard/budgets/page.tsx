'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { useSettings } from '@/lib/SettingsContext';
import { showToast } from '@/components/Toast';

interface Budget {
  id: number;
  amount: number;
  spent: number;
  category_id: number;
  category_name: string;
  category_color: string;
  month: number;
  year: number;
}
interface Category { id: number; name: string; color: string; type: string; }
interface Transaction { id: number; amount: number; category_id: number; category_name: string; date: string; type: string; description: string; is_recurring?: boolean; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 6,
  letterSpacing: '0.02em', textTransform: 'uppercase',
};
const MODAL_STYLE: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.15s ease both',
};
const MODAL_BOX: React.CSSProperties = {
  width: '100%', maxWidth: 420, borderRadius: 20, background: 'var(--surface)',
  border: '1px solid var(--border-2)', padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
  animation: 'scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both', display: 'flex', flexDirection: 'column', gap: 16,
};

function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}

function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(pct, 100)), 100 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 99,
        width: `${width}%`,
        background: color,
        transition: 'width 0.9s cubic-bezier(0.34,1.05,0.64,1)',
        boxShadow: `0 0 8px ${color}66`,
      }} />
    </div>
  );
}

function HealthDot({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Watch Out' : 'At Risk';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );
}

export default function BudgetsPage() {
  const { fmt } = useSettings();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevBudgets, setPrevBudgets] = useState<Budget[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview'|'recurring'|'insights'|'trends'>('overview');
  const [expandedCard, setExpandedCard] = useState<number|null>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = month === now.getMonth() + 1 && year === now.getFullYear()
    ? now.getDate()
    : daysInMonth;
  const monthProgress = (dayOfMonth / daysInMonth) * 100;
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const [b, c, t, pb] = await Promise.all([
        api.getBudgets({ month: String(month), year: String(year) }),
        api.getCategories(),
        api.getTransactions({ month: String(month), year: String(year), limit: '500' }).catch(() => ({ transactions: [] })),
        api.getBudgets({ month: String(prevMonth), year: String(prevYear) }).catch(() => []),
      ]);
      setBudgets(b);
      setCategories(c);
      const txns = Array.isArray(t) ? t : (t.transactions || []);
      setTransactions(txns);
      setPrevBudgets(Array.isArray(pb) ? pb : []);
    } catch { showToast('Failed to load budgets', 'error'); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.category_id || !form.amount) { showToast('Fill in all fields', 'error'); return; }
    try {
      await api.createBudget({ ...form, amount: Number(form.amount), month, year });
      showToast('Budget saved');
      setShowModal(false);
      load();
    } catch { showToast('Failed to save budget', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this budget?')) return;
    try { await api.deleteBudget(id); showToast('Budget deleted', 'info'); load(); }
    catch { showToast('Failed to delete', 'error'); }
  };

  const fetchAISuggestions = async () => {
    setAiLoading(true);
    setAiSuggestions('');
    try {
      const budgetSummary = budgets.map(b => ({
        category: translateCategory(b.category_name),
        budget: Number(b.amount),
        spent: Number(b.spent),
        pct: Math.round((Number(b.spent) / Number(b.amount)) * 100),
      }));
      const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
      const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: 'You are a personal finance advisor. Give 3-4 concise, actionable budget suggestions based on the user spending data. Be specific, practical, and encouraging. Use bullet points. Keep each point to 1-2 sentences. Focus on the most impactful changes.',
          messages: [{
            role: 'user',
            content: `Analyze my ${MONTH_FULL[month-1]} ${year} budget:\nTotal budget: ${totalBudget} | Total spent: ${totalSpent} (${Math.round((totalSpent/totalBudget)*100)}% of budget)\nMonth progress: ${Math.round(monthProgress)}% through the month\n\nCategory breakdown:\n${budgetSummary.map(b => `- ${b.category}: ${b.spent} of ${b.budget} (${b.pct}%)`).join('\n')}\n\nGive me 3-4 specific, actionable suggestions to improve my budget management.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || 'Unable to generate suggestions.';
      setAiSuggestions(text);
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    } catch {
      setAiSuggestions('Unable to generate suggestions at this time.');
    } finally {
      setAiLoading(false);
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const forecastSpend = isCurrentMonth && dayOfMonth > 0
    ? (totalSpent / dayOfMonth) * daysInMonth
    : totalSpent;
  const forecastOver = forecastSpend > totalBudget;

  const overBudget = budgets.filter(b => Number(b.spent) > Number(b.amount));
  const nearLimit = budgets.filter(b => {
    const pct = (Number(b.spent) / Number(b.amount)) * 100;
    return pct >= 80 && pct < 100;
  });
  const underUsed = budgets.filter(b => (Number(b.spent) / Number(b.amount)) * 100 < 30 && isCurrentMonth && dayOfMonth > 15);

  const computeHealth = () => {
    if (!budgets.length) return 100;
    let score = 100;
    budgets.forEach(b => {
      const pct = (Number(b.spent) / Number(b.amount)) * 100;
      if (pct > 100) score -= 20;
      else if (pct > 90) score -= 10;
      else if (pct > 80) score -= 5;
    });
    if (forecastOver) score -= 15;
    return Math.max(0, score);
  };
  const healthScore = computeHealth();

  const recurringTxns = transactions.filter((t: Transaction) => t.is_recurring);
  const recurringTotal = recurringTxns.reduce((s: number, t: Transaction) => s + Number(t.amount), 0);

  const getTrend = (b: Budget) => {
    const prev = prevBudgets.find(pb => pb.category_id === b.category_id);
    if (!prev) return null;
    return Number(b.spent) - Number(prev.spent);
  };

  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 20,
  };

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: activeTab === tab ? 'var(--accent)' : 'transparent',
    color: activeTab === tab ? 'white' : 'var(--text-muted)',
    border: 'none', cursor: 'pointer',
    transition: 'all 0.18s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Budgets</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {MONTH_FULL[month-1]} {year} · {Math.round(monthProgress)}% through the month
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 96, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80, fontSize: 13 }}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }}
            style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>
            + Add Budget
          </button>
        </div>
      </div>

      {/* Monthly Overview Cards */}
      {!loading && budgets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total Budget', value: fmt(totalBudget), sub: `${budgets.length} categories`, color: 'var(--accent)' },
            { label: 'Total Spent', value: fmt(totalSpent), sub: `${overallPct.toFixed(0)}% used`, color: totalSpent > totalBudget ? 'var(--red)' : 'var(--green)' },
            { label: 'Remaining', value: fmt(Math.abs(totalRemaining)), sub: totalRemaining >= 0 ? 'available' : 'over budget', color: totalRemaining >= 0 ? 'var(--text)' : 'var(--red)' },
            { label: 'Forecast', value: fmt(Math.round(forecastSpend)), sub: forecastOver ? '⚠ over budget' : 'projected spend', color: forecastOver ? 'var(--red)' : 'var(--amber)' },
          ].map((item, i) => (
            <div key={i} style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: item.color, opacity: 0.7 }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)', color: item.color, marginBottom: 4 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Overall Progress + Forecast */}
      {!loading && budgets.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Overall Budget Usage</span>
              <HealthDot score={healthScore} />
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {isCurrentMonth ? `Day ${dayOfMonth} of ${daysInMonth}` : `${daysInMonth} days`}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)' }}>
                {overallPct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div style={{ height: 12, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.min(overallPct, 100)}%`,
              background: `linear-gradient(90deg, var(--accent), ${overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)'})`,
              transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)',
              boxShadow: `0 0 12px ${overallPct >= 80 ? 'rgba(240,82,82,0.4)' : 'rgba(91,110,245,0.4)'}`,
            }} />
            {isCurrentMonth && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${monthProgress}%`, width: 2, background: 'var(--text-muted)', opacity: 0.4 }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: isCurrentMonth ? 10 : 0 }}>
            <span>{fmt(totalSpent)} spent</span>
            {isCurrentMonth && <span style={{ color: 'var(--text-soft)' }}>↑ month: {Math.round(monthProgress)}%</span>}
            <span>{fmt(totalBudget)} budget</span>
          </div>
          {isCurrentMonth && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: forecastOver ? 'var(--red-muted)' : 'var(--surface-2)',
              border: `1px solid ${forecastOver ? 'rgba(240,82,82,0.2)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>{forecastOver ? '⚠️' : '📊'}</span>
              <span style={{ fontSize: 12, color: forecastOver ? 'var(--red)' : 'var(--text-soft)' }}>
                At this rate, projected spend is <strong>{fmt(Math.round(forecastSpend))}</strong>
                {forecastOver ? ` — ${fmt(Math.round(forecastSpend - totalBudget))} over budget` : ` — ${fmt(Math.round(totalBudget - forecastSpend))} under budget`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {!loading && budgets.length > 0 && (
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {(['overview', 'recurring', 'insights', 'trends'] as const).map(tab => (
            <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
              {tab === 'overview' ? '📋 Overview' : tab === 'recurring' ? '🔄 Recurring' : tab === 'insights' ? '💡 Insights' : '📈 Trends'}
            </button>
          ))}
        </div>
      )}

      {/* Budget Cards / Tabs */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...card }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <Skeleton w={36} h={36} r={10} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton w={120} h={13} /><Skeleton w={80} h={10} />
                </div>
              </div>
              <Skeleton h={8} r={99} />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton w={80} h={10} /><Skeleton w={80} h={10} />
              </div>
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div style={{ ...card, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 44, opacity: 0.1 }}>◉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-soft)' }}>No budgets set</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>Set monthly spending limits per category to stay on track</p>
          <button onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }}
            style={{ marginTop: 8, padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>
            Set your first budget
          </button>
        </div>
      ) : activeTab === 'overview' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {budgets.map((b, idx) => {
            const spent = Number(b.spent);
            const budget = Number(b.amount);
            const pct = Math.min((spent / budget) * 100, 100);
            const over = spent > budget;
            const warn = !over && pct >= 80;
            const barColor = over ? 'var(--red)' : warn ? 'var(--amber)' : b.category_color;
            const remaining = budget - spent;
            const trend = getTrend(b);
            const healthSc = over ? 0 : warn ? 50 : 100;
            const isExpanded = expandedCard === b.id;
            const dailyAvg = dayOfMonth > 0 ? spent / dayOfMonth : 0;
            const projectedTotal = dailyAvg * daysInMonth;
            const daysLeft = daysInMonth - dayOfMonth;
            const dailyBudgetLeft = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;

            return (
              <div key={b.id}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${over ? 'rgba(240,82,82,0.3)' : isExpanded ? 'var(--border-2)' : 'var(--border)'}`,
                  borderRadius: 16, padding: 20,
                  transition: 'all 0.2s ease', cursor: 'pointer',
                }}
                onClick={() => setExpandedCard(isExpanded ? null : b.id)}
                onMouseEnter={e => !isExpanded && ((e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(240,82,82,0.4)' : 'var(--border-2)')}
                onMouseLeave={e => !isExpanded && ((e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(240,82,82,0.3)' : 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
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
                      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 2 }}>
                        {translateCategory(b.category_name)}
                      </div>
                      <HealthDot score={healthSc} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {trend !== null && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: trend > 0 ? 'var(--red)' : 'var(--green)' }}>
                        {trend > 0 ? '↑' : '↓'} {fmt(Math.abs(trend))}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(b.id); }}
                      title="Delete"
                      style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--red-muted)'; el.style.color = 'var(--red)'; el.style.borderColor = 'rgba(240,82,82,0.3)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--surface-2)'; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'var(--border)'; }}>
                      ×
                    </button>
                  </div>
                </div>

                <AnimatedBar pct={pct} color={barColor} delay={idx * 80} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: over ? 'var(--red)' : 'var(--text)' }}>{fmt(spent)}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>of</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmt(budget)}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--green)' }}>
                    {pct.toFixed(0)}%
                  </div>
                </div>

                {over ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
                    {fmt(spent - budget)} over budget
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--green)' }}>
                    {fmt(remaining)} remaining · {(100 - pct).toFixed(0)}% left
                  </div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Daily Avg', value: fmt(Math.round(dailyAvg)), color: 'var(--text)' },
                        { label: 'Daily Budget Left', value: dailyBudgetLeft > 0 ? fmt(Math.round(dailyBudgetLeft)) : 'N/A', color: dailyBudgetLeft > 0 ? 'var(--green)' : 'var(--red)' },
                        { label: 'Projected Total', value: fmt(Math.round(projectedTotal)), color: projectedTotal > budget ? 'var(--red)' : 'var(--text)' },
                        { label: 'vs Last Month', value: trend === null ? '—' : `${trend > 0 ? '+' : ''}${fmt(trend)}`, color: trend === null ? 'var(--text-muted)' : trend > 0 ? 'var(--red)' : 'var(--green)' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    {isCurrentMonth && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Projected vs Budget</div>
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${Math.min((projectedTotal / budget) * 100, 100)}%`, background: projectedTotal > budget ? 'var(--red)' : 'var(--amber)', opacity: 0.8 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                          {fmt(Math.round(projectedTotal))} projected of {fmt(budget)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      ) : activeTab === 'recurring' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Recurring Expenses</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fixed monthly costs this month</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly Recurring</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{fmt(recurringTotal)}</div>
              </div>
            </div>
            {recurringTxns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🔄</div>
                No recurring transactions found this month.<br/>
                <span style={{ fontSize: 11, marginTop: 6, display: 'block' }}>Mark transactions as recurring on the Transactions page.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recurringTxns.map((t: Transaction) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t.description || translateCategory(t.category_name)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{translateCategory(t.category_name)} · {t.date?.slice(0,10)}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)' }}>{fmt(Number(t.amount))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {totalBudget > 0 && (
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recurring vs Discretionary Budget</div>
              <div style={{ height: 10, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${Math.min((recurringTotal / totalBudget) * 100, 100)}%`, background: 'var(--purple)', transition: 'width 0.9s ease', boxShadow: '0 0 8px rgba(167,139,250,0.4)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Recurring: {fmt(recurringTotal)} ({((recurringTotal/totalBudget)*100).toFixed(0)}%)</span>
                <span>Discretionary: {fmt(totalBudget - recurringTotal)}</span>
              </div>
            </div>
          )}
        </div>

      ) : activeTab === 'insights' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {overBudget.length > 0 && (
            <div style={{ ...card, border: '1px solid rgba(240,82,82,0.25)', background: 'rgba(240,82,82,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                🚨 Over Budget ({overBudget.length})
              </div>
              {overBudget.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(240,82,82,0.1)' }}>
                  <span style={{ fontSize: 13 }}>{translateCategory(b.category_name)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>+{fmt(Number(b.spent) - Number(b.amount))} over</span>
                </div>
              ))}
            </div>
          )}
          {nearLimit.length > 0 && (
            <div style={{ ...card, border: '1px solid rgba(245,166,35,0.2)', background: 'rgba(245,166,35,0.03)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ Near Limit ({nearLimit.length})
              </div>
              {nearLimit.map(b => {
                const pct = (Number(b.spent) / Number(b.amount)) * 100;
                return (
                  <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(245,166,35,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{translateCategory(b.category_name)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{pct.toFixed(0)}%</span>
                    </div>
                    <AnimatedBar pct={pct} color="var(--amber)" />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {fmt(Number(b.amount) - Number(b.spent))} remaining
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {underUsed.length > 0 && (
            <div style={{ ...card, border: '1px solid rgba(34,212,122,0.15)', background: 'rgba(34,212,122,0.03)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✅ Under-used Budgets ({underUsed.length})
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>These budgets have very low usage past mid-month — consider reallocating.</p>
              {underUsed.map(b => {
                const pct = (Number(b.spent) / Number(b.amount)) * 100;
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(34,212,122,0.08)' }}>
                    <span style={{ fontSize: 13 }}>{translateCategory(b.category_name)}</span>
                    <span style={{ fontSize: 12, color: 'var(--green)' }}>{pct.toFixed(0)}% used · {fmt(Number(b.amount) - Number(b.spent))} free</span>
                  </div>
                );
              })}
            </div>
          )}
          {overBudget.length === 0 && nearLimit.length === 0 && underUsed.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>All Good!</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>All budgets are on track this month.</div>
            </div>
          )}

          {/* AI Suggestions */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🤖 AI Budget Suggestions
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Personalized advice based on your spending</div>
              </div>
              <button onClick={fetchAISuggestions} disabled={aiLoading || budgets.length === 0}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: aiLoading ? 'var(--surface-2)' : 'var(--accent)',
                  color: aiLoading ? 'var(--text-muted)' : 'white',
                  border: 'none', transition: 'all 0.2s ease',
                  boxShadow: aiLoading ? 'none' : '0 4px 12px rgba(91,110,245,0.3)',
                }}>
                {aiLoading ? '⏳ Analyzing...' : '✨ Get Suggestions'}
              </button>
            </div>
            {aiSuggestions ? (
              <div ref={aiRef} style={{
                padding: 16, borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                fontSize: 13, lineHeight: 1.7, color: 'var(--text-soft)',
                whiteSpace: 'pre-wrap', animation: 'fadeIn 0.3s ease',
              }}>
                {aiSuggestions}
              </div>
            ) : !aiLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                Click "Get Suggestions" for AI-powered budget advice
              </div>
            ) : null}
          </div>
        </div>

      ) : activeTab === 'trends' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Health Score */}
          <div style={{ ...card }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Budget Health Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="30" fill="none" stroke="var(--surface-2)" strokeWidth="8" />
                  <circle cx="40" cy="40" r="30" fill="none"
                    stroke={healthScore >= 80 ? 'var(--green)' : healthScore >= 50 ? 'var(--amber)' : 'var(--red)'}
                    strokeWidth="8"
                    strokeDasharray={`${(healthScore / 100) * 188.4} 188.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {healthScore}
                </div>
              </div>
              <div>
                <HealthDot score={healthScore} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
                  {healthScore >= 80 ? "You're managing your budget well. Keep it up!" : healthScore >= 50 ? "Some categories need attention. Review your spending." : "Multiple budgets are at risk. Take action now."}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'On track (<80%)', value: budgets.filter(b => (Number(b.spent)/Number(b.amount))*100 < 80).length, color: 'var(--green)' },
                { label: 'Near limit (80–100%)', value: nearLimit.length, color: 'var(--amber)' },
                { label: 'Over budget (>100%)', value: overBudget.length, color: 'var(--red)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.value}/{budgets.length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Trends */}
          <div style={{ ...card }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Category Trends</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Spending vs last month</div>
            {budgets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No data</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {budgets.map((b, idx) => {
                  const spent = Number(b.spent);
                  const budget = Number(b.amount);
                  const pct = Math.min((spent / budget) * 100, 100);
                  const trend = getTrend(b);
                  const barColor = spent > budget ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : b.category_color;
                  const prevSpent = prevBudgets.find(pb => pb.category_id === b.category_id);

                  return (
                    <div key={b.id} style={{ padding: '12px 0', borderBottom: idx < budgets.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.category_color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{translateCategory(b.category_name)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {trend !== null && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: trend > 0 ? 'var(--red)' : trend < 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {fmt(Math.abs(trend))}
                            </span>
                          )}
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmt(spent)}</span>
                        </div>
                      </div>
                      <AnimatedBar pct={pct} color={barColor} delay={idx * 60} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span>{pct.toFixed(0)}% of {fmt(budget)}</span>
                        {prevSpent && <span>Prev: {fmt(Number(prevSpent.spent))}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Modal */}
      {showModal && (
        <div style={MODAL_STYLE} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={MODAL_BOX}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>Set Budget</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div>
              <label style={LABEL_STYLE}>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select category…</option>
                {expenseCategories.map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Monthly Limit</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>Save Budget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}