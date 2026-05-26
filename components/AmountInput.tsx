'use client';
import { useRef, useEffect, useCallback } from 'react';

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

// Format integer part only with commas — no decimal support needed for most currencies
function formatWithCommas(raw: string): string {
  if (!raw) return '';
  // Strip existing commas, keep only digits
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the formatted display value from the raw numeric string
  const formatted = formatWithCommas(value);

  // Sync input display whenever formatted value changes
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (el !== document.activeElement) {
      el.value = formatted;
    }
  }, [formatted]);

  // Set initial value
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = formatted;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const cursorPos = el.selectionStart ?? 0;
    const prevFormatted = el.value;

    // Strip everything except digits
    const digits = prevFormatted.replace(/[^0-9]/g, '');
    const newFormatted = digits ? Number(digits).toLocaleString('en-US') : '';

    // Count how many commas were before the cursor in old value
    const commasBefore = (prevFormatted.slice(0, cursorPos).match(/,/g) || []).length;

    // Set formatted value
    el.value = newFormatted;

    // Restore cursor: account for added/removed commas
    const newCommasBefore = (newFormatted.slice(0, cursorPos).match(/,/g) || []).length;
    const diff = newCommasBefore - commasBefore;
    const newCursor = Math.max(0, cursorPos + diff);
    el.setSelectionRange(newCursor, newCursor);

    // Pass raw digits up to parent
    onChange(digits);
  }, [onChange]);

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
        inputMode="numeric"
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onInput={handleInput}
        defaultValue={formatted}
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
