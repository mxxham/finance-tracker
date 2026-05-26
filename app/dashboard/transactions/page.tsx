'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { showToast } from '@/components/Toast';
import { useSettings } from '@/lib/SettingsContext';
import { BalanceCard } from '@/components/BalanceCard';

// ── Mobile detection hook ─────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

// ── Swipeable row for mobile ──────────────────────────────────────
function SwipeableRow({ tx, fmt, onEdit, onDelete }: {
  tx: { id: number; amount: number; type: string; description: string; date: string; category_name: string; category_color: string };
  fmt: (n: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const isScrolling = useRef<boolean | null>(null);
  const ACTION_W = 130;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    isScrolling.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isScrolling.current === null) {
      isScrolling.current = Math.abs(dy) > Math.abs(dx);
    }
    if (isScrolling.current) return;
    e.preventDefault();
    const base = swiped ? -ACTION_W : 0;
    const next = Math.max(-ACTION_W, Math.min(0, base + dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    dragging.current = false;
    if (isScrolling.current) return;
    const threshold = ACTION_W * 0.4;
    const target = swiped
      ? (offset > -(ACTION_W - threshold) ? 0 : -ACTION_W)
      : (offset < -threshold ? -ACTION_W : 0);
    setOffset(target);
    setSwiped(target !== 0);
  };

  const close = () => { setOffset(0); setSwiped(false); };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
      {/* Action buttons revealed behind */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex' }}>
        <button
          onClick={() => { close(); onEdit(); }}
          style={{ flex: 1, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
        <button
          onClick={() => { close(); onDelete(); }}
          style={{ flex: 1, background: 'var(--red)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
          Delete
        </button>
      </div>

      {/* Swipeable card content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (swiped) close(); }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.25,1,0.5,1)',
          background: 'var(--surface)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'pan-y',
        }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: (tx.category_color || '#888') + '20', border: `1.5px solid ${tx.category_color || '#888'}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: tx.category_color || 'var(--text-muted)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
            {tx.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400 }}>No description</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-2)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: tx.category_color || 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translateCategory(tx.category_name || 'Uncategorized')}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.02em' }}>
            {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', opacity: 0.7, textTransform: 'capitalize', marginTop: 2 }}>{tx.type}</div>
        </div>
        <div style={{ color: 'var(--text-muted)', opacity: swiped ? 0 : 0.25, transition: 'opacity 0.2s', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

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
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  padding: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
  animation: 'fadeIn 0.15s ease both',
};
const MODAL_BOX: React.CSSProperties = {
  width: '100%', maxWidth: 500,
  borderRadius: '20px 20px 0 0',
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  padding: '20px 20px 32px', boxShadow: '0 -8px 48px rgba(0,0,0,0.7)',
  animation: 'scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both',
  display: 'flex', flexDirection: 'column', gap: 14,
};

export default function TransactionsPage() {
  const { fmt } = useSettings();
  const isMobile = useIsMobile();
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
  const [globalStats, setGlobalStats] = useState<{ balance: number; income: number; expenses: number } | null>(null);
  const [form, setForm] = useState({ amount: '', type: 'expense', description: '', date: now.toISOString().split('T')[0], category_id: '' });
  const [budgets, setBudgets] = useState<{ id: number; amount: number; spent: number; category_id: number; category_name: string; category_color: string }[]>([]);

  const handleExport = (format: 'csv' | 'pdf') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
    if (!token) return;
    const params = new URLSearchParams({ format, month: String(month), year: String(year) });
    if (filterType) params.set('type', filterType);
    // Open export URL — browser handles download (CSV) or print dialog (PDF)
    window.open(`/api/export?${params.toString()}&token=${token}`, '_blank');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { month: String(month), year: String(year), limit: '500' };
      if (filterType) params.type = filterType;
      const [t, c, b, s] = await Promise.all([
        api.getTransactions(params),
        api.getCategories(),
        api.getBudgets({ month: String(month), year: String(year) }).catch(() => []),
        api.getStats().catch(() => null),
      ]);
      setTxs(t); setCategories(c); setPage(1);
      setBudgets(Array.isArray(b) ? b : []);
      if (s) setGlobalStats({ balance: Number(s.balance ?? 0), income: Number(s.income ?? 0), expenses: Number(s.expenses ?? 0) });
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Transactions</h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportCSV} style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-soft)', border: '1px solid var(--border-2)' }}>↓ CSV</button>
          <button onClick={openAdd} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>+ Add</button>
        </div>
      </div>

      {/* Balance + period summary */}
      <BalanceCard
        balance={globalStats?.balance ?? null}
        balanceLabel="Current Balance"
        balanceSub="All-time net"
        loading={loading}
        fmt={fmt}
        variant="compact"
        chips={[
          { label: 'Period Income', value: totals.income > 0 ? '+' + fmt(totals.income) : '—', valueColor: '#4ade80', sub: 'this period' },
          { label: 'Period Expenses', value: totals.expenses > 0 ? '−' + fmt(totals.expenses) : '—', valueColor: '#f87171', sub: 'this period' },
          { label: 'Net', value: fmt(totals.income - totals.expenses), valueColor: totals.income >= totals.expenses ? '#4ade80' : '#f87171', sub: 'income − expenses' },
          { label: 'Transactions', value: String(filtered.length), sub: 'this period' },
        ]}
      />

      {/* Filters row - stacks on mobile */}
      <div className="filters-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 150px', minWidth: 120 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>⌕</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
            style={{ paddingLeft: 30, width: '100%', fontSize: 13 }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ flex: '1 1 100px', fontSize: 13 }}>
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ flex: '1 1 80px', fontSize: 13 }}>
          {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ flex: '0 0 76px', fontSize: 13 }}>
          {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Transaction list — swipeable cards on mobile, table on desktop */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Loading skeletons */}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton w={38} h={38} r={10} />
            <div style={{ flex: 1 }}><Skeleton h={13} /><Skeleton w="50%" h={10} /></div>
            <Skeleton w={70} h={14} />
          </div>
        ))}

        {/* Empty state */}
        {!loading && paginated.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 24px' }}>
            <div style={{ fontSize: 40, opacity: 0.12 }}>⇅</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)' }}>{search ? 'No matches found' : 'No transactions this month'}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{search ? 'Try a different search term' : 'Tap Add to get started'}</p>
            {!search && (
              <button onClick={openAdd} style={{ marginTop: 6, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none' }}>+ Add Transaction</button>
            )}
          </div>
        )}

        {/* Mobile: swipeable card list */}
        {!loading && paginated.length > 0 && isMobile && (
          <>
            <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>← Swipe left to edit or delete</span>
            </div>
            {paginated.map(tx => (
              <SwipeableRow
                key={tx.id}
                tx={tx}
                fmt={fmt}
                onEdit={() => openEdit(tx)}
                onDelete={() => handleDelete(tx.id)}
              />
            ))}
          </>
        )}

        {/* Desktop: full table */}
        {!loading && paginated.length > 0 && !isMobile && (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date','Description','Category','Type','Amount',''].map((h, i) => (
                  <th key={i} style={{ padding: '13px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((tx, idx) => (
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 6, background: tx.category_color + '18', color: tx.category_color || 'var(--text-muted)', border: '1px solid ' + tx.category_color + '28' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: tx.category_color, flexShrink: 0 }} />
                      {translateCategory(tx.category_name || 'Uncategorized')}
                    </span>
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: tx.type === 'income' ? 'var(--green-muted)' : 'var(--red-muted)', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)', textTransform: 'capitalize' }}>{tx.type}</span>
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
        )}
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
                <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600, background: p===page?'var(--accent)':'var(--surface-2)', color: p===page?'white':'var(--text-muted)', border: `1px solid ${p===page?'var(--accent)':'var(--border)'}`, boxShadow: p===page?'0 2px 8px var(--accent-glow-2)':'none' }}>{p}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: page===totalPages?'var(--text-muted)':'var(--text)', border: '1px solid var(--border)', opacity: page===totalPages?0.4:1 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (() => {
        // Compute budget impact for the selected category when adding an expense
        const selectedBudget = form.type === 'expense' && form.category_id
          ? budgets.find(b => b.category_id === Number(form.category_id))
          : null;
        const addAmount = Number(form.amount) || 0;
        const newSpent = selectedBudget ? Number(selectedBudget.spent) + addAmount : 0;
        const budgetLimit = selectedBudget ? Number(selectedBudget.amount) : 0;
        const newPct = budgetLimit > 0 ? (newSpent / budgetLimit) * 100 : 0;
        const currentPct = budgetLimit > 0 ? (Number(selectedBudget?.spent ?? 0) / budgetLimit) * 100 : 0;
        const wouldExceed = selectedBudget && !editTx && newSpent > budgetLimit;
        const wouldWarn = selectedBudget && !editTx && newPct >= 80 && !wouldExceed;
        const alreadyOver = selectedBudget && currentPct >= 100;

        return (
        <div style={MODAL_STYLE} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={MODAL_BOX}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 4px' }} />
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

            {/* Budget impact alert — shown live as user types amount + picks category */}
            {selectedBudget && addAmount > 0 && !editTx && (
              <div style={{
                padding: '11px 14px', borderRadius: 10,
                background: wouldExceed ? 'rgba(240,82,82,0.08)' : wouldWarn ? 'rgba(245,166,35,0.08)' : 'rgba(34,212,122,0.06)',
                border: `1.5px solid ${wouldExceed ? 'rgba(240,82,82,0.3)' : wouldWarn ? 'rgba(245,166,35,0.3)' : 'rgba(34,212,122,0.2)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke={wouldExceed ? 'var(--red)' : wouldWarn ? 'var(--amber)' : 'var(--green)'}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {wouldExceed || wouldWarn
                      ? <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                      : <polyline points="20 6 9 17 4 12"/>
                    }
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: wouldExceed ? 'var(--red)' : wouldWarn ? 'var(--amber)' : 'var(--green)' }}>
                    {alreadyOver
                      ? `${translateCategory(selectedBudget.category_name)} is already over budget`
                      : wouldExceed
                      ? `This will exceed your ${translateCategory(selectedBudget.category_name)} budget`
                      : wouldWarn
                      ? `${translateCategory(selectedBudget.category_name)} will reach ${newPct.toFixed(0)}% of budget`
                      : `Within ${translateCategory(selectedBudget.category_name)} budget`}
                  </span>
                </div>
                {/* Mini progress bar: before → after */}
                <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'visible', position: 'relative', marginBottom: 6 }}>
                  {/* Current spent */}
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 99, width: `${Math.min(currentPct, 100)}%`, background: 'var(--border-2)', transition: 'width 0.4s ease' }} />
                  {/* New amount being added */}
                  {!alreadyOver && (
                    <div style={{ position: 'absolute', top: 0, left: `${Math.min(currentPct, 100)}%`, height: '100%', borderRadius: '0 99px 99px 0', width: `${Math.min(newPct - currentPct, 100 - currentPct)}%`, background: wouldExceed ? 'var(--red)' : wouldWarn ? 'var(--amber)' : 'var(--green)', opacity: 0.8, transition: 'width 0.3s ease' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>After: <strong style={{ color: wouldExceed ? 'var(--red)' : 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}>{fmt(newSpent)}</strong></span>
                  <span>Budget: <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt(budgetLimit)}</strong> ({newPct.toFixed(0)}%)</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: wouldExceed ? 'var(--red)' : 'var(--accent)', color: 'white', border: 'none', boxShadow: `0 4px 16px ${wouldExceed ? 'rgba(240,82,82,0.35)' : 'var(--accent-glow-2)'}`, transition: 'all 0.2s ease' }}>
                {wouldExceed ? '⚠ Add Anyway' : editTx ? 'Save Changes' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
               }
