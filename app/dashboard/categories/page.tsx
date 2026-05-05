'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface Category { id: number; name: string; color: string; icon: string; type: string; }

const COLORS = ['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#a855f7','#10b981','#f97316','#06b6d4','#84cc16','#e11d48'];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#6366f1', icon: 'tag', type: 'expense' });

  const load = useCallback(async () => {
    try {
      const c = await api.getCategories();
      setCategories(c);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await api.createCategory(form);
    setShowModal(false);
    setForm({ name: '', color: '#6366f1', icon: 'tag', type: 'expense' });
    load();
  };

  const income = categories.filter(c => c.type === 'income');
  const expense = categories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{categories.length} categories</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
          + New Category
        </button>
      </div>

      {(['income', 'expense'] as const).map(type => {
        const cats = type === 'income' ? income : expense;
        return (
          <div key={type}>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
              style={{ color: type === 'income' ? 'var(--green)' : 'var(--red)' }}>
              {type}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {cats.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: c.color }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.color}</span>
                    </div>
                  </div>
                </div>
              ))}
              {cats.length === 0 && (
                <div className="col-span-3 py-8 text-center text-sm rounded-xl"
                  style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  No {type} categories yet
                </div>
              )}
            </div>
          </div>
        );
      })}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-lg">New Category</h2>

            <div className="flex gap-2">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
                  style={{
                    background: form.type === t ? (t === 'income' ? 'var(--green)' : 'var(--red)') : 'var(--surface-2)',
                    color: form.type === t ? 'white' : 'var(--text-muted)'
                  }}>
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Groceries" />
            </div>

            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, outline: form.color === c ? `3px solid white` : 'none', outlineOffset: '2px' }} />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: form.color }}>
                {form.name ? form.name[0].toUpperCase() : '?'}
              </div>
              <span className="text-sm font-medium">{form.name || 'Preview'}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
