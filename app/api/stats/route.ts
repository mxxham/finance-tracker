import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get('month') || new Date().getMonth() + 1);
    const year = Number(searchParams.get('year') || new Date().getFullYear());

    // Monthly totals
    const totals = await query(
      `SELECT type, SUM(amount) as total
       FROM transactions
       WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
       GROUP BY type`,
      [user.userId, month, year]
    );

    const income = totals.rows.find(r => r.type === 'income')?.total || 0;
    const expenses = totals.rows.find(r => r.type === 'expense')?.total || 0;

    // Spending by category
    const byCategory = await query(
      `SELECT c.name, c.color, SUM(t.amount) as total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
         AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
       GROUP BY c.name, c.color
       ORDER BY total DESC`,
      [user.userId, month, year]
    );

    // Last 6 months trend
    const trend = await query(
      `SELECT
        EXTRACT(MONTH FROM date) as month,
        EXTRACT(YEAR FROM date) as year,
        type,
        SUM(amount) as total
       FROM transactions
       WHERE user_id = $1
         AND date >= NOW() - INTERVAL '6 months'
       GROUP BY month, year, type
       ORDER BY year, month`,
      [user.userId]
    );

    // All-time balance
    const balance = await query(
      `SELECT
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
       FROM transactions WHERE user_id = $1`,
      [user.userId]
    );

    return NextResponse.json({
      income: Number(income),
      expenses: Number(expenses),
      savings: Number(income) - Number(expenses),
      balance: Number(balance.rows[0]?.balance || 0),
      byCategory: byCategory.rows,
      trend: trend.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
