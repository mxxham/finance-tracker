'use client';
import { useState, useRef, useEffect } from 'react';

interface AmountInputProps {
  value: string;
  onChange: (raw: string) => void;
  currency?: string;
  placeholder?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  max?: number;
  disabled?: boolean;
}

// Format a raw number string into a display string with commas
function formatDisplay(raw: string): string {
  if (!raw || raw === '') return '';
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n)) return raw;
  // Format with locale commas, no decimal for whole numbers
  const hasDecimal = raw.includes('.');
  if (hasDecimal) {
    const [intPart, decPart] = raw.split('.');
    const formatted = Number(intPart.replace(/,/g, '') || 0).toLocaleString('en-US');
    return `${formatted}.${decPart.slice(0, 2)}`;
  }
  return n.toLocaleString('en-US');
}

export function AmountInput({
  value,
  onChange,
  currency,
  placeholder = '0',
  autoFocus = false,
  style = {},
  max,
  disabled = false,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const [displayVal, setDisplayVal] = useState(value ? formatDisplay(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value prop changes externally
  useEffect(() => {
    if (!focused) {
      setDisplayVal(value ? formatDisplay(value) : '');
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Strip everything except digits and one decimal point
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
    setDisplayVal(formatDisplay(cleaned));
    // Pass the raw numeric string to parent
    onChange(cleaned);
  };

  const handleFocus = () => {
    setFocused(true);
    // On focus show raw number for easy editing
    setDisplayVal(value || '');
  };

  const handleBlur = () => {
    setFocused(false);
    setDisplayVal(value ? formatDisplay(value) : '');
  };

  const exceedsMax = max !== undefined && Number(value) > max;

  return (
    <div style={{ position: 'relative' }}>
      {currency && (
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', pointerEvents: 'none',
          fontFamily: 'var(--font-mono)',
        }}>
          {currency}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={focused ? (value || '') : displayVal}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        style={{
          fontFamily: 'var(--font-mono)',
          paddingLeft: currency ? 52 : undefined,
          borderColor: exceedsMax ? 'var(--red)' : undefined,
          ...style,
        }}
      />
      {exceedsMax && (
        <div style={{
          position: 'absolute', bottom: -20, left: 0,
          fontSize: 11, color: 'var(--red)', fontWeight: 600,
        }}>
          Exceeds available balance
        </div>
      )}
    </div>
  );
}

