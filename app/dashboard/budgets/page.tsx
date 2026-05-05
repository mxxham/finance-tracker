'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface Budget {
  id: number; amount: number; spent: number; category_id: number;
  category_name: string; category_color: string; month: number; year: number;
}
interface Category { id: number; name: string; color: string; type: string; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        api.getBudgets({ month: String(month), year: String(year) }),
        api.getCategories(),
      ]);
      setBudgets(b); setCategories(c);
    } catch (e) { console.error(e); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    await api.createBudget({ ...form, amount: Number(form.amount), month, year });
    setShowModal(false);
    load();
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Set monthly spending limits</p>
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-28">
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
            + Add Budget
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-xl py-20 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No budgets set for this month</p>
          <button onClick={() => { setForm({ category_id: '', amount: '' }); setShowModal(true); }}
            className="mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold text-white inline-block" style={{ background: 'var(--accent)' }}>
            Set your first budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {budgets.map(b => {
            const spent = Number(b.spent);
            const budget = Number(b.amount);
            const pct = Math.min((spent / budget) * 100, 100);
            const over = spent > budget;
            return (
              <div key={b.id} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: b.category_color }}>
                      {b.category_name[0]}
                    </div>
                    <span className="font-semibold text-sm">{b.category_name}</span>
                  </div>
                  {over && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#ef444420', color: 'var(--red)' }}>
                      Over budget
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>Spent</span>
                    <span className="font-mono font-medium" style={{ color: over ? 'var(--red)' : 'var(--text)' }}>{fmt(spent)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: over ? 'var(--red)' : pct > 80 ? 'var(--amber)' : b.category_color }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>{pct.toFixed(0)}% used</span>
                    <span className="font-mono font-medium" style={{ color: 'var(--text-muted)' }}>Budget: {fmt(budget)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-lg">Set Budget</h2>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select category</option>
                {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Monthly Budget</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
