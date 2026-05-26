import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Seeds realistic sample data for a new user so the dashboard isn't empty
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const body = await req.json();
    const { monthly_income, currency, payday } = body;

    const income = Number(monthly_income) || 0;
    const today = new Date();
    const m = today.getMonth() + 1;
    const y = today.getFullYear();

    // Fetch their default categories
    const cats = await query(
      'SELECT id, name FROM categories WHERE user_id = $1',
      [user.userId]
    );
    const cat = (name: string) => cats.rows.find(c => c.name === name)?.id ?? null;

    // Seed a salary transaction this month
    if (income > 0) {
      await query(
        `INSERT INTO transactions (user_id, category_id, amount, type, description, date)
         VALUES ($1, $2, $3, 'income', 'Monthly Salary', $4)
         ON CONFLICT DO NOTHING`,
        [user.userId, cat('Salary'), income, `${y}-${String(m).padStart(2,'0')}-01`]
      );

      // Seed a few realistic expenses as a percentage of income
      const seeds = [
        { name: 'Rent & Housing',        pct: 0.30, desc: 'Monthly Rent',       day: 1 },
        { name: 'Food & Drink',           pct: 0.12, desc: 'Groceries',          day: 3 },
        { name: 'Transport & Rideshare',  pct: 0.06, desc: 'Transport',          day: 5 },
        { name: 'Phone & Internet',       pct: 0.03, desc: 'Phone & Internet',   day: 5 },
        { name: 'Bills & Utilities',      pct: 0.05, desc: 'Electricity & Water',day: 8 },
        { name: 'Food & Drink',           pct: 0.05, desc: 'Eating Out',         day: 12 },
        { name: 'Entertainment',          pct: 0.04, desc: 'Entertainment',      day: 15 },
      ];

      for (const s of seeds) {
        const amount = Math.round(income * s.pct);
        if (amount <= 0) continue;
        await query(
          `INSERT INTO transactions (user_id, category_id, amount, type, description, date)
           VALUES ($1, $2, $3, 'expense', $4, $5)`,
          [user.userId, cat(s.name), amount, s.desc,
           `${y}-${String(m).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`]
        );
      }
    }

    // Update settings
    if (currency || payday) {
      await query(
        `UPDATE user_settings SET
           currency = COALESCE($1, currency),
           payday   = COALESCE($2, payday),
           updated_at = NOW()
         WHERE user_id = $3`,
        [currency || null, payday || null, user.userId]
      );
    }

    // Mark onboarding complete in settings
    await query(
      `UPDATE user_settings SET onboarding_done = TRUE, updated_at = NOW() WHERE user_id = $1`,
      [user.userId]
    ).catch(() => {
      // Column may not exist yet — add it gracefully
      return query(
        `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE`,
        []
      ).then(() =>
        query(
          `UPDATE user_settings SET onboarding_done = TRUE WHERE user_id = $1`,
          [user.userId]
        )
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    // Check if user has any transactions
    const txCount = await query(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
      [user.userId]
    );
    const hasData = Number(txCount.rows[0]?.count ?? 0) > 0;

    // Check settings for onboarding flag
    const settings = await query(
      'SELECT onboarding_done FROM user_settings WHERE user_id = $1',
      [user.userId]
    ).catch(() => ({ rows: [{ onboarding_done: false }] }));

    const done = settings.rows[0]?.onboarding_done ?? false;
    return NextResponse.json({ onboarding_done: done || hasData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
