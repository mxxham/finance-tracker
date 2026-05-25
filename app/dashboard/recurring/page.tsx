'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { translateCategory } from '@/lib/categories';
import { showToast } from '@/components/Toast';
import { useSettings } from '@/lib/SettingsContext';
import { BalanceCard } from '@/components/BalanceCard';

interface Recurring {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_due: string;
  last_generated: string | null;
  is_active: boolean;
  auto_post: boolean;
  notes: string | null;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
}

interface Category { id: number; name: string; color: string; type: string; }

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2 weeks',
  monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

const FREQ_COLORS: Record<string, string> = {
  daily: '#f59e0b', weekly: '#8b5cf6', biweekly: '#6366f1',
  monthly: '#5b6ef5', quarterly: '#06b6d4', yearly: '#10b981',
};

const FREQ_OPTIONS = Object.entries(FREQ_LABELS);

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 6,
  letterSpacing: '0.04em', textTransform: 'uppercase',
};

const MODAL_OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
  animation: 'fadeIn 0.15s ease both',
};

const MODAL_BOX: React.CSSProperties = {
  width: '100%', maxWidth: 520,
  borderRadius: '20px 20px 0 0',
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  padding: '20px 20px 36px',
  boxShadow: '0 -8px 48px rgba(0,0,0,0.7)',
  animation: 'scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both',
  display: 'flex', flexDirection: 'column', gap: 14,
  maxHeight: '90vh', overflowY: 'auto',
};

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function DueBadge({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr);
  let bg = 'var(--surface-3)', color = 'var(--text-muted)', label = '';
  if (days < 0)       { bg = 'rgba(239,68,68,0.12)';  color = 'var(--red)';   label = `${Math.abs(days)}d overdue`; }
  else if (days === 0){ bg = 'rgba(239,68,68,0.12)';  color = 'var(--red)';   label = 'Due today'; }
  else if (days === 1){ bg = 'rgba(245,158,11,0.12)'; color = 'var(--amber)'; label = 'Due tomorrow'; }
  else if (days <= 7) { bg = 'rgba(245,158,11,0.12)'; color = 'var(--amber)'; label = `Due in ${days}d`; }
  else                { bg = 'var(--surface-3)';       color = 'var(--text-muted)'; label = `Due in ${days}d`; }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '72px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 52, opacity: 0.15 }}>↺</div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-soft)', marginBottom: 4 }}>No recurring transactions</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Set up salary, rent, subscriptions — anything that repeats.</p>
      </div>
      <button onClick={onAdd} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
        + Add First Recurring
      </button>
    </div>
  );
}

