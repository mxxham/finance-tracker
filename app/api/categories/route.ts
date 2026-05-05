import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const result = await query(
      'SELECT * FROM categories WHERE user_id = $1 ORDER BY name',
      [user.userId]
    );
    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { name, color, icon, type } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const result = await query(
      'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user.userId, name, color || '#6366f1', icon || 'tag', type || 'expense']
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
