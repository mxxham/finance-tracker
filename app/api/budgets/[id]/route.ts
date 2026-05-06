import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    await query(
      `DELETE FROM budgets WHERE id = $1 AND user_id = $2`,
      [Number(id), user.userId]
    );
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
