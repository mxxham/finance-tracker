'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { showToast } from '@/components/Toast';
import { useSettings } from '@/lib/SettingsContext';

interface Transaction {
  id: number; amount: number; type: string; description: string;
  date: string; category_name: string; category_color: string; category_id: number;
}
interface Category { id: number; name: string; color: string; type: string; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAGE_SIZE = 20;


function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 6,
  letterSpacing: '0.02em', textTransform: 'uppercase',
};

const MODAL_STYLE: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
  animation: 'fadeIn 0.15s ease both',
};
const MODAL_BOX: React.CSSProperties = {
  width: '100%', maxWidth: 460, borderRadius: 20,
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
  animation: 'scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both',
  display: 'flex', flexDirection: 'column', gap: 16,
};

export default function TransactionsPage() {
  const { fmt } = useSettings();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ amount: '', type: 'expense', description: '', date: now.toISOString().split('T')[0], category_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { month: String(month), year: String(year), limit: '500' };
      if (filterType) params.type = filterType;
      const [t, c] = await Promise.all([api.getTransactions(params), api.getCategories()]);
      setTxs(t); setCategories(c); setPage(1);
    } catch { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [month, year, filterType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !showModal &&
        !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) openAdd();
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showModal]);

  const openAdd = () => {
    setEditTx(null);
    setForm({ amount: '', type: 'expense', description: '', date: now.toISOString().split('T')[0], category_id: '' });
    setShowModal(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditTx(tx);
    setForm({ amount: String(tx.amount), type: tx.type, description: tx.description || '', date: tx.date.split('T')[0], category_id: tx.category_id != null ? String(tx.category_id) : '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const catId = form.category_id === '' ? null : Number(form.category_id);
      const body = { ...form, amount: Number(form.amount), category_id: catId };
      if (editTx) { await api.updateTransaction(editTx.id, body); showToast('Transaction updated'); }
      else { await api.createTransaction(body); showToast('Transaction added'); }
      setShowModal(false); load();
    } catch { showToast('Failed to save', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    try { await api.deleteTransaction(id); showToast('Deleted', 'info'); load(); }
    catch { showToast('Failed to delete', 'error'); }
  };

  const exportCSV = () => {
    const headers = ['Date','Description','Category','Type','Amount'];
    const rows = filtered.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      `"${(tx.description||'').replace(/"/g,'""')}"`,
      translateCategory(tx.category_name || 'Uncategorized'),
      tx.type, tx.amount,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `transactions-${MONTHS[month-1]}-${year}.csv`;
    a.click();
    showToast('CSV exported');
  };

  const filtered = txs.filter(tx => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (tx.description||'').toLowerCase().includes(q) || translateCategory(tx.category_name||'').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const filteredCats = categories.filter(c => c.type === form.type);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayExpenses = txs.reduce((sum, tx) => {
    const txDate = new Date(tx.date).toLocaleDateString('en-CA');
    if (tx.type === 'expense' && txDate === today) return sum + Number(tx.amount);
    return sum;
  }, 0);

  // Summary totals
  const totals = filtered.reduce((acc, tx) => {
    if (tx.type === 'income') acc.income += Number(tx.amount);
    else acc.expenses += Number(tx.amount);
    return acc;
  }, { income: 0, expenses: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Transactions</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {filtered.length} entries
            <span style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--text-muted)' }}>
              Press <kbd style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>N</kbd> to add
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>⌕</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
              style={{ paddingLeft: 30, width: 168, fontSize: 13 }} />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 110, fontSize: 13 }}>
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 96, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80, fontSize: 13 }}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-soft)', border: '1px solid var(--border-2)' }}>↓ CSV</button>
          <button onClick={openAdd} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>+ Add</button>
        </div>
      </div>

      {/* Summary Pills */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Total Income', val: totals.income, color: 'var(--green)', bg: 'var(--green-muted)', border: 'rgba(34,212,122,0.2)' },
            { label: 'Total Expenses', val: totals.expenses, color: 'var(--red)', bg: 'var(--red-muted)', border: 'rgba(240,82,82,0.2)' },
            { label: 'Today’s Spending', val: todayExpenses, color: 'var(--red)', bg: 'var(--red-muted)', border: 'rgba(240,82,82,0.2)' },
            { label: 'Net', val: totals.income - totals.expenses, color: totals.income >= totals.expenses ? 'var(--green)' : 'var(--red)', bg: totals.income >= totals.expenses ? 'var(--green-muted)' : 'var(--red-muted)', border: totals.income >= totals.expenses ? 'rgba(34,212,122,0.2)' : 'rgba(240,82,82,0.2)' },
          ].map(({ label, val, color, bg, border }) => (
            <div key={label} style={{ padding: '10px 16px', borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Date','Description','Category','Type','Amount',''].map((h, i) => (
                <th key={i} style={{ padding: '13px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                {[80, 160, 100, 70, 90, 60].map((w, j) => (
                  <td key={j} style={{ padding: '14px 20px' }}><Skeleton w={w} h={12} /></td>
                ))}
              </tr>
            )) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 24px' }}>
                    <div style={{ fontSize: 40, opacity: 0.12 }}>⇅</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)' }}>{search ? 'No matches found' : 'No transactions this month'}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{search ? 'Try a different search term' : 'Press N or click Add to get started'}</p>
                    {!search && (
                      <button onClick={openAdd} style={{ marginTop: 6, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none' }}>+ Add Transaction</button>
                    )}
                  </div>
                </td>
              </tr>
            ) : paginated.map((tx, idx) => (
              <tr key={tx.id}
                style={{ borderBottom: idx < paginated.length-1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s ease', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <td style={{ padding: '13px 20px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>}
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
                    padding: '4px 9px', borderRadius: 6,
                    background: `${tx.category_color}18`, color: tx.category_color || 'var(--text-muted)',
                    border: `1px solid ${tx.category_color}28`,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: tx.category_color, flexShrink: 0 }} />
                    {translateCategory(tx.category_name || 'Uncategorized')}
                  </span>
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                    background: tx.type === 'income' ? 'var(--green-muted)' : 'var(--red-muted)',
                    color: tx.type === 'income' ? 'var(--green)' : 'var(--red)',
                    textTransform: 'capitalize',
                  }}>{tx.type}</span>
                </td>
                <td style={{ padding: '13px 20px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                  {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))}
                </td>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(tx)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'var(--surface-3)', color: 'var(--text-soft)', border: '1px solid var(--border-2)', fontWeight: 500 }}>Edit</button>
                    <button onClick={() => handleDelete(tx.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', fontWeight: 500 }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: page===1?'var(--text-muted)':'var(--text)', border: '1px solid var(--border)', opacity: page===1?0.4:1 }}>← Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i+1 : page<=4 ? i+1 : page>=totalPages-3 ? totalPages-6+i : page-3+i;
              return (
                <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600, background: p===page?'var(--accent)':'var(--surface-2)', color: p===page?'white':'var(--text-muted)', border: `1px solid ${p===page?'var(--accent)':'var(--border)'}`, boxShadow: p===page?'0 2px 8px rgba(91,110,245,0.3)':'none' }}>{p}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: page===totalPages?'var(--text-muted)':'var(--text)', border: '1px solid var(--border)', opacity: page===totalPages?0.4:1 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={MODAL_STYLE} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={MODAL_BOX}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>{editTx ? 'Edit Transaction' : 'New Transaction'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
              {['expense','income'].map(t => (
                <button key={t} onClick={() => setForm(f=>({...f,type:t}))} style={{
                  flex: 1, padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: form.type===t ? (t==='income'?'var(--green)':'var(--red)') : 'transparent',
                  color: form.type===t ? 'white' : 'var(--text-muted)', border: 'none',
                  textTransform: 'capitalize', transition: 'all 0.15s ease',
                }}>{t}</button>
              ))}
            </div>
            <div>
              <label style={LABEL_STYLE}>Amount (IDR)</label>
              <input type="number" step="1" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} placeholder="0" autoFocus />
            </div>
            <div>
              <label style={LABEL_STYLE}>Description</label>
              <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="What was this for?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Category</label>
                <select value={form.category_id} onChange={e => setForm(f=>({...f,category_id:e.target.value}))}>
                  <option value="">None</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>
                {editTx ? 'Save Changes' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}