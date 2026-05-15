// Notification service — Web Push API (mobile-first) + in-browser fallback

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotifSupport(): { supported: boolean; pushSupported: boolean } {
  if (typeof window === 'undefined') return { supported: false, pushSupported: false };
  const supported = 'Notification' in window;
  const pushSupported = supported && 'serviceWorker' in navigator && 'PushManager' in window;
  return { supported, pushSupported };
}

export function getPermissionStatus(): NotifPermission {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifPermission;
}

export async function requestPermission(): Promise<NotifPermission> {
  const { supported } = getNotifSupport();
  if (!supported) return 'unsupported';
  const result = await Notification.requestPermission();
  return result as NotifPermission;
}

// Fire a local browser/OS notification immediately
export function sendLocalNotification(
  title: string,
  body: string,
  options: { icon?: string; badge?: string; tag?: string; data?: Record<string, unknown> } = {}
): Notification | null {
  if (getPermissionStatus() !== 'granted') return null;
  const notif = new Notification(title, {
    body,
    icon: options.icon ?? '/icon-192.png',
    badge: options.badge ?? '/icon-72.png',
    tag: options.tag,
    data: options.data,
    // vibrate pattern on mobile (supported in Chrome Android)
    ...({ vibrate: [200, 100, 200] } as object),
  });
  notif.onclick = () => { window.focus(); notif.close(); };
  return notif;
}

// Register service worker and get push subscription
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const { pushSupported } = getNotifSupport();
  if (!pushSupported) return null;
  if (getPermissionStatus() !== 'granted') return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    // Try to get existing subscription first
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // We use a dummy VAPID key here — in production replace with real VAPID keys
      // For now we just use the SW for local notification scheduling
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
        ) as unknown as ArrayBuffer,
      }).catch(() => null);
    }
    return sub;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Save push subscription to our backend
export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
  if (!token) return;
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

// Unsubscribe from push
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    const token = localStorage.getItem('ft_token');
    if (token) {
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    }
  }
}

// ── Budget alert checker ─────────────────────────────────────────────────────
export interface BudgetAlertResult {
  fired: number; // how many alerts were shown
  budgets: { name: string; pct: number; spent: number; limit: number }[];
}

export async function checkBudgetAlerts(
  threshold: number // e.g. 80 means alert at 80%
): Promise<BudgetAlertResult> {
  const token = localStorage.getItem('ft_token');
  if (!token) return { fired: 0, budgets: [] };

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const res = await fetch(`/api/budgets?month=${month}&year=${year}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { fired: 0, budgets: [] };
  const budgets: { category_name: string; amount: number; spent: number }[] = await res.json();

  const alerting = budgets
    .map(b => ({
      name: b.category_name,
      pct: Math.round((Number(b.spent) / Number(b.amount)) * 100),
      spent: Number(b.spent),
      limit: Number(b.amount),
    }))
    .filter(b => b.pct >= threshold && b.limit > 0);

  // Deduplicate — don't fire the same alert twice in a session
  const STORAGE_KEY = `ft_notif_sent_${month}_${year}`;
  const alreadySent: string[] = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  const toFire = alerting.filter(b => !alreadySent.includes(`${b.name}_${Math.floor(b.pct / 10) * 10}`));

  let fired = 0;
  for (const budget of toFire) {
    const tag = `${budget.name}_${Math.floor(budget.pct / 10) * 10}`;
    const emoji = budget.pct >= 100 ? '🚨' : budget.pct >= 90 ? '⚠️' : '📊';
    const title = budget.pct >= 100
      ? `${budget.name} budget exceeded!`
      : `${budget.name} at ${budget.pct}%`;
    const body = budget.pct >= 100
      ? `You've spent ${budget.spent.toLocaleString()} of your ${budget.limit.toLocaleString()} limit`
      : `Spent ${budget.spent.toLocaleString()} of ${budget.limit.toLocaleString()} — ${budget.limit - budget.spent > 0 ? `${(budget.limit - budget.spent).toLocaleString()} remaining` : 'limit reached'}`;

    // Try SW notification first (works when app is in background on mobile)
    let sent = false;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(`${emoji} FinTrack — ${title}`, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          tag: `budget-${tag}`,
          data: { url: '/dashboard/budgets' },
          ...({ vibrate: [200, 100, 200] } as object),
          ...({ renotify: true } as object),
        });
        sent = true;
      } catch { /* fall through to basic notification */ }
    }

    if (!sent) {
      sendLocalNotification(`${emoji} FinTrack — ${title}`, body, { tag: `budget-${tag}` });
    }

    alreadySent.push(tag);
    fired++;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(alreadySent));
  return { fired, budgets: alerting };
}

// ── Test notification ─────────────────────────────────────────────────────────
export async function sendTestNotification(): Promise<boolean> {
  const perm = getPermissionStatus();
  if (perm !== 'granted') return false;

  const sent = await (async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('✅ FinTrack notifications active!', {
          body: 'You\'ll get alerts when your budget approaches its limit.',
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          tag: 'ft-test',
          data: { url: '/dashboard/budgets' },
          ...({ vibrate: [100, 50, 100] } as object),
        });
        return true;
      } catch { return false; }
    }
    return false;
  })();

  if (!sent) {
    sendLocalNotification('✅ FinTrack notifications active!', 'You\'ll get alerts when your budget approaches its limit.', { tag: 'ft-test' });
  }
  return true;
}
