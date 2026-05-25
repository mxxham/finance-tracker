'use client';
import { useState } from 'react';

export interface BalanceChip {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}

interface BalanceCardProps {
  /** Left-side headline number */
  balance: number | null;
  balanceLabel?: string;
  balanceSub?: string;
  /** Right-side chips */
  chips: BalanceChip[];
  loading?: boolean;
  fmt: (n: number) => string;
  /** 'full' = large gradient card (recurring, overview)
   *  'compact' = slightly smaller, fewer chips visible */
  variant?: 'full' | 'compact';
  /** Optional second line under the balance (e.g. progress bar) */
  footer?: React.ReactNode;
}

export function BalanceCard({
  balance,
  balanceLabel = 'Current Balance',
  balanceSub = 'All-time income minus expenses',
  chips,
  loading = false,
  fmt,
  variant = 'full',
  footer,
}: BalanceCardProps) {
  const [visible, setVisible] = useState(true);
  const mask = '•••••';
  const isFull = variant === 'full';

  return (
    <div style={{
      padding: isFull ? '22px 26px' : '16px 20px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
      boxShadow: '0 8px 32px var(--accent-glow-2)',
      display: 'flex',
      alignItems: 'center',
      gap: isFull ? 24 : 16,
      flexWrap: 'wrap',
    }}>

      {/* Left: main figure */}
      <div style={{ flex: '1 1 180px', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isFull ? 8 : 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {balanceLabel}
          </span>
          <button
            onClick={() => setVisible(v => !v)}
            title={visible ? 'Hide' : 'Show'}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: '1px 3px', fontSize: 12, lineHeight: 1 }}
          >
            {visible ? '👁' : '🙈'}
          </button>
        </div>

        {loading ? (
          <div style={{ height: isFull ? 42 : 32, width: 180, borderRadius: 8, background: 'rgba(255,255,255,0.15)', animation: 'pulse 1.5s ease infinite' }} />
        ) : (
          <div style={{
            fontSize: isFull ? 36 : 28,
            fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            color: 'white',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>
            {visible ? fmt(balance ?? 0) : mask}
          </div>
        )}

        <div style={{ marginTop: isFull ? 7 : 4, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          {balanceSub}
        </div>

        {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
      </div>

      {/* Right: chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {chips.map((chip, i) => (
          <Chip key={i} chip={chip} visible={visible} mask={mask} loading={loading} compact={!isFull} />
        ))}
      </div>
    </div>
  );
}

function Chip({ chip, visible, mask, loading, compact }: {
  chip: BalanceChip; visible: boolean; mask: string; loading?: boolean; compact: boolean;
}) {
  return (
    <div style={{
      padding: compact ? '9px 13px' : '12px 16px',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.1)',
      backdropFilter: 'blur(4px)',
      minWidth: compact ? 100 : 115,
    }}>
      <div style={{
        fontSize: 10, color: 'rgba(255,255,255,0.55)',
        fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: 5,
      }}>
        {chip.label}
      </div>
      {loading ? (
        <div style={{ height: 18, width: 75, borderRadius: 5, background: 'rgba(255,255,255,0.15)', animation: 'pulse 1.5s ease infinite' }} />
      ) : (
        <div style={{
          fontSize: compact ? 15 : 17,
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: chip.valueColor ?? 'white',
          letterSpacing: '-0.02em',
        }}>
          {visible ? chip.value : mask}
        </div>
      )}
      {chip.sub && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{chip.sub}</div>
      )}
    </div>
  );
}
