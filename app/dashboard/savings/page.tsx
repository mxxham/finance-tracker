'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';
import { BalanceCard } from '@/components/BalanceCard';
import { showToast } from '@/components/Toast';

// ── Types ───────────────────────────────────────────────────────
interface Contribution {
  id: number;
  amount: number;
  note: string | null;
  date: string;
}

interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  icon: string;
  deadline: string | null;
  notes: string | null;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  contribution_count: number;
  recent_contributions: Contribution[] | null;
}

// ── Constants ────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#5b6ef5','#22d47a','#f5a623','#f05252','#a78bfa',
  '#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16',
];

const PRESET_ICONS = [
  '🎯','🏠','🚗','✈️','💍','📱','💻','🎓','🏖️','🏋️',
  '🛍️','🎮','📷','🎵','🏥','💰','🐾','🌱','⚽','🎪',
];

const EMPTY_ICON = (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function monthsUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────

function Skeleton({ w, h, r = 8 }: { w?: string | number; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w ?? '100%', height: h, borderRadius: r }} />;
}

function AnimatedRing({ pct, color, size = 120 }: { pct: number; color: string; size?: number }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(Math.min(pct, 100)), 80);
    return () => clearTimeout(t);
  }, [pct]);
  const r = (size - 18) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${(animPct / 100) * circ} ${circ}`}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cx}px`, transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.1,0.64,1)' }}
      />
      {pct >= 100 && (
        <text x={cx} y={cx + 5} textAnchor="middle" fontSize="18" fill={color} style={{ userSelect: 'none' }}>✓</text>
      )}
    </svg>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(Math.min(pct, 100)), 80); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ height: '100%', borderRadius: 99, width: `${w}%`, background: color, transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)', boxShadow: `0 0 8px ${color}55`, minWidth: w > 0 ? 6 : 0 }} />
  );
}

// ── Modal ─────────────────────────────────────────────────────────
interface GoalModalProps {
  initial?: Partial<SavingsGoal>;
  onClose: () => void;
  onSave: (data: Partial<SavingsGoal>) => Promise<void>;
  saving: boolean;
  fmt: (n: number) => string;
}

