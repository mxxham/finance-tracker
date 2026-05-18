import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = requireAuth(req);
    const { id } = await params;

    const goal = await query(
      `SELECT g.*,
        (SELECT json_agg(c ORDER BY c.date DESC, c.id DESC)
         FROM savings_contributions c WHERE c.goal_id = g.id) as contributions
       FROM savings_goals g WHERE g.id = $1 AND g.user_id = $2`,
      [id, user.userId]
    );
    if (!goal.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(goal.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
        ...(status === 401 ? { hint: 'Missing or invalid Authorization: Bearer <token>' } : null),
      },
      { status }
    );
  }
}


export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    // Handle contribution sub-action
    if (body.action === 'contribute') {
      const { amount, note, date } = body;
      if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

      // Insert contribution record
      await query(
        `INSERT INTO savings_contributions (goal_id, user_id, amount, note, date)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, user.userId, amount, note || null, date || new Date().toISOString().slice(0, 10)]
      );

      // Update current_amount and auto-complete if reached target
      const updated = await query(
        `UPDATE savings_goals
         SET current_amount = LEAST(current_amount + $1, target_amount),
             status = CASE WHEN current_amount + $1 >= target_amount THEN 'completed' ELSE status END,
             updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [amount, id, user.userId]
      );
      return NextResponse.json(updated.rows[0]);
    }

    // Handle withdrawal sub-action
    if (body.action === 'withdraw') {
      const { amount, note, date } = body;
      if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

      await query(
        `INSERT INTO savings_contributions (goal_id, user_id, amount, note, date)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, user.userId, -Math.abs(Number(amount)), note || 'Withdrawal', date || new Date().toISOString().slice(0, 10)]
      );

      const updated = await query(
        `UPDATE savings_goals
         SET current_amount = GREATEST(current_amount - $1, 0),
             status = CASE WHEN status = 'completed' AND current_amount - $1 < target_amount THEN 'active' ELSE status END,
             updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [amount, id, user.userId]
      );
      return NextResponse.json(updated.rows[0]);
    }

    // General update (name, target, color, icon, deadline, notes, status)
    const { name, target_amount, color, icon, deadline, notes, status } = body;
    const result = await query(
      `UPDATE savings_goals
       SET name = COALESCE($1, name),
           target_amount = COALESCE($2, target_amount),
           color = COALESCE($3, color),
           icon = COALESCE($4, icon),
           deadline = COALESCE($5, deadline),
           notes = COALESCE($6, notes),
           status = COALESCE($7, status),
           updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [name, target_amount, color, icon, deadline || null, notes, status, id, user.userId]
    );
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    await query(`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`, [id, user.userId]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}