import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { name, email } = await req.json();

    if (!name && !email) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, user.userId]);
    if (existing.rows.length > 0) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

    const result = await query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3 RETURNING id, name, email',
      [name || null, email || null, user.userId]
    );

    return NextResponse.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}