'use client';
import { useState } from 'react';

interface BalanceCardProps {
  balance: number | null;
  monthlyIncome?: number | null;
  monthlyExpenses?: number | null;
  projectedBalance?: number | null;
  projectedLabel?: string;
  projectedSub?: string;
  loading?: boolean;
  fmt: (n: number) => string;
  extras?: { label: string; value: string; sub?: string }[];
}

export function BalanceCard({
  balance,
  monthlyIncome,
  monthlyExpenses,
  projectedBalance,
  projectedLabel = 'Projected',
  projectedSub,
  loading = false,
  fmt,
  extras = [],
}: BalanceCardProps) {
  const [visible, setVisible] = useState(true);
  const mask = '••••••';

  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
      boxShadow: '0 8px 32px var(--accent-glow-2)',
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      {/* Left: main balance */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Current Balance
          </span>
          <button
            onClick={() => setVisible(v => !v)}
            title={visible ? 'Hide balance' : 'Show balance'}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '2px 4px', fontSize: 13, lineHeight: 1 }}
          >
            {visible ? '👁' : '🙈'}
          </button>
        </div>

        {loading ? (
          <div style={{ height: 40, width: 180, borderRadius: 8, background: 'rgba(255,255,255,0.15)', animation: 'pulse 1.5s ease infinite' }} />
        ) : (
          <div style={{ fontSize: 34, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {visible ? fmt(balance ?? 0) : mask}
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          All-time income minus expenses
        </div>
      </div>

      {/* Right: chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {monthlyIncome != null && (
          <Chip label="This month in" value={visible ? '+' + fmt(monthlyIncome) : mask} valueColor="#4ade80" loading={loading} />
        )}
        {monthlyExpenses != null && (
          <Chip label="This month out" value={visible ? '−' + fmt(monthlyExpenses) : mask} valueColor="#f87171" loading={loading} />
        )}
        {projectedBalance != null && (
          <Chip label={projectedLabel} value={visible ? fmt(projectedBalance) : mask} sub={projectedSub} loading={loading} />
        )}
        {extras.map(e => (
          <Chip key={e.label} label={e.label} value={visible ? e.value : mask} sub={e.sub} loading={loading} />
        ))}
      </div>
    </div>
  );
}

function Chip({ label, value, valueColor, sub, loading }: {
  label: string; value: string; valueColor?: string; sub?: string; loading?: boolean;
}) {
  return (
    <div style={{ padding: '11px 15px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: 20, width: 80, borderRadius: 5, background: 'rgba(255,255,255,0.15)', animation: 'pulse 1.5s ease infinite' }} />
      ) : (
        <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-mono)', color: valueColor ?? 'white', letterSpacing: '-0.02em' }}>
          {value}
        </div>
      )}
      {sub && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}