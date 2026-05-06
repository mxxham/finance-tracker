'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage { id: string; message: string; type: ToastType; }

let listeners: ((t: ToastMessage[]) => void)[] = [];
let queue: ToastMessage[] = [];

export function showToast(message: string, type: ToastType = 'success') {
  const id = Math.random().toString(36).slice(2);
  queue = [...queue, { id, message, type }];
  listeners.forEach(fn => fn(queue));
  setTimeout(() => {
    queue = queue.filter(t => t.id !== id);
    listeners.forEach(fn => fn(queue));
  }, 3800);
}

const ICONS = { success: '✓', error: '✕', info: 'i' };
const STYLES = {
  success: { accent: '#22d47a', bg: 'rgba(34,212,122,0.08)', border: 'rgba(34,212,122,0.2)' },
  error:   { accent: '#f05252', bg: 'rgba(240,82,82,0.08)',  border: 'rgba(240,82,82,0.2)'  },
  info:    { accent: '#5b6ef5', bg: 'rgba(91,110,245,0.08)', border: 'rgba(91,110,245,0.2)' },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  useEffect(() => {
    listeners.push(setToasts);
    return () => { listeners = listeners.filter(fn => fn !== setToasts); };
  }, []);
  if (!toasts.length) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => {
        const s = STYLES[t.type];
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 12,
            background: 'var(--surface)', border: `1px solid ${s.border}`,
            color: 'var(--text)', fontSize: 13, fontWeight: 500,
            animation: 'slideInRight 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
            minWidth: 220, maxWidth: 340,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
              background: s.bg, color: s.accent, flexShrink: 0, border: `1px solid ${s.border}`,
            }}>{ICONS[t.type]}</span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
