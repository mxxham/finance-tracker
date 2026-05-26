import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function escapeCSV(val: string | number | null): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    // Support token via query param for direct browser navigation (download/print)
    const { searchParams } = new URL(req.url);
    const queryToken = searchParams.get('token');
    let req2 = req;
    if (queryToken && !req.headers.get('authorization')) {
      const headers = new Headers(req.headers);
      headers.set('authorization', `Bearer ${queryToken}`);
      req2 = new NextRequest(req.url, { headers });
    }
    const user = requireAuth(req2);
    const format = searchParams.get('format') ?? 'csv'; // csv | pdf
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const type = searchParams.get('type'); // income | expense | ''

    let whereClause = 'WHERE t.user_id = $1';
    const params: (string | number)[] = [user.userId];

    if (month && year) {
      params.push(Number(month), Number(year));
      whereClause += ` AND EXTRACT(MONTH FROM t.date) = $${params.length - 1} AND EXTRACT(YEAR FROM t.date) = $${params.length}`;
    }
    if (type) {
      params.push(type);
      whereClause += ` AND t.type = $${params.length}`;
    }

    const rows = await query(
      `SELECT t.date, t.type, t.amount, t.description, c.name as category, t.created_at
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       ${whereClause}
       ORDER BY t.date DESC, t.id DESC`,
      params
    );

    // --- CSV ---
    if (format === 'csv') {
      const headers = ['Date', 'Type', 'Amount', 'Description', 'Category'];
      const lines = [
        headers.join(','),
        ...rows.rows.map(r => [
          escapeCSV(r.date?.toISOString?.()?.slice(0, 10) ?? r.date),
          escapeCSV(r.type),
          escapeCSV(r.amount),
          escapeCSV(r.description),
          escapeCSV(r.category ?? 'Uncategorized'),
        ].join(',')),
      ];
      const csv = lines.join('\n');
      const filename = `fintrack-transactions${month ? `-${year}-${String(month).padStart(2,'0')}` : ''}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // --- Simple HTML→PDF (no lib needed, browser prints it) ---
    if (format === 'pdf') {
      const totalIncome = rows.rows.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
      const totalExpense = rows.rows.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
      const periodLabel = month && year ? `${new Date(Number(year), Number(month)-1).toLocaleString('en',{month:'long'})} ${year}` : 'All Time';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>FinTrack Export — ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; color: #111; padding: 32px; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .chip { padding: 10px 16px; border-radius: 8px; flex: 1; }
    .chip.income { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .chip.expense { background: #fff1f2; border: 1px solid #fecdd3; }
    .chip.net { background: #f0f9ff; border: 1px solid #bae6fd; }
    .chip-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
    .chip-value { font-size: 18px; font-weight: 800; font-family: monospace; margin-top: 2px; }
    .income .chip-value { color: #16a34a; }
    .expense .chip-value { color: #dc2626; }
    .net .chip-value { color: #0369a1; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #999; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    tr:hover td { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge.income { background: #dcfce7; color: #15803d; }
    .badge.expense { background: #fee2e2; color: #b91c1c; }
    .amount { font-family: monospace; font-weight: 700; }
    .amount.income { color: #16a34a; }
    .amount.expense { color: #dc2626; }
    .footer { margin-top: 24px; font-size: 11px; color: #aaa; text-align: center; }
    @media print { @page { margin: 20mm; } }
  </style>
</head>
<body>
  <h1>FinTrack — Transaction Report</h1>
  <div class="sub">Period: ${periodLabel} · Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
  <div class="summary">
    <div class="chip income"><div class="chip-label">Total Income</div><div class="chip-value">+${totalIncome.toLocaleString()}</div></div>
    <div class="chip expense"><div class="chip-label">Total Expenses</div><div class="chip-value">-${totalExpense.toLocaleString()}</div></div>
    <div class="chip net"><div class="chip-label">Net</div><div class="chip-value">${(totalIncome-totalExpense).toLocaleString()}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${rows.rows.map(r => `
      <tr>
        <td>${r.date?.toISOString?.()?.slice(0,10) ?? r.date}</td>
        <td><span class="badge ${r.type}">${r.type}</span></td>
        <td>${r.description ?? ''}</td>
        <td style="color:#666">${r.category ?? 'Uncategorized'}</td>
        <td class="amount ${r.type}" style="text-align:right">${r.type==='income' ? '+' : '-'}${Number(r.amount).toLocaleString()}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">${rows.rows.length} transactions · FinTrack Personal Finance</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
      const filename = `fintrack-transactions${month ? `-${year}-${String(month).padStart(2,'0')}` : ''}.pdf`;
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format. Use ?format=csv or ?format=pdf' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
