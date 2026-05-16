import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Auto-create table on first use
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      target_amount DECIMAL(14,2) NOT NULL,
      current_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      color VARCHAR(7) DEFAULT '#5b6ef5',
      icon VARCHAR(50) DEFAULT '🎯',
      deadline DATE,
      notes TEXT,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS savings_contributions (
      id SERIAL PRIMARY KEY,
      goal_id INTEGER REFERENCES savings_goals(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(14,2) NOT NULL,
      note TEXT,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal ON savings_contributions(goal_id);`);
}

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    await ensureTable();

    const goals = await query(
      `SELECT g.*,
        COALESCE((SELECT SUM(c.amount) FROM savings_contributions c WHERE c.goal_id = g.id), 0) as contributed_total,
        (SELECT COUNT(*) FROM savings_contributions c WHERE c.goal_id = g.id) as contribution_count,
        (SELECT json_agg(c ORDER BY c.date DESC, c.id DESC) FROM (
          SELECT c.id, c.amount, c.note, c.date FROM savings_contributions c
          WHERE c.goal_id = g.id ORDER BY c.date DESC, c.id DESC LIMIT 5
        ) c) as recent_contributions
       FROM savings_goals g
       WHERE g.user_id = $1
       ORDER BY
         CASE g.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
         g.deadline ASC NULLS LAST,
         g.created_at DESC`,
      [user.userId]
    );

    return NextResponse.json(goals.rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    await ensureTable();

    const { name, target_amount, current_amount = 0, color = '#5b6ef5', icon = '🎯', deadline, notes } = await req.json();
    if (!name || !target_amount) return NextResponse.json({ error: 'name and target_amount are required' }, { status: 400 });

    const result = await query(
      `INSERT INTO savings_goals (user_id, name, target_amount, current_amount, color, icon, deadline, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [user.userId, name, target_amount, current_amount, color, icon, deadline || null, notes || null]
    );

    // If starting with an initial amount, record it as a contribution
    if (Number(current_amount) > 0) {
      await query(
        `INSERT INTO savings_contributions (goal_id, user_id, amount, note, date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
        [result.rows[0].id, user.userId, current_amount, 'Initial amount']
      );
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}