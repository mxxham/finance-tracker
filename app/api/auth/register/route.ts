import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, initDB } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, password_hash]
    );

    const user = result.rows[0];

    // Default categories
    const defaultCategories = [
      { name: 'Salary', color: '#22c55e', icon: 'briefcase', type: 'income' },
      { name: 'Freelance', color: '#10b981', icon: 'laptop', type: 'income' },
      { name: 'Business', color: '#06b6d4', icon: 'trending-up', type: 'income' },
      { name: 'Incoming Transfer', color: '#84cc16', icon: 'arrow-down-circle', type: 'income' },
      { name: 'Food & Drink', color: '#f97316', icon: 'utensils', type: 'expense' },
      { name: 'Transport & Rideshare', color: '#3b82f6', icon: 'car', type: 'expense' },
      { name: 'Shopping', color: '#a855f7', icon: 'shopping-bag', type: 'expense' },
      { name: 'Entertainment', color: '#ec4899', icon: 'film', type: 'expense' },
      { name: 'Health', color: '#ef4444', icon: 'heart', type: 'expense' },
      { name: 'Bills & Utilities', color: '#eab308', icon: 'zap', type: 'expense' },
      { name: 'Rent & Housing', color: '#06b6d4', icon: 'home', type: 'expense' },
      { name: 'Education', color: '#8b5cf6', icon: 'book', type: 'expense' },
      { name: 'QRIS & E-Wallet', color: '#f43f5e', icon: 'smartphone', type: 'expense' },
      { name: 'Savings & Investment', color: '#6366f1', icon: 'piggy-bank', type: 'expense' },
      { name: 'Phone & Internet', color: '#14b8a6', icon: 'wifi', type: 'expense' },
      { name: 'Other', color: '#94a3b8', icon: 'more-horizontal', type: 'expense' },
    ];

    for (const cat of defaultCategories) {
      await query(
        'INSERT INTO categories (user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5)',
        [user.id, cat.name, cat.color, cat.icon, cat.type]
      );
    }

    const token = signToken({ userId: user.id, email: user.email });
    return NextResponse.json({ token, user }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
