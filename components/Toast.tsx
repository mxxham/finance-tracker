'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage { id: string; message: string; type: ToastType; exiting?: boolean; }

let listeners: ((t: ToastMessage[]) => void)[] = [];
let queue: ToastMessage[] = [];

export function showToast(message: string, type: ToastType = 'success') {
  const id = Math.random().toString(36).slice(2);
  queue = [...queue, { id, message, type }];
  listeners.forEach(fn => fn(queue));
  setTimeout(() => {
    // Mark as exiting first
    queue = queue.map(t => t.id === id ? { ...t, exiting: true } : t);
    listeners.forEach(fn => fn(queue));
    // Then remove after animation
    setTimeout(() => {
      queue = queue.filter(t => t.id !== id);
      listeners.forEach(fn => fn(queue));
    }, 250);
  }, 3600);
}

const ICONS = {
  success: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  error:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  info:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};
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
          <div
            key={t.id}
            className={t.exiting ? 'toast-exit' : 'animate-slideInRight'}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px', borderRadius: 12,
              background: 'var(--surface)', border: `1px solid ${s.border}`,
              color: 'var(--text)', fontSize: 13, fontWeight: 500,
              minWidth: 220, maxWidth: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: s.bg, color: s.accent, flexShrink: 0, border: `1px solid ${s.border}`,
            }}>{ICONS[t.type]}</span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}