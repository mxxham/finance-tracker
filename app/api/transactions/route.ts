import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/transactions
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit') || '50';

    let sql = `
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
    `;
    const params: unknown[] = [user.userId];
    let idx = 2;

    if (month && year) {
      sql += ` AND EXTRACT(MONTH FROM t.date) = $${idx++} AND EXTRACT(YEAR FROM t.date) = $${idx++}`;
      params.push(Number(month), Number(year));
    }
    if (type) {
      sql += ` AND t.type = $${idx++}`;
      params.push(type);
    }

    sql += ` ORDER BY t.date DESC, t.created_at DESC LIMIT $${idx}`;
    params.push(Number(limit));

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

// POST /api/transactions
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { amount, type, description, date, category_id } = await req.json();

    if (!amount || !type || !date) {
      return NextResponse.json({ error: 'Amount, type, and date are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO transactions (user_id, category_id, amount, type, description, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.userId, category_id || null, amount, type, description, date]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