function GoalModal({ initial, onClose, onSave, saving, fmt }: GoalModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial?.target_amount ? String(initial.target_amount) : '');
  const [current, setCurrent] = useState(initial?.current_amount ? String(initial.current_amount) : '');
  const [color, setColor] = useState(initial?.color ?? '#5b6ef5');
  const [icon, setIcon] = useState(initial?.icon ?? '🎯');
  const [deadline, setDeadline] = useState(initial?.deadline ? initial.deadline.slice(0, 10) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const isEdit = !!initial?.id;

  const handleSubmit = async () => {
    if (!name.trim() || !target) { showToast('Name and target are required', 'error'); return; }
    await onSave({ name: name.trim(), target_amount: Number(target), current_amount: Number(current) || 0, color, icon, deadline: deadline || undefined, notes: notes || undefined });
  };

  const suggestedMonthly = (): string => {
    if (!target || !deadline) return '';
    const months = monthsUntil(deadline);
    if (months <= 0) return '';
    const remaining = Number(target) - (Number(current) || 0);
    if (remaining <= 0) return '';
    return fmt(Math.ceil(remaining / months)) + '/mo';
  };

  const monthlyHint = suggestedMonthly();

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 520, borderRadius: '20px 20px 0 0', background: 'var(--surface)', border: '1px solid var(--border-2)', padding: '20px 20px 40px', boxShadow: '0 -8px 48px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>{isEdit ? 'Edit Goal' : 'New Savings Goal'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4 }}>&times;</button>
        </div>

        {/* Icon picker */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESET_ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={{ width: 38, height: 38, borderRadius: 10, fontSize: 20, background: icon === ic ? color + '30' : 'var(--surface-2)', border: `2px solid ${icon === ic ? color : 'var(--border)'}`, transition: 'all 0.15s' }}>{ic}</button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${color === c ? 'white' : 'transparent'}`, boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goal Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Emergency fund, New laptop…" autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Amount</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0" min="0" />
          </div>
          {!isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Already Saved</label>
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)} placeholder="0" min="0" />
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deadline (optional)</label>
            {monthlyHint && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>→ save {monthlyHint}</span>}
          </div>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What is this goal for?" rows={2} style={{ resize: 'none' }} />
        </div>

        {/* Preview */}
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--surface-2)', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '20', border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Goal name'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{target ? fmt(Number(target)) : '—'}{deadline ? ` · by ${formatDate(deadline)}` : ''}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, background: color, color: 'white', border: 'none', boxShadow: `0 4px 16px ${color}55`, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contribute Modal ──────────────────────────────────────────────
interface ContributeModalProps {
  goal: SavingsGoal;
  mode: 'add' | 'withdraw';
  availableBalance: number;
  onClose: () => void;
  onDone: () => void;
  fmt: (n: number) => string;
}

function ContributeModal({ goal, mode, availableBalance, onClose, onDone, fmt }: ContributeModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const remaining = Number(goal.target_amount) - Number(goal.current_amount);
  const isAdd = mode === 'add';
  // For add mode: cap by both remaining goal amount and user's available balance
  const maxAdd = isAdd ? Math.min(remaining, availableBalance) : Number(goal.current_amount);

  const quickAmounts = isAdd
    ? [10000, 50000, 100000, 250000, 500000].filter(a => a <= maxAdd)
    : [10000, 50000, 100000].filter(a => a <= Number(goal.current_amount));

  const enteredAmount = Number(amount);
  const exceedsBalance = isAdd && enteredAmount > availableBalance;
  const exceedsRemaining = isAdd && enteredAmount > remaining;

  const handleSubmit = async () => {
    if (!amount || enteredAmount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (isAdd && enteredAmount > availableBalance) {
      showToast(`Insufficient balance. You only have ${fmt(availableBalance)} available.`, 'error');
      return;
    }
    if (!isAdd && enteredAmount > Number(goal.current_amount)) { showToast('Cannot withdraw more than current savings', 'error'); return; }
    setLoading(true);
    try {
      if (isAdd) {
        await api.contributeToGoal(goal.id, enteredAmount, note || undefined, date);
      } else {
        await api.withdrawFromGoal(goal.id, enteredAmount, note || undefined, date);
      }
      showToast(isAdd ? `Added ${fmt(enteredAmount)} to ${goal.name}` : `Withdrew ${fmt(enteredAmount)} from ${goal.name}`);
      onDone();
    } catch { showToast('Failed to update goal', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 420, borderRadius: '20px 20px 0 0', background: 'var(--surface)', border: '1px solid var(--border-2)', padding: '20px 20px 40px', boxShadow: '0 -8px 48px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '0 auto 4px' }} />

        {/* Goal summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: goal.color + '20', border: `1.5px solid ${goal.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{goal.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{isAdd ? 'Add Money' : 'Withdraw Money'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{goal.name} · {fmt(Number(goal.current_amount))} saved</div>
          </div>
        </div>

        {isAdd && remaining > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: goal.color + '12', border: `1px solid ${goal.color}25`, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>{fmt(remaining)}</span> remaining to reach your goal
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: availableBalance > 0 ? 'rgba(34,212,122,0.08)' : 'rgba(240,82,82,0.08)', border: `1px solid ${availableBalance > 0 ? 'rgba(34,212,122,0.2)' : 'rgba(240,82,82,0.2)'}`, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{availableBalance > 0 ? '💰' : '⚠️'}</span>
              <span style={{ color: 'var(--text-muted)' }}>Available balance:</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: availableBalance > 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(availableBalance)}</span>
            </div>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus min="0" max={isAdd ? availableBalance : undefined} style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, borderColor: exceedsBalance ? 'var(--red)' : undefined }} />
          {exceedsBalance && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
              ⚠️ Exceeds your available balance of {fmt(availableBalance)}
            </div>
          )}
          {exceedsRemaining && !exceedsBalance && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
              This will overshoot your goal target
            </div>
          )}
          {quickAmounts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {quickAmounts.map(a => (
                <button key={a} onClick={() => setAmount(String(a))} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {fmt(a)}
                </button>
              ))}
              {isAdd && maxAdd > 0 && (
                <button onClick={() => setAmount(String(Math.floor(maxAdd)))} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: goal.color + '20', color: goal.color, border: `1px solid ${goal.color}30` }}>
                  {remaining <= availableBalance ? `Fill gap (${fmt(remaining)})` : `Max available (${fmt(availableBalance)})`}
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Salary…" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading || (isAdd && exceedsBalance)} style={{ flex: 2, padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, background: isAdd ? (exceedsBalance ? 'var(--surface-2)' : goal.color) : 'var(--red)', color: exceedsBalance ? 'var(--text-muted)' : 'white', border: 'none', boxShadow: exceedsBalance ? 'none' : `0 4px 16px ${isAdd ? goal.color : 'var(--red)'}55`, opacity: loading ? 0.7 : 1 }}>
            {loading ? '…' : exceedsBalance ? 'Insufficient balance' : isAdd ? `Add ${amount ? fmt(enteredAmount) : 'Money'}` : `Withdraw ${amount ? fmt(enteredAmount) : 'Money'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────
function GoalDetailPanel({ goal, fmt, onContribute, onWithdraw, onEdit, onDelete, onClose, onStatusChange }: {
  goal: SavingsGoal;
  fmt: (n: number) => string;
  onContribute: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onStatusChange: (status: 'active' | 'paused' | 'completed') => void;
}) {
  const pct = Number(goal.target_amount) > 0 ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100) : 0;
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const isCompleted = goal.status === 'completed';
  const isPaused = goal.status === 'paused';

  const daysLeft = goal.deadline ? daysUntil(goal.deadline) : null;
  const monthsLeft = goal.deadline ? monthsUntil(goal.deadline) : null;
  const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0 ? Math.ceil(remaining / monthsLeft) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && !isCompleted;
  const contributions = goal.recent_contributions ?? [];

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', background: `linear-gradient(135deg, ${goal.color}12, transparent 60%)` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: goal.color + '20', border: `2px solid ${goal.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{goal.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 3 }}>{goal.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: isCompleted ? 'var(--green-muted)' : isPaused ? 'var(--amber-muted)' : goal.color + '20', color: isCompleted ? 'var(--green)' : isPaused ? 'var(--amber)' : goal.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {goal.status}
                </span>
                {isOverdue && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'var(--red-muted)', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>&times;</button>
        </div>

        {/* Ring + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <AnimatedRing pct={pct} color={isCompleted ? 'var(--green)' : goal.color} size={110} />
            {!isCompleted && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{pct.toFixed(0)}%</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Saved', value: fmt(Number(goal.current_amount)), color: goal.color },
                { label: 'Target', value: fmt(Number(goal.target_amount)), color: 'var(--text-muted)' },
                { label: 'Remaining', value: fmt(remaining), color: remaining === 0 ? 'var(--green)' : 'var(--text)' },
                { label: 'Contributions', value: String(goal.contribution_count), color: 'var(--text-muted)' },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deadline + monthly needed */}
      {goal.deadline && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deadline: <strong style={{ color: isOverdue ? 'var(--red)' : 'var(--text-soft)' }}>{formatDate(goal.deadline)}</strong></span>
          </div>
          {daysLeft !== null && (
            <span style={{ fontSize: 12, fontWeight: 700, color: isOverdue ? 'var(--red)' : daysLeft < 30 ? 'var(--amber)' : 'var(--green)' }}>
              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
            </span>
          )}
        </div>
      )}
      {monthlyNeeded && !isCompleted && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-muted)' }}>
          Save <strong style={{ color: goal.color }}>{fmt(monthlyNeeded)}/month</strong> to reach your goal on time
        </div>
      )}

      {/* Notes */}
      {goal.notes && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
          "{goal.notes}"
        </div>
      )}

      {/* Actions */}
      {!isCompleted && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onContribute} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: goal.color, color: 'white', border: 'none', boxShadow: `0 4px 16px ${goal.color}40` }}>
            + Add Money
          </button>
          {Number(goal.current_amount) > 0 && (
            <button onClick={onWithdraw} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Withdraw
            </button>
          )}
        </div>
      )}
      {isCompleted && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={() => onStatusChange('active')} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Reopen Goal
          </button>
          {Number(goal.current_amount) > 0 && (
            <button onClick={onWithdraw} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--green-muted)', color: 'var(--green)', border: '1px solid rgba(34,212,122,0.25)' }}>
              Withdraw Savings
            </button>
          )}
        </div>
      )}

      {/* Status toggle */}
      {!isCompleted && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => onStatusChange(isPaused ? 'active' : 'paused')}
            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, fontWeight: 600, background: isPaused ? 'var(--green-muted)' : 'var(--amber-muted)', color: isPaused ? 'var(--green)' : 'var(--amber)', border: `1px solid ${isPaused ? 'rgba(34,212,122,0.2)' : 'rgba(245,166,35,0.2)'}` }}>
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={onEdit} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            ✏️ Edit
          </button>
          <button onClick={onDelete} style={{ marginLeft: 'auto', fontSize: 11, padding: '5px 12px', borderRadius: 7, fontWeight: 600, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)' }}>
            Delete
          </button>
        </div>
      )}
      {isCompleted && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onEdit} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>✏️ Edit</button>
          <button onClick={onDelete} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, fontWeight: 600, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)' }}>Delete</button>
        </div>
      )}

      {/* Recent contributions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Recent Activity</div>
        {contributions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>No contributions yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contributions.map(c => {
              const isDeposit = Number(c.amount) > 0;
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: isDeposit ? 'var(--green-muted)' : 'var(--red-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                    {isDeposit ? '↑' : '↓'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isDeposit ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                      {isDeposit ? '+' : ''}{fmt(Math.abs(Number(c.amount)))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.note || (isDeposit ? 'Contribution' : 'Withdrawal')} · {formatDate(c.date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────
function GoalCard({ goal, onSelect, isSelected, fmt }: {
  goal: SavingsGoal;
  onSelect: () => void;
  isSelected: boolean;
  fmt: (n: number) => string;
}) {
  const pct = Number(goal.target_amount) > 0 ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100) : 0;
  const isCompleted = goal.status === 'completed';
  const isPaused = goal.status === 'paused';
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const daysLeft = goal.deadline ? daysUntil(goal.deadline) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && !isCompleted;

  // Monthly amount needed
  const monthsLeft = goal.deadline ? monthsUntil(goal.deadline) : null;
  const monthlyNeeded = monthsLeft !== null && monthsLeft > 0 ? remaining / monthsLeft : null;

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${isSelected ? goal.color : isCompleted ? 'rgba(34,212,122,0.25)' : 'var(--border)'}`,
        borderRadius: 16, padding: '16px 18px', cursor: 'pointer',
        transition: 'all 0.18s ease',
        opacity: isPaused ? 0.75 : 1,
        boxShadow: isSelected ? `0 0 0 1px ${goal.color}40, 0 6px 24px ${goal.color}18` : '0 1px 4px rgba(0,0,0,0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = goal.color + '70'; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = isCompleted ? 'rgba(34,212,122,0.25)' : 'var(--border)'; }}
    >
      {/* Colored top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isCompleted ? 'var(--green)' : isPaused ? 'var(--amber)' : goal.color, opacity: isSelected ? 1 : 0.5, borderRadius: '16px 16px 0 0' }} />

      {/* Header row: icon + name + pct */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: 4 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: goal.color + '22', border: `1.5px solid ${goal.color}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{goal.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            background: isCompleted ? 'rgba(34,212,122,0.12)' : isPaused ? 'rgba(245,166,35,0.12)' : isOverdue ? 'rgba(240,82,82,0.12)' : goal.color + '18',
            color: isCompleted ? 'var(--green)' : isPaused ? 'var(--amber)' : isOverdue ? 'var(--red)' : goal.color,
          }}>
            {isCompleted ? '✓ Done' : isPaused ? '⏸ Paused' : isOverdue ? '⚠ Overdue' : '● Active'}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isCompleted ? 'var(--green)' : goal.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{pct.toFixed(0)}<span style={{ fontSize: 12, fontWeight: 600 }}>%</span></div>
        </div>
      </div>

      {/* Progress bar — thicker and more visible */}
      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 10 }}>
        <MiniBar pct={pct} color={isCompleted ? 'var(--green)' : goal.color} />
      </div>

      {/* Amount row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-soft)' }}>{fmt(Number(goal.current_amount))}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>saved</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{fmt(Number(goal.target_amount))}</span>
      </div>

      {/* Footer: days left + monthly needed */}
      {!isCompleted && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: isOverdue ? 'var(--red)' : daysLeft !== null && daysLeft < 30 ? 'var(--amber)' : 'var(--text-muted)' }}>
            {daysLeft !== null ? (isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`) : (isPaused ? 'Paused' : 'No deadline')}
          </span>
          {monthlyNeeded !== null && !isPaused && (
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {fmt(monthlyNeeded)}<span style={{ fontFamily: 'inherit' }}>/mo needed</span>
            </span>
          )}
        </div>
      )}
      {isCompleted && (
        <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>Goal reached! 🎉</div>
      )}
    </div>
  );
}

