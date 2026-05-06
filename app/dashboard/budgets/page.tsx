'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { showToast } from '@/components/Toast';

interface Budget { id: number; amount: number; spent: number; category_id: number; category_name: string; category_color: string; month: number; year: number; }
interface Category { id: number; name: string; color: string; type: string; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 6,
  letterSpacing: '0.02em', textTransform: 'uppercase',
};
const MODAL_STYLE: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.15s ease both',
};
const MODAL_BOX: React.CSSProperties = {
  width: '100%', maxWidth: 400, borderRadius: 20, background: 'var(--surface)',
  border: '1px solid var(--border-2)', padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
  animation: 'scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both', display: 'flex', flexDirection: 'column', gap: 16,
};

export default function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api.getBudgets({ month: String(month), year: String(year) }),
        api.getCategories(),
      ]);
      setBudgets(b); setCategories(c);
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

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Budgets</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Monthly spending limits</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 96, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80, fontSize: 13 }}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>
            + Add Budget
          </button>
        </div>
      </div>

      {/* Overall Summary */}
      {!loading && budgets.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Budget</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}>{fmt(totalBudget)}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Spent</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)', color: totalSpent > totalBudget ? 'var(--red)' : 'var(--green)' }}>{fmt(totalSpent)}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>Remaining</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)', color: totalBudget - totalSpent >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmt(Math.abs(totalBudget - totalSpent))}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 7 }}>
              <span style={{ color: 'var(--text-muted)' }}>Overall usage</span>
              <span style={{ fontWeight: 700, color: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)' }}>{overallPct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${overallPct}%`, background: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--amber)' : 'var(--green)', transition: 'width 0.8s cubic-bezier(0.34,1.1,0.64,1)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <Skeleton w={36} h={36} r={10} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton w={120} h={13} />
                  <Skeleton w={80} h={10} />
                </div>
              </div>
              <Skeleton h={6} r={99} />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton w={80} h={10} />
                <Skeleton w={80} h={10} />
              </div>
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 44, opacity: 0.1 }}>◉</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-soft)' }}>No budgets set</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>Set monthly spending limits per category to stay on track with your goals</p>
          <button onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }} style={{ marginTop: 8, padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>
            Set your first budget
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {budgets.map(b => {
            const spent = Number(b.spent);
            const budget = Number(b.amount);
            const pct = Math.min((spent / budget) * 100, 100);
            const over = spent > budget;
            const warn = !over && pct >= 80;
            const barColor = over ? 'var(--red)' : warn ? 'var(--amber)' : b.category_color;
            return (
              <div key={b.id} style={{ background: 'var(--surface)', border: `1px solid ${over ? 'rgba(240,82,82,0.25)' : 'var(--border)'}`, borderRadius: 14, padding: 22, transition: 'border-color 0.2s ease' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(240,82,82,0.4)' : 'var(--border-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = over ? 'rgba(240,82,82,0.25)' : 'var(--border)'}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${b.category_color}22`, border: `1px solid ${b.category_color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: b.category_color, flexShrink: 0 }}>
                      {translateCategory(b.category_name)[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>{translateCategory(b.category_name)}</div>
                      {over && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>Over budget</div>}
                      {warn && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>Near limit</div>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} title="Delete budget" style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--red-muted)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,82,82,0.3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                    ×
                  </button>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: barColor, transition: 'width 0.8s cubic-bezier(0.34,1.1,0.64,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: over ? 'var(--red)' : 'var(--text)' }}>{fmt(spent)}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>of</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmt(budget)}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--text-muted)' }}>{pct.toFixed(0)}%</div>
                </div>
                {!over && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--green)' }}>{fmt(budget - spent)} remaining</div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
              <label style={LABEL_STYLE}>Monthly Limit (IDR)</label>
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
