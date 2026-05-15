import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

async function ensureTable() {
  await initDB();
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subscription JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `);
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const user = requireAuth(req);
    const { subscription } = await req.json();
    if (!subscription) return NextResponse.json({ error: 'No subscription' }, { status: 400 });
    await query(
      `INSERT INTO push_subscriptions (user_id, subscription, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET subscription = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(subscription)]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const user = requireAuth(req);
    await query('DELETE FROM push_subscriptions WHERE user_id = $1', [user.userId]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