// ── Summary Stats ─────────────────────────────────────────────────
function SummaryStats({ goals, fmt }: { goals: SavingsGoal[]; fmt: (n: number) => string }) {
  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {[
        { label: 'Total Saved', value: fmt(totalSaved), sub: `across ${goals.length} goal${goals.length !== 1 ? 's' : ''}`, color: 'var(--accent)' },
        { label: 'Total Target', value: fmt(totalTarget), sub: `${overallPct.toFixed(0)}% achieved overall`, color: 'var(--text-muted)' },
        { label: 'Active Goals', value: String(active.length), sub: active.filter(g => g.deadline && daysUntil(g.deadline) < 30 && daysUntil(g.deadline) >= 0).length > 0 ? `${active.filter(g => g.deadline && daysUntil(g.deadline) < 30 && daysUntil(g.deadline) >= 0).length} due soon` : 'on track', color: 'var(--green)' },
        { label: 'Completed', value: String(completed.length), sub: completed.length > 0 ? 'goals reached 🎉' : 'keep going!', color: completed.length > 0 ? 'var(--green)' : 'var(--text-muted)' },
      ].map((item, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: item.color, opacity: 0.8 }} />
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{item.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color, marginBottom: 2, letterSpacing: '-0.03em' }}>{item.value}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Spending Alert Banner ─────────────────────────────────────────
interface SpendingAlert {
  categoryName: string;
  spent: number;
  limit: number;
  pct: number;
  color: string;
}

function SpendingAlertBanner({ alerts, fmt, onDismiss }: { alerts: SpendingAlert[]; fmt: (n: number) => string; onDismiss: () => void }) {
  if (alerts.length === 0) return null;
  const overBudget = alerts.filter(a => a.pct >= 100);
  const nearLimit = alerts.filter(a => a.pct >= 80 && a.pct < 100);

  return (
    <div style={{ background: 'var(--surface)', border: `1.5px solid ${overBudget.length > 0 ? 'var(--red)' : 'var(--amber)'}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{overBudget.length > 0 ? '🚨' : '⚠️'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: overBudget.length > 0 ? 'var(--red)' : 'var(--amber)' }}>
            {overBudget.length > 0 ? `${overBudget.length} budget${overBudget.length > 1 ? 's' : ''} exceeded this month` : `${nearLimit.length} budget${nearLimit.length > 1 ? 's' : ''} near limit`}
          </span>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 2 }}>&times;</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts.map(a => (
          <div key={a.categoryName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.pct >= 100 ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-soft)', flex: 1 }}>{a.categoryName}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: a.pct >= 100 ? 'var(--red)' : 'var(--amber)' }}>
              {fmt(a.spent)} / {fmt(a.limit)} ({a.pct.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Consider reducing spending in these categories before adding to savings.
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SavingsPage() {
  const { fmt } = useSettings();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<{ goal: SavingsGoal; mode: 'add' | 'withdraw' } | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [spendingAlerts, setSpendingAlerts] = useState<SpendingAlert[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  const selectedGoal = goals.find(g => g.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stats, budgets] = await Promise.all([
        api.getSavingsGoals(),
        api.getStats(),
        api.getBudgets({ month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) }),
      ]);
      setGoals(Array.isArray(data) ? data : []);

      // Available balance = all-time income minus all-time expenses minus already saved in goals
      const totalSaved = Array.isArray(data) ? data.reduce((s: number, g: SavingsGoal) => s + Number(g.current_amount), 0) : 0;
      const balance = Math.max(0, Number(stats.balance || 0) - totalSaved);
      setAvailableBalance(balance);

      // Build spending alerts: budgets >= 80% used
      const alerts: SpendingAlert[] = (Array.isArray(budgets) ? budgets : [])
        .filter((b: { amount: number; spent: number }) => Number(b.amount) > 0)
        .map((b: { category_name: string; amount: number; spent: number; category_color: string }) => ({
          categoryName: b.category_name,
          spent: Number(b.spent),
          limit: Number(b.amount),
          pct: (Number(b.spent) / Number(b.amount)) * 100,
          color: b.category_color,
        }))
        .filter((a: SpendingAlert) => a.pct >= 80)
        .sort((a: SpendingAlert, b: SpendingAlert) => b.pct - a.pct);
      setSpendingAlerts(alerts);
    } catch { showToast('Failed to load savings goals', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // No auto-selection — user opens detail panel by clicking a card

  const handleCreate = async (data: Partial<SavingsGoal>) => {
    setModalSaving(true);
    try {
      await api.createSavingsGoal(data);
      showToast('Goal created!');
      setShowNewModal(false);
      await load();
    } catch { showToast('Failed to create goal', 'error'); }
    finally { setModalSaving(false); }
  };

  const handleEdit = async (data: Partial<SavingsGoal>) => {
    if (!editGoal) return;
    setModalSaving(true);
    try {
      await api.updateSavingsGoal(editGoal.id, data);
      showToast('Goal updated!');
      setEditGoal(null);
      await load();
    } catch { showToast('Failed to update goal', 'error'); }
    finally { setModalSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedGoal) return;
    if (!confirm(`Delete "${selectedGoal.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteSavingsGoal(selectedGoal.id);
      showToast('Goal deleted', 'info');
      setSelectedId(null);
      await load();
    } catch { showToast('Failed to delete goal', 'error'); }
  };

  const handleStatusChange = async (status: 'active' | 'paused' | 'completed') => {
    if (!selectedGoal) return;
    try {
      await api.updateSavingsGoal(selectedGoal.id, { status });
      await load();
    } catch { showToast('Failed to update status', 'error'); }
  };

  const filteredGoals = goals.filter(g => filter === 'all' || g.status === filter);

  const tabBtn = (f: typeof filter): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
    background: filter === f ? 'var(--accent)' : 'transparent',
    color: filter === f ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 2 }}>Savings Goals</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {loading ? 'Loading…' : goals.length === 0 ? 'Set a goal and start saving' : `${goals.filter(g => g.status === 'active').length} active · ${goals.filter(g => g.status === 'completed').length} completed`}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          + New Goal
        </button>
      </div>

      {/* Spending alerts */}
      {!alertsDismissed && spendingAlerts.length > 0 && (
        <SpendingAlertBanner alerts={spendingAlerts} fmt={fmt} onDismiss={() => setAlertsDismissed(true)} />
      )}

      {/* ── Savings Overview Card ── */}
      {(() => {
        const active = goals.filter(g => g.status === 'active');
        const completed = goals.filter(g => g.status === 'completed');
        const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
        const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
        const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
        return (
          <BalanceCard
            balance={availableBalance}
            balanceLabel="Available to Save"
            balanceSub={availableBalance > 0 ? 'Ready to put toward goals' : 'Top up your account first'}
            loading={loading}
            fmt={fmt}
            variant="full"
            chips={[
              { label: 'Total Saved', value: totalSaved > 0 ? fmt(totalSaved) : '—', sub: `across ${goals.length} goal${goals.length !== 1 ? 's' : ''}` },
              { label: 'Total Target', value: totalTarget > 0 ? fmt(totalTarget) : '—', sub: overallPct > 0 ? overallPct.toFixed(0) + '% achieved' : 'no goals yet' },
              { label: 'Active', value: String(active.length), valueColor: active.length > 0 ? '#4ade80' : 'white', sub: 'goals in progress' },
              { label: 'Completed', value: String(completed.length), valueColor: completed.length > 0 ? '#4ade80' : 'white', sub: completed.length > 0 ? '🎉 great job!' : 'keep going!' },
            ]}
          />
        );
      })()}

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} h={72} r={14} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <Skeleton w={40} h={40} r={11} /><div style={{ flex: 1 }}><Skeleton h={13} /><Skeleton w="60%" h={10} /></div>
                </div>
                <Skeleton h={6} r={99} /><Skeleton h={10} w="70%" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && goals.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🎯</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 6 }}>Start saving for what matters</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>
              Set a target, pick a deadline, and track your progress. Goals auto-calculate how much to save each month.
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {['🏠 Emergency fund', '✈️ Vacation', '💻 New laptop', '🎓 Education'].map(item => (
              <div key={item} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>{item}</div>
            ))}
          </div>
          <button onClick={() => setShowNewModal(true)} style={{ padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
            Create your first goal →
          </button>
        </div>
      )}

      {/* Main content: filter tabs + goals list + detail panel */}
      {!loading && goals.length > 0 && (
        <>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
            {(['all', 'active', 'paused', 'completed'] as const).map(f => (
              <button key={f} style={tabBtn(f)} onClick={() => setFilter(f)}>
                {f === 'all' ? `All (${goals.length})` : f === 'active' ? `Active (${goals.filter(g => g.status === 'active').length})` : f === 'paused' ? `Paused (${goals.filter(g => g.status === 'paused').length})` : `Done (${goals.filter(g => g.status === 'completed').length})`}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedGoal ? '1fr 360px' : '1fr', gap: 14, alignItems: 'start' }}>

            {/* Goal cards grid */}
            {filteredGoals.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No {filter} goals yet
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedGoal ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {filteredGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    fmt={fmt}
                    isSelected={selectedId === goal.id}
                    onSelect={() => setSelectedId(selectedId === goal.id ? null : goal.id)}
                  />
                ))}
              </div>
            )}

            {/* Detail panel */}
            {selectedGoal && (
              <div style={{ position: 'sticky', top: 20 }}>
                <GoalDetailPanel
                  goal={selectedGoal}
                  fmt={fmt}
                  onContribute={() => setContributeGoal({ goal: selectedGoal, mode: 'add' })}
                  onWithdraw={() => setContributeGoal({ goal: selectedGoal, mode: 'withdraw' })}
                  onEdit={() => setEditGoal(selectedGoal)}
                  onDelete={handleDelete}
                  onClose={() => setSelectedId(null)}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showNewModal && (
        <GoalModal
          onClose={() => setShowNewModal(false)}
          onSave={handleCreate}
          saving={modalSaving}
          fmt={fmt}
        />
      )}
      {editGoal && (
        <GoalModal
          initial={editGoal}
          onClose={() => setEditGoal(null)}
          onSave={handleEdit}
          saving={modalSaving}
          fmt={fmt}
        />
      )}
      {contributeGoal && (
        <ContributeModal
          goal={contributeGoal.goal}
          mode={contributeGoal.mode}
          availableBalance={availableBalance}
          onClose={() => setContributeGoal(null)}
          onDone={async () => { setContributeGoal(null); await load(); }}
          fmt={fmt}
        />
      )}
    </div>
  );
}
