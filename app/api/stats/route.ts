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
       GROUP BY EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date), type
       ORDER BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)`,
      [user.userId]
    );

    // Daily breakdown for the selected month (for Day-over-Day chart)
    const daily = await query(
      `SELECT
        EXTRACT(DOW FROM date) as dow,
        EXTRACT(DAY FROM date) as day,
        TO_CHAR(date, 'YYYY-MM-DD') as date_str,
        type,
        SUM(amount) as total
       FROM transactions
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3
       GROUP BY EXTRACT(DOW FROM date), EXTRACT(DAY FROM date), TO_CHAR(date, 'YYYY-MM-DD'), type
       ORDER BY EXTRACT(DAY FROM date)`,
      [user.userId, month, year]
    );

    // Weekday spending pattern — average expense per DOW across all time
    const weekdayPattern = await query(
      `SELECT
        sub.dow,
        AVG(sub.daily_total) as avg_spend
       FROM (
         SELECT DATE(date) as day_date, EXTRACT(DOW FROM date) as dow, SUM(amount) as daily_total
         FROM transactions
         WHERE user_id = $1 AND type = 'expense'
         GROUP BY DATE(date), EXTRACT(DOW FROM date)
       ) sub
       GROUP BY sub.dow
       ORDER BY sub.dow`,
      [user.userId]
    );

    // Category month-over-month — last 6 months, top 5 categories
    const categoryMoM = await query(
      `SELECT
        c.name,
        c.color,
        EXTRACT(MONTH FROM t.date) as month,
        EXTRACT(YEAR FROM t.date) as year,
        SUM(t.amount) as total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1
         AND t.type = 'expense'
         AND t.date >= NOW() - INTERVAL '6 months'
       GROUP BY c.name, c.color, EXTRACT(MONTH FROM t.date), EXTRACT(YEAR FROM t.date)
       ORDER BY EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)`,
      [user.userId]
    );

    // Transaction frequency — count of transactions per day this month
    const txFrequency = await query(
      `SELECT
        EXTRACT(DAY FROM date) as day,
        COUNT(*) as count,
        type
       FROM transactions
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3
       GROUP BY EXTRACT(DAY FROM date), type
       ORDER BY EXTRACT(DAY FROM date)`,
      [user.userId, month, year]
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
      daily: daily.rows,
      weekdayPattern: weekdayPattern.rows,
      categoryMoM: categoryMoM.rows,
      txFrequency: txFrequency.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}