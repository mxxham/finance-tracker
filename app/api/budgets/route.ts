import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

async function ensureRepeatColumn() {
  await query(
    `ALTER TABLE budgets ADD COLUMN IF NOT EXISTS repeat_monthly BOOLEAN DEFAULT FALSE`,
    []
  ).catch(() => {});
}

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get('month') || new Date().getMonth() + 1);
    const year  = Number(searchParams.get('year')  || new Date().getFullYear());

    await ensureRepeatColumn();

    // Auto-rollover: if this month has no budgets yet, copy repeat_monthly=true from last month
    const existing = await query(
      `SELECT COUNT(*) as c FROM budgets WHERE user_id=$1 AND month=$2 AND year=$3`,
      [user.userId, month, year]
    );

    if (Number(existing.rows[0]?.c ?? 0) === 0) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear  = month === 1 ? year - 1 : year;
      const toRoll = await query(
        `SELECT * FROM budgets WHERE user_id=$1 AND month=$2 AND year=$3 AND repeat_monthly=TRUE`,
        [user.userId, prevMonth, prevYear]
      );
      if (toRoll.rows.length > 0) {
        await Promise.all(toRoll.rows.map(b =>
          query(
            `INSERT INTO budgets (user_id, category_id, amount, month, year, repeat_monthly)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (user_id, category_id, month, year) DO NOTHING`,
            [user.userId, b.category_id, b.amount, month, year, true]
          )
        ));
      }
    }

    const result = await query(
      `SELECT b.*, c.name as category_name, c.color as category_color,
        COALESCE((
          SELECT SUM(t.amount) FROM transactions t
          WHERE t.category_id=b.category_id AND t.user_id=b.user_id
            AND EXTRACT(MONTH FROM t.date)=b.month AND EXTRACT(YEAR FROM t.date)=b.year
            AND t.type='expense'
        ),0) as spent
       FROM budgets b
       JOIN categories c ON b.category_id=c.id
       WHERE b.user_id=$1 AND b.month=$2 AND b.year=$3
       ORDER BY c.name`,
      [user.userId, month, year]
    );
    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    await ensureRepeatColumn();
    const { category_id, amount, month, year, repeat_monthly = false } = await req.json();
    const result = await query(
      `INSERT INTO budgets (user_id, category_id, amount, month, year, repeat_monthly)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, category_id, month, year)
       DO UPDATE SET amount=$3, repeat_monthly=$6
       RETURNING *`,
      [user.userId, category_id, amount, month, year, repeat_monthly]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
