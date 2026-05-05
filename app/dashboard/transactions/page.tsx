'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface Transaction {
  id: number; amount: number; type: string; description: string;
  date: string; category_name: string; category_color: string; category_id: number;
}
interface Category { id: number; name: string; color: string; type: string; }

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
  'Bisnis': 'Business',
  'Gaji': 'Salary',
  'Freelance': 'Freelance',
  'No category': 'No category',
};

function translateCategory(name: string) {
  return CATEGORY_TRANSLATIONS[name] ?? name;
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function TransactionsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState('');

  // Form state
  const [form, setForm] = useState({
    amount: '', type: 'expense', description: '', date: new Date().toISOString().split('T')[0], category_id: '',
  });

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { month: String(month), year: String(year), limit: '100' };
      if (filterType) params.type = filterType;
      const [t, c] = await Promise.all([api.getTransactions(params), api.getCategories()]);
      setTxs(t); setCategories(c);
    } catch (e) { console.error(e); }
  }, [month, year, filterType]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTx(null);
    setForm({ amount: '', type: 'expense', description: '', date: new Date().toISOString().split('T')[0], category_id: '' });
    setShowModal(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditTx(tx);
    setForm({
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description || '',
      date: tx.date.split('T')[0],
      category_id: tx.category_id !== null && tx.category_id !== undefined ? String(tx.category_id) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const parsedCategoryId = form.category_id === '' ? null : Number(form.category_id);
      const body = {
        ...form,
        amount: Number(form.amount),
        category_id: parsedCategoryId === null || Number.isNaN(parsedCategoryId) ? null : parsedCategoryId,
      };
      if (editTx) await api.updateTransaction(editTx.id, body);
      else await api.createTransaction(body);
      setShowModal(false);
      load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    await api.deleteTransaction(id);
    load();
  };

  const filteredCats = categories.filter(c => !form.type || c.type === form.type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{txs.length} transactions</p>
        </div>
        <div className="flex gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-32">
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-28">
            {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-24">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={openAdd} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
            + Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Description', 'Category', 'Type', 'Amount', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No transactions found</td></tr>
            ) : txs.map(tx => (
              <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {new Date(tx.date).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5 text-sm">{tx.description || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                    style={{ background: `${tx.category_color}25`, color: tx.category_color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tx.category_color }} />
                    {translateCategory(tx.category_name || 'Uncategorized')}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                    style={{ background: tx.type === 'income' ? '#22c55e20' : '#ef444420', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono font-semibold text-sm"
                  style={{ color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(tx)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--accent-2)' }}>Edit</button>
                    <button onClick={() => handleDelete(tx.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--red)' }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-lg">{editTx ? 'Edit Transaction' : 'New Transaction'}</h2>

            <div className="flex gap-2">
              {['expense', 'income'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
                  style={{ background: form.type === t ? (t === 'income' ? 'var(--green)' : 'var(--red)') : 'var(--surface-2)', color: form.type === t ? 'white' : 'var(--text-muted)' }}>
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?" />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">No category</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
