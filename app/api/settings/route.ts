import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await initDB();
    const user = requireAuth(req);
    const result = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [user.userId]
    );
    if (result.rows.length === 0) {
      // Return defaults
      return NextResponse.json({
        currency: 'IDR', locale: 'id-ID', language: 'en', payday: 25, theme: 'midnight',
        date_format: 'DD/MM/YYYY', week_start: 'monday', default_view: 'overview',
        show_decimals: false, compact_numbers: true, enable_animations: true,
        budget_alerts: true, budget_alert_threshold: 80,
      });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await initDB();
    const user = requireAuth(req);
    const body = await req.json();

    const allowed = [
      'currency', 'locale', 'language', 'payday', 'theme', 'date_format', 'week_start',
      'default_view', 'show_decimals', 'compact_numbers', 'enable_animations',
      'budget_alerts', 'budget_alert_threshold',
    ];

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${i++}`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

    values.push(user.userId);
    await query(
      `INSERT INTO user_settings (user_id, ${allowed.filter(k => k in body).join(', ')}, updated_at)
       VALUES ($${values.length}, ${values.slice(0, -1).map((_, j) => `$${j + 1}`).join(', ')}, NOW())
       ON CONFLICT (user_id) DO UPDATE SET ${fields.join(', ')}, updated_at = NOW()`,
      values
    );

    const result = await query('SELECT * FROM user_settings WHERE user_id = $1', [user.userId]);
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
