import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { USD_RATES } from '@/lib/currencies';

// POST /api/convert-currency
// Body: { fromCurrency: string, toCurrency: string }
// Converts all transaction amounts and budget amounts for the user
export async function POST(req: NextRequest) {
  try {
    await initDB();
    const user = requireAuth(req);
    const { fromCurrency, toCurrency } = await req.json();

    if (!fromCurrency || !toCurrency) {
      return NextResponse.json({ error: 'fromCurrency and toCurrency required' }, { status: 400 });
    }
    if (fromCurrency === toCurrency) {
      return NextResponse.json({ converted: 0 });
    }

    const fromRate = USD_RATES[fromCurrency] ?? 1;
    const toRate   = USD_RATES[toCurrency]   ?? 1;
    // multiplier: amount_in_new_currency = amount * (toRate / fromRate)
    const multiplier = toRate / fromRate;

    // Convert all transaction amounts
    const txResult = await query(
      `UPDATE transactions SET amount = ROUND((amount * $1)::numeric, 2) WHERE user_id = $2`,
      [multiplier, user.userId]
    );

    // Convert all budget amounts
    const budgetResult = await query(
      `UPDATE budgets SET amount = ROUND((amount * $1)::numeric, 2) WHERE user_id = $2`,
      [multiplier, user.userId]
    );

    return NextResponse.json({
      converted: (txResult.rowCount ?? 0) + (budgetResult.rowCount ?? 0),
      multiplier,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}