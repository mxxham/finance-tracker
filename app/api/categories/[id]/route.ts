import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(req);
    const resolvedParams = await params;
    const categoryId = Number(resolvedParams.id);
    if (Number.isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 });
    }
    const { name, color, icon, type } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const result = await query(
      `UPDATE categories
       SET name = $1, color = $2, icon = $3, type = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, color || '#6366f1', icon || 'tag', type || 'expense', categoryId, user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuth(req);
    const resolvedParams = await params;
    const categoryId = Number(resolvedParams.id);
    if (Number.isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category id' }, { status: 400 });
    }
    await query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [categoryId, user.userId]
    );
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
