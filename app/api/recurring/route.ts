import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/recurring
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);

    const result = await query(
      `SELECT r.*, c.name as category_name, c.color as category_color
       FROM recurring r
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE r.user_id = $1
       ORDER BY r.next_due ASC`,
      [user.userId]
    );

    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

// POST /api/recurring
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { amount, type, description, frequency, start_date, end_date, category_id, auto_post, notes } = await req.json();

    if (!amount || !type || !description || !frequency || !start_date) {
      return NextResponse.json({ error: 'Amount, type, description, frequency, and start_date are required' }, { status: 400 });
    }

    // Calculate next_due based on frequency
    const nextDue = new Date(start_date);
    
    const result = await query(
      `INSERT INTO recurring (user_id, category_id, amount, type, description, frequency, start_date, end_date, next_due, auto_post, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [user.userId, category_id || null, amount, type, description, frequency, start_date, end_date || null, nextDue.toISOString().split('T')[0], auto_post || false, notes || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
