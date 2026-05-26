import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Configure VAPID — set these in your environment variables
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL ?? 'mailto:admin@fintrack.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ error: 'Push notifications not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY' }, { status: 503 });
    }

    const body = await req.json();
    const { title, message, url = '/dashboard', tag } = body;
    if (!title || !message) return NextResponse.json({ error: 'title and message required' }, { status: 400 });

    // Fetch this user's push subscription
    const result = await query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
      [user.userId]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: 'No push subscription found for this user' }, { status: 404 });
    }

    const subscription = result.rows[0].subscription;

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      tag: tag ?? 'fintrack',
      data: { url },
    });

    await webpush.sendNotification(subscription, payload);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    // 410 Gone = subscription expired, clean it up
    if (message.includes('410') || message.includes('Gone')) {
      const user = requireAuth(req);
      await query('DELETE FROM push_subscriptions WHERE user_id = $1', [user.userId]).catch(() => {});
      return NextResponse.json({ error: 'Subscription expired — user must re-subscribe' }, { status: 410 });
    }
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
