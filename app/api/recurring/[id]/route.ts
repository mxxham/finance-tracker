import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// PUT /api/recurring/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = requireAuth(req);
    const id = parseInt(params.id);
    const body = await req.json();

    // Check ownership
    const existing = await query(
      'SELECT * FROM recurring WHERE id = $1 AND user_id = $2',
      [id, user.userId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Recurring transaction not found' }, { status: 404 });
    }

    const result = await query(
      `UPDATE recurring
       SET amount = COALESCE($1, amount),
           type = COALESCE($2, type),
           description = COALESCE($3, description),
           frequency = COALESCE($4, frequency),
           start_date = COALESCE($5, start_date),
           end_date = $6,
           category_id = $7,
           auto_post = COALESCE($8, auto_post),
           notes = $9,
           is_active = COALESCE($10, is_active)
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [
        body.amount,
        body.type,
        body.description,
        body.frequency,
        body.start_date,
        body.end_date || null,
        body.category_id || null,
        body.auto_post,
        body.notes || null,
        body.is_active,
        id,
        user.userId
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

// DELETE /api/recurring/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = requireAuth(req);
    const id = parseInt(params.id);

    // Check ownership
    const existing = await query(
      'SELECT * FROM recurring WHERE id = $1 AND user_id = $2',
      [id, user.userId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Recurring transaction not found' }, { status: 404 });
    }

    await query('DELETE FROM recurring WHERE id = $1 AND user_id = $2', [id, user.userId]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
