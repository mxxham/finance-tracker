import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST /api/recurring/[id]/skip
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const idNum = parseInt(id);

    // Get the recurring transaction
    const recurring = await query(
      'SELECT * FROM recurring WHERE id = $1 AND user_id = $2',
      [idNum, user.userId]
    );

    if (recurring.rows.length === 0) {
      return NextResponse.json({ error: 'Recurring transaction not found' }, { status: 404 });
    }

    const r = recurring.rows[0];

    // Update the next_due date without creating a transaction
    const nextDue = new Date(r.next_due);
    const frequency = r.frequency;
    
    // Calculate next due date based on frequency
    switch (frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'biweekly':
        nextDue.setDate(nextDue.getDate() + 14);
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
      case 'quarterly':
        nextDue.setMonth(nextDue.getMonth() + 3);
        break;
      case 'yearly':
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        break;
    }

    // Check if we've passed the end_date
    let isActive = r.is_active;
    if (r.end_date && nextDue > new Date(r.end_date)) {
      isActive = false;
    }

    await query(
      `UPDATE recurring
       SET next_due = $1, is_active = $2
       WHERE id = $3`,
      [nextDue.toISOString().split('T')[0], isActive, idNum]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