export default function RecurringPage() {
  const { fmt } = useSettings();
  const [items, setItems] = useState<Recurring[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Recurring | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'due'>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<{ income: number; expenses: number } | null>(null);

  const emptyForm = {
    amount: '', type: 'expense' as 'income' | 'expense', description: '',
    frequency: 'monthly', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', category_id: '', auto_post: false, notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, cats, stats] = await Promise.all([api.getRecurring(), api.getCategories(), api.getStats()]);
      setItems(Array.isArray(rec) ? rec : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setBalance(Number(stats?.balance ?? 0));
      setMonthlyStats({ income: Number(stats?.income ?? 0), expenses: Number(stats?.expenses ?? 0) });
    } catch { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, []);

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
    setEditItem(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item: Recurring) => {
    setEditItem(item);
    setForm({
      amount: String(item.amount),
      type: item.type,
      description: item.description,
      frequency: item.frequency,
      start_date: item.start_date.slice(0, 10),
      end_date: item.end_date ? item.end_date.slice(0, 10) : '',
      category_id: item.category_id ? String(item.category_id) : '',
      auto_post: item.auto_post,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.description || !form.frequency || !form.start_date) {
      showToast('Fill in all required fields', 'error'); return;
    }
    try {
      const body = {
        ...form,
        amount: Number(form.amount),
        category_id: form.category_id ? Number(form.category_id) : null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      };
      if (editItem) {
        await api.updateRecurring(editItem.id, body);
        showToast('Updated');
      } else {
        await api.createRecurring(body);
        showToast('Recurring added');
      }
      setShowModal(false);
      load();
    } catch { showToast('Failed to save', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this recurring transaction?')) return;
    try { await api.deleteRecurring(id); showToast('Deleted', 'info'); load(); }
    catch { showToast('Failed to delete', 'error'); }
  };

  const handleToggle = async (item: Recurring) => {
    try {
      await api.updateRecurring(item.id, { is_active: !item.is_active });
      showToast(item.is_active ? 'Paused' : 'Resumed', 'info');
      load();
    } catch { showToast('Failed to update', 'error'); }
  };

  const handlePostNow = async (id: number) => {
    setActionLoading(id);
    try {
      await api.postRecurringNow(id);
      showToast('Posted to transactions ✓');
      load();
    } catch { showToast('Failed to post', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleSkip = async (id: number) => {
    setActionLoading(id);
    try {
      await api.skipRecurring(id);
      showToast('Skipped — next due date advanced', 'info');
      load();
    } catch { showToast('Failed to skip', 'error'); }
    finally { setActionLoading(null); }
  };

  // Stats
  const active = items.filter(i => i.is_active);
  const monthlyIncome = active.filter(i => i.type === 'income').reduce((s, i) => {
    const m: Record<string, number> = { daily: 30, weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 0.33, yearly: 0.083 };
    return s + Number(i.amount) * (m[i.frequency] || 1);
  }, 0);
  const monthlyExpense = active.filter(i => i.type === 'expense').reduce((s, i) => {
    const m: Record<string, number> = { daily: 30, weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 0.33, yearly: 0.083 };
    return s + Number(i.amount) * (m[i.frequency] || 1);
  }, 0);
  const dueThisWeek = active.filter(i => { const d = daysUntil(i.next_due); return d >= 0 && d <= 7; });
  const overdue = active.filter(i => daysUntil(i.next_due) < 0);

  const filtered = items.filter(i => {
    if (filter === 'income') return i.type === 'income';
    if (filter === 'expense') return i.type === 'expense';
    if (filter === 'due') return i.is_active && daysUntil(i.next_due) <= 7;
    return true;
  });

  const filteredCats = categories.filter(c => c.type === form.type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', margin: 0 }}>Recurring</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Automate bills, salary, subscriptions and more</p>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)', whiteSpace: 'nowrap' }}>
          + Add Recurring <span style={{ opacity: 0.6, fontSize: 11, fontWeight: 500 }}>N</span>
        </button>
      </div>

      {/* Balance card */}
      <BalanceCard
        balance={balance}
        monthlyIncome={monthlyStats?.income}
        monthlyExpenses={monthlyStats?.expenses}
        projectedBalance={(balance ?? 0) - monthlyExpense}
        projectedLabel="After recurring"
        projectedSub="if all expenses post"
        loading={loading}
        fmt={fmt}
        extras={[{ label: 'Active rules', value: String(active.length), sub: 'recurring transactions' }]}
      />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Monthly income', value: fmt(monthlyIncome), color: 'var(--green)', icon: '↑', sub: 'estimated' },
          { label: 'Monthly expenses', value: fmt(monthlyExpense), color: 'var(--red)', icon: '↓', sub: 'estimated' },
          { label: 'Net monthly', value: fmt(monthlyIncome - monthlyExpense), color: monthlyIncome >= monthlyExpense ? 'var(--green)' : 'var(--red)', icon: '≈', sub: 'income − expenses' },
          { label: 'Due this week', value: String(dueThisWeek.length), color: 'var(--amber)', icon: '⏰', sub: dueThisWeek.length === 1 ? '1 transaction' : `${dueThisWeek.length} transactions` },
        ].map(card => (
          <div key={card.label} style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: card.color }}>{card.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: card.color, letterSpacing: '-0.03em' }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{overdue.length} overdue transaction{overdue.length > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{overdue.map(i => i.description).join(', ')} — post them now or skip to advance the due date</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          ['all', 'All', items.length],
          ['income', 'Income', items.filter(i => i.type === 'income').length],
          ['expense', 'Expenses', items.filter(i => i.type === 'expense').length],
          ['due', 'Due soon', dueThisWeek.length],
        ] as [typeof filter, string, number][]).map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: filter === key ? 'var(--accent)' : 'var(--surface)',
            color: filter === key ? 'white' : 'var(--text-muted)',
            border: `1px solid ${filter === key ? 'var(--accent)' : 'var(--border)'}`,
            boxShadow: filter === key ? '0 2px 8px var(--accent-glow-2)' : 'none',
          }}>
            {label} <span style={{ opacity: 0.65, fontSize: 11 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Skeleton w={40} h={40} r={10} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton w={160} h={12} />
                <Skeleton w={100} h={10} />
              </div>
              <Skeleton w={80} h={12} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          filtered.map((item, idx) => {
            const days = daysUntil(item.next_due);
            const isOverdue = days < 0;
            const isDueSoon = days >= 0 && days <= 3;
            const freqColor = FREQ_COLORS[item.frequency] || '#5b6ef5';

            return (
              <div key={item.id} style={{
                padding: '16px 20px',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: item.is_active ? 1 : 0.45,
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Type icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: item.type === 'income' ? 'rgba(34,212,122,0.12)' : 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, border: `1px solid ${item.type === 'income' ? 'rgba(34,212,122,0.2)' : 'rgba(239,68,68,0.18)'}`,
                }}>
                  {item.type === 'income' ? '↑' : '↓'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </span>
                    {item.auto_post && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>AUTO</span>
                    )}
                    {!item.is_active && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'var(--surface-3)', color: 'var(--text-muted)' }}>PAUSED</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: freqColor + '18', color: freqColor, fontWeight: 600, border: `1px solid ${freqColor}28` }}>
                      {FREQ_LABELS[item.frequency]}
                    </span>
                    {item.category_name && (
                      <span style={{ fontSize: 11, color: item.category_color || 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.category_color || 'var(--text-muted)', display: 'inline-block' }} />
                        {translateCategory(item.category_name)}
                      </span>
                    )}
                    {item.is_active && <DueBadge dateStr={item.next_due} />}
                    {item.end_date && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ends {new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.type === 'income' ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.02em' }}>
                    {item.type === 'income' ? '+' : '−'}{fmt(Number(item.amount))}
                  </div>
                  {item.last_generated && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      last posted {new Date(item.last_generated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {item.is_active && !item.auto_post && (
                    <button
                      onClick={() => handlePostNow(item.id)}
                      disabled={actionLoading === item.id}
                      title="Post this transaction to your ledger now"
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: (isOverdue || isDueSoon) ? 'var(--accent-glow)' : 'var(--surface-2)', color: (isOverdue || isDueSoon) ? 'var(--accent)' : 'var(--text-muted)', border: `1px solid ${(isOverdue || isDueSoon) ? 'var(--accent-glow-2)' : 'var(--border-2)'}`, fontWeight: 600, opacity: actionLoading === item.id ? 0.5 : 1 }}>
                      {actionLoading === item.id ? '…' : 'Post'}
                    </button>
                  )}
                  {item.is_active && (
                    <button
                      onClick={() => handleSkip(item.id)}
                      disabled={actionLoading === item.id}
                      title="Skip this occurrence — advances next due date"
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)', fontWeight: 600, opacity: actionLoading === item.id ? 0.5 : 1 }}>
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(item)}
                    title={item.is_active ? 'Pause this recurring transaction' : 'Resume'}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-2)', fontWeight: 600 }}>
                    {item.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--surface-3)', color: 'var(--text-soft)', border: '1px solid var(--border-2)', fontWeight: 600 }}>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', fontWeight: 600 }}>
                    Del
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upcoming preview */}
      {!loading && dueThisWeek.length > 0 && (
        <div style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Due this week</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dueThisWeek.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.type === 'income' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.description}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(item.next_due).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                  {item.type === 'income' ? '+' : '−'}{fmt(Number(item.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={MODAL_OVERLAY} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={MODAL_BOX}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 2px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
                {editItem ? 'Edit Recurring' : 'New Recurring Transaction'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, padding: 4, lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))} style={{
                  flex: 1, padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none',
                  background: form.type === t ? (t === 'income' ? 'var(--green)' : 'var(--red)') : 'transparent',
                  color: form.type === t ? 'white' : 'var(--text-muted)',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}>{t}</button>
              ))}
            </div>

            {/* Amount + Description */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Amount (IDR) *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" autoFocus min="0" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Category</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">None</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Description *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly salary, Netflix subscription…" />
            </div>

            {/* Frequency */}
            <div>
              <label style={LABEL_STYLE}>Frequency *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {FREQ_OPTIONS.map(([key, label]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, frequency: key }))} style={{
                    padding: '9px 6px', borderRadius: 9, fontSize: 12, fontWeight: 600, border: '1px solid',
                    borderColor: form.frequency === key ? FREQ_COLORS[key] : 'var(--border)',
                    background: form.frequency === key ? FREQ_COLORS[key] + '18' : 'var(--surface-2)',
                    color: form.frequency === key ? FREQ_COLORS[key] : 'var(--text-muted)',
                    transition: 'all 0.12s',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Start Date *</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label style={LABEL_STYLE}>End Date <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional)</span></label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={LABEL_STYLE}>Notes <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional)</span></label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any extra details…" />
            </div>

            {/* Auto-post toggle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => setForm(f => ({ ...f, auto_post: !f.auto_post }))}>
              <div style={{
                width: 40, height: 22, borderRadius: 11, background: form.auto_post ? 'var(--accent)' : 'var(--surface-3)',
                border: `1px solid ${form.auto_post ? 'var(--accent)' : 'var(--border-2)'}`,
                position: 'relative', flexShrink: 0, transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: form.auto_post ? 18 : 2,
                  width: 16, height: 16, borderRadius: 8, background: 'white',
                  transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Auto-post</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  Automatically add to transactions on the due date — no manual posting needed.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 2 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button onClick={handleSave} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                {editItem ? 'Save Changes' : 'Add Recurring'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}