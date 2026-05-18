'use client';
import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Avoid service worker issues in Vercel/production while debugging auth + update problems.
    // Re-enable later with a proper caching/versioning strategy.
    if (process.env.NODE_ENV === 'production') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[SW] Registered, scope:', reg.scope);
        })
        .catch(err => {
          console.warn('[SW] Registration failed:', err);
        });
    }
  }, []);

  return null;
}

